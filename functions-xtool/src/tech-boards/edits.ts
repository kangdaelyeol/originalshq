import { Firestore } from 'firebase-admin/firestore'
import { findTechBoard, TechBoardSource } from './boards'
import { buildColumnValues } from './columns'
import { TechEditError } from './errors'
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
  moveItemToGroup,
} from './monday-api'
import {
  TechBoardMeta,
  TechChange,
  TechEditInput,
  TechEditLog,
  TechItemDoc,
} from './types'

export interface Editor {
  email: string
  name: string
  uid: string
}

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
  const items = await fetchTechItems(apiKey, itemIds, !!source.subitems)
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

/** 기존 item 고치기 — Monday에 쓰고, 다시 읽어 캐시를 맞추고, 기록을 남긴다. */
async function applyUpdate(
  db: Firestore,
  apiKey: string,
  input: TechEditInput,
  editor: Editor,
): Promise<TechItemDoc | null> {
  const source = sourceOf(input.boardKey)
  if (!input.itemId) throw new TechEditError('수정할 항목이 없어요')
  const [meta, before] = await Promise.all([
    getBoardMeta(db, source.key),
    getItem(db, input.itemId),
  ])
  if (!meta) throw new TechEditError('보드 정보가 아직 없어요. 동기화 후 다시 해 주세요')
  if (!before || before.boardKey !== source.key) {
    throw new TechEditError('이 보드에 없는 항목이에요')
  }

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

  if (Object.keys(columnValues).length > 0) {
    await changeColumnValues(
      apiKey,
      source.boardId,
      before.itemId,
      columnValues,
    )
  }
  if (moveTo) await moveItemToGroup(apiKey, before.itemId, moveTo)

  const after =
    (await refreshItems(db, apiKey, source, [before.itemId], meta)).get(
      before.itemId,
    ) ?? null
  const changes = diff(meta, before, after, fields)
  if (changes.length > 0) {
    await addEditLog(db, log({ changes, itemName: after?.name ?? before.name }))
  }
  return after
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

  const itemId = await createItem(
    apiKey,
    source.boardId,
    input.groupId ?? null,
    name,
    columnValues,
  )

  const after =
    (await refreshItems(db, apiKey, source, [itemId], meta)).get(itemId) ?? null
  await addEditLog(db, {
    at: Date.now(),
    action: 'create',
    boardKey: source.key,
    boardName: meta.name,
    itemId,
    itemName: name,
    by: editor,
    changes: diff(meta, null, after, [
      'name',
      'group',
      ...Object.keys(input.columns ?? {}),
    ]),
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
): Promise<TechItemDoc | null> {
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
