import { Firestore } from 'firebase-admin/firestore'
import { findTechBoard, TechBoardSource } from './boards'
import { buildColumnValues } from './columns'
import { TechEditError } from './errors'
import { applySubitems, planSubitems, subitemChange } from './subitems'
import {
  addEditLog,
  deleteItem,
  getBoardMeta,
  getItem,
  saveItem,
} from './firestore'
import { isGone, toItemDocs } from './items'
import {
  changeColumnValues,
  createItem,
  fetchTechItems,
  ItemShape,
  moveItemToGroup,
  deleteItem as deleteMondayItem,
  TechRawItem,
} from './monday-api'
import {
  TechBoardKey,
  TechBoardMeta,
  TechChange,
  TechConflict,
  TechEditInput,
  TechEditLog,
  TechItemDoc,
} from './types'

export interface Editor {
  email: string
  name: string
  uid: string
}

/** 쓰기 응답·다시 읽기에서 받을 item 모양 — 보드 설정대로 */
const shapeOf = (source: TechBoardSource): ItemShape => ({
  subitems: !!source.subitems,
  updates: !!source.updates,
})

/** item 몇 개를 Monday에서 다시 읽어 캐시를 맞춘다 — 수정 직후·webhook. 지워진
 * item은 캐시에서 뺀다. 갱신된 문서를 돌려준다(지워졌으면 null). */
export async function refreshItems(
  db: Firestore,
  apiKey: string,
  source: TechBoardSource,
  itemIds: string[],
  meta?: TechBoardMeta | null,
): Promise<Map<string, TechItemDoc | null>> {
  const boardMeta = meta ?? (await getBoardMeta(db, source.key))
  const shape = shapeOf(source)
  const items = await fetchTechItems(
    apiKey,
    itemIds,
    shape.subitems,
    shape.updates,
  )
  return saveRawItems(db, source, boardMeta, itemIds, items)
}

/** Monday에서 받은 item(다시 읽었거나 쓰기 응답에 실려 온 것)을 캐시에 쓴다. */
export async function saveRawItems(
  db: Firestore,
  source: TechBoardSource,
  boardMeta: TechBoardMeta | null,
  itemIds: string[],
  items: TechRawItem[],
): Promise<Map<string, TechItemDoc | null>> {
  const byId = new Map(items.map((item) => [String(item.id), item]))
  const result = new Map<string, TechItemDoc | null>()
  for (const id of itemIds) {
    const item = byId.get(id)
    // 다른 보드로 옮겨진 item도 이 보드 캐시에서는 뺀다.
    if (
      !item ||
      isGone(item) ||
      (item.board && item.board.id !== source.boardId)
    ) {
      await deleteItem(db, id)
      result.set(id, null)
      continue
    }
    const columns = (boardMeta?.columns ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
    }))
    const [doc] = toItemDocs(
      source,
      { name: boardMeta?.name ?? '', columns },
      [item],
      Date.now(),
    )
    await saveItem(db, doc)
    result.set(id, doc)
  }
  return result
}

/** 하위 줄 묶음의 이름 — 수정 기록에 쓴다. */
const SUBITEM_LABEL: Record<string, string> = {
  fieldService: '설치 품목',
  repair: '청구 부품·공임',
}

const sourceOf = (key: string): TechBoardSource => {
  const source = findTechBoard({ key })
  if (!source) throw new TechEditError('없는 보드예요')
  return source
}

/** 바뀐 칸 — 이름·단계·컬럼마다 전후 글자(Monday 화면 글자 그대로). */
function diff(
  meta: TechBoardMeta,
  before: TechItemDoc | null,
  after: TechItemDoc | null,
  fields: string[],
): TechChange[] {
  const title = (field: string) =>
    field === 'name' ? '이름' :
      field === 'group' ? '진행 단계' :
        meta.columns.find((c) => c.id === field)?.title ?? field
  const text = (doc: TechItemDoc | null, field: string): string | null => {
    if (!doc) return null
    if (field === 'name') return doc.name
    if (field === 'group') {
      return meta.groups.find((g) => g.id === doc.groupId)?.title ?? doc.groupId
    }
    return doc.values[field]?.text || null
  }
  return fields
    .map((field) => ({
      field,
      title: title(field),
      before: text(before, field),
      after: text(after, field),
    }))
    .filter((change) => change.before !== change.after)
}

/**
 * 겹친 칸 — 화면이 고치기 전에 본 값(base)과 지금 캐시가 다르면, 그사이 다른 사람
 * (또는 Monday)이 바꾼 것이다. 그 칸은 덮어쓰지 않는다.
 */
function findConflicts(
  meta: TechBoardMeta,
  before: TechItemDoc,
  base: TechEditInput['base'],
): TechConflict[] {
  if (!base) return []
  const conflicts: TechConflict[] = []
  if (base.name !== undefined && base.name !== before.name) {
    conflicts.push({ field: 'name', title: '이름', theirs: before.name })
  }
  if (
    base.groupId !== undefined &&
    (base.groupId ?? null) !== (before.groupId ?? null)
  ) {
    const group = meta.groups.find((g) => g.id === before.groupId)
    conflicts.push({
      field: 'group',
      title: '진행 단계',
      theirs: group?.title ?? before.groupId,
    })
  }
  for (const [id, seen] of Object.entries(base.columns ?? {})) {
    const now = before.values[id]?.text ?? ''
    if (now === seen) continue
    const title = meta.columns.find((c) => c.id === id)?.title ?? id
    conflicts.push({ field: id, title, theirs: now || null })
  }
  return conflicts
}

/** 겹친 칸을 뺀 입력 */
function withoutConflicts(
  input: TechEditInput,
  conflicts: TechConflict[],
): TechEditInput {
  if (conflicts.length === 0) return input
  const skip = new Set(conflicts.map((c) => c.field))
  const columns = Object.fromEntries(
    Object.entries(input.columns ?? {}).filter(([id]) => !skip.has(id)),
  )
  return {
    ...input,
    name: skip.has('name') ? undefined : input.name,
    groupId: skip.has('group') ? undefined : input.groupId,
    columns,
  }
}

export interface UpdateResult {
  doc: TechItemDoc | null
  conflicts: TechConflict[]
}

/**
 * 기존 item 고치기 — Monday에 쓰고, 캐시를 맞추고, 기록을 남긴다. 마지막 쓰기 응답에
 * 바뀐 item을 실어 받아 캐시에 바로 쓴다(다시 읽지 않는다 — Monday 왕복 한 번). 하위
 * 줄을 고쳤으면 부모 item을 다시 읽는다. 다른 사람이 먼저 바꾼 칸은 건너뛰고 알린다.
 */
async function applyUpdate(
  db: Firestore,
  apiKey: string,
  request: TechEditInput,
  editor: Editor,
): Promise<UpdateResult> {
  const source = sourceOf(request.boardKey)
  if (!request.itemId) throw new TechEditError('수정할 항목이 없어요')
  const [meta, before] = await Promise.all([
    getBoardMeta(db, source.key),
    getItem(db, request.itemId),
  ])
  if (!meta) throw new TechEditError('보드 정보가 아직 없어요. 동기화 후 다시 해 주세요')
  if (!before || before.boardKey !== source.key) {
    throw new TechEditError('이 보드에 없는 항목이에요')
  }
  const conflicts = findConflicts(meta, before, request.base)
  const input = withoutConflicts(request, conflicts)

  const columnValues = buildColumnValues(meta.columns, input.columns ?? {})
  const name = input.name?.trim()
  if (input.name !== undefined && !name) {
    throw new TechEditError('이름은 비울 수 없어요')
  }
  if (name && name !== before.name) columnValues.name = name
  const moveTo =
    input.groupId && input.groupId !== before.groupId ? input.groupId : null
  if (moveTo && !meta.groups.some((g) => g.id === moveTo)) {
    throw new TechEditError('없는 진행 단계예요')
  }

  // 하위 줄도 Monday에 쓰기 전에 먼저 검사한다(잘못된 입력이면 아무것도 안 쓰게).
  const subPlan = input.subitems ?
    planSubitems(meta, before.subitems ?? [], input.subitems) :
    null

  const fields = [
    ...Object.keys(input.columns ?? {}),
    ...(columnValues.name ? ['name'] : []),
    ...(moveTo ? ['group'] : []),
  ]
  const log = (partial: Partial<TechEditLog>): TechEditLog => ({
    at: Date.now(),
    action: 'update',
    boardKey: source.key,
    boardName: meta.name,
    itemId: before.itemId,
    itemName: before.name,
    by: editor,
    changes: [],
    ok: true,
    ...partial,
  })

  const hasValues = Object.keys(columnValues).length > 0
  // 겹친 칸만 있었으면 쓸 게 없다.
  if (!hasValues && !moveTo && !subPlan) return { doc: before, conflicts }

  // 마지막 쓰기만 바뀐 item을 실어 받는다(하위 줄을 고치면 그 뒤에 다시 읽는다).
  const shape = shapeOf(source)
  let raw: TechRawItem | null = null
  if (hasValues) {
    raw = await changeColumnValues(
      apiKey,
      source.boardId,
      before.itemId,
      columnValues,
      moveTo || subPlan ? undefined : shape,
    )
  }
  if (moveTo) {
    raw = await moveItemToGroup(
      apiKey,
      before.itemId,
      moveTo,
      subPlan ? undefined : shape,
    )
  }
  if (subPlan) await applySubitems(apiKey, meta, before.itemId, subPlan)

  const saved = raw ?
    await saveRawItems(db, source, meta, [before.itemId], [raw]) :
    await refreshItems(db, apiKey, source, [before.itemId], meta)
  const after = saved.get(before.itemId) ?? null
  const changes = diff(meta, before, after, fields)
  const subChange = subPlan ?
    subitemChange(
      meta,
      SUBITEM_LABEL[source.key] ?? '하위 항목',
      before.subitems ?? [],
      after?.subitems ?? [],
    ) :
    null
  if (subChange) changes.push(subChange)
  if (changes.length > 0) {
    await addEditLog(db, log({ changes, itemName: after?.name ?? before.name }))
  }
  return { doc: after, conflicts }
}

/** 새 item 만들기 — 이름은 꼭 있어야 한다. */
async function applyCreate(
  db: Firestore,
  apiKey: string,
  input: TechEditInput,
  editor: Editor,
): Promise<TechItemDoc | null> {
  const source = sourceOf(input.boardKey)
  const meta = await getBoardMeta(db, source.key)
  if (!meta) throw new TechEditError('보드 정보가 아직 없어요. 동기화 후 다시 해 주세요')
  const name = input.name?.trim()
  if (!name) throw new TechEditError('이름을 적어 주세요')
  if (input.groupId && !meta.groups.some((g) => g.id === input.groupId)) {
    throw new TechEditError('없는 진행 단계예요')
  }
  const columnValues = buildColumnValues(meta.columns, input.columns ?? {})
  const subPlan = input.subitems?.create?.length ?
    planSubitems(meta, [], { create: input.subitems.create }) :
    null

  // 만든 item을 응답에 실어 받는다 — 하위 줄을 만들면 그 뒤에 다시 읽는다.
  const created = await createItem(
    apiKey,
    source.boardId,
    input.groupId ?? null,
    name,
    columnValues,
    subPlan ? undefined : shapeOf(source),
  )
  const itemId = created.id
  if (subPlan) await applySubitems(apiKey, meta, itemId, subPlan)

  const saved = created.item ?
    await saveRawItems(db, source, meta, [itemId], [created.item]) :
    await refreshItems(db, apiKey, source, [itemId], meta)
  const after = saved.get(itemId) ?? null
  await addEditLog(db, {
    at: Date.now(),
    action: 'create',
    boardKey: source.key,
    boardName: meta.name,
    itemId,
    itemName: name,
    by: editor,
    changes: [
      ...diff(meta, null, after, [
        'name',
        'group',
        ...Object.keys(input.columns ?? {}),
      ]),
      ...(subPlan ?
        [
          subitemChange(
            meta,
            SUBITEM_LABEL[source.key] ?? '하위 항목',
            [],
            after?.subitems ?? [],
          ),
        ].filter((c): c is TechChange => c !== null) :
        []),
    ],
    ok: true,
  })
  return after
}

/**
 * 실패 기록 — 입력 검사·Monday 호출·캐시 갱신 어디서 실패하든 하나 남긴다(화면은
 * 저장을 기다리지 않고 닫히므로, 관리자는 여기서 실패를 본다). 기록 쓰기가 실패해도
 * 원래 오류를 덮지 않는다.
 */
async function logFailure(
  db: Firestore,
  action: 'update' | 'create',
  input: TechEditInput,
  editor: Editor,
  error: unknown,
): Promise<void> {
  try {
    const source = findTechBoard({ key: input.boardKey })
    const [meta, item] = await Promise.all([
      source ? getBoardMeta(db, source.key) : null,
      input.itemId ? getItem(db, input.itemId) : null,
    ])
    await addEditLog(db, {
      at: Date.now(),
      action,
      boardKey: input.boardKey,
      boardName: meta?.name ?? String(input.boardKey),
      itemId: input.itemId ?? null,
      itemName: item?.name ?? input.name ?? '(이름 없음)',
      by: editor,
      changes: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  } catch {
    // 기록 실패는 무시 — 사용자에게는 원래 오류가 간다.
  }
}

export async function updateTechItem(
  db: Firestore,
  apiKey: string,
  input: TechEditInput,
  editor: Editor,
): Promise<UpdateResult> {
  try {
    return await applyUpdate(db, apiKey, input, editor)
  } catch (error) {
    await logFailure(db, 'update', input, editor, error)
    throw error
  }
}

export async function createTechItem(
  db: Firestore,
  apiKey: string,
  input: TechEditInput,
  editor: Editor,
): Promise<TechItemDoc | null> {
  try {
    return await applyCreate(db, apiKey, input, editor)
  } catch (error) {
    await logFailure(db, 'create', input, editor, error)
    throw error
  }
}

// 한 번에 지울 수 있는 item 수 — 화면이 이만큼씩 나눠 보낸다.
export const MAX_DELETE = 25

/**
 * item 여러 개 지우기(Monday 표의 선택 막대) — Monday 휴지통으로 보내고(30일 안에
 * Monday에서 되살릴 수 있다) 캐시에서 뺀다. 우리 캐시에서 이 보드 것으로 확인된 item만
 * 지운다. 하나씩 하고, 실패한 것은 따로 돌려준다(나머지는 계속).
 */
export async function deleteTechItems(
  db: Firestore,
  apiKey: string,
  boardKey: TechBoardKey,
  itemIds: string[],
  editor: Editor,
): Promise<{
  deleted: string[]
  failed: Array<{ itemId: string; error: string }>
}> {
  const source = sourceOf(boardKey)
  const meta = await getBoardMeta(db, source.key)
  const deleted: string[] = []
  const failed: Array<{ itemId: string; error: string }> = []
  for (const itemId of itemIds) {
    const item = await getItem(db, itemId)
    if (!item || item.boardKey !== source.key) {
      failed.push({ itemId, error: '이 보드에 없는 항목이에요' })
      continue
    }
    try {
      await deleteMondayItem(apiKey, itemId)
      await deleteItem(db, itemId)
      deleted.push(itemId)
      await addEditLog(db, {
        at: Date.now(),
        action: 'delete',
        boardKey: source.key,
        boardName: meta?.name ?? source.key,
        itemId,
        itemName: item.name,
        by: editor,
        changes: [],
        ok: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed.push({ itemId, error: message })
      await addEditLog(db, {
        at: Date.now(),
        action: 'delete',
        boardKey: source.key,
        boardName: meta?.name ?? source.key,
        itemId,
        itemName: item.name,
        by: editor,
        changes: [],
        ok: false,
        error: message,
      }).catch(() => undefined)
    }
  }
  return { deleted, failed }
}
