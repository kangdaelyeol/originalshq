import * as logger from 'firebase-functions/logger'
import { DocumentReference, Firestore } from 'firebase-admin/firestore'
import { squash } from '../monday/fields'
import { ASSIGNEE_TITLE, peopleNames } from './assignees'
import { TechBoardSource } from './boards'
import { saveRawItems } from './edits'
import { addEditLog } from './firestore'
import {
  changeColumnValues,
  moveItemToGroup,
  TechRawItem,
} from './monday-api'
import {
  TechBoardKey,
  TechBoardMeta,
  TechChange,
  TechItemDoc,
} from './types'

// 보드 규칙 — Monday 보드 자동화를 우리 서버가 대신한다. Monday 자동화는 만든 사람의
// 권한으로 돌아서 그 사람이 보드 권한을 잃거나 떠나면 꺼진다(2026-11-09 AS 보드
// 자동화가 그렇게 꺼졌다). 세 가지다.
//  - 상태 규칙: 상태 칸이 X로 바뀌면(또는 X에서 다른 값으로 바뀌면) 날짜 칸들에 오늘, 그룹 옮기기.
//  - 만들 때 규칙: 새 item의 날짜 칸(AS 접수일)이 비어 있으면 오늘.
//  - 담당자 규칙: Monday 사람 칸("담당자")이 바뀌면 보이는 이름을 담당자(엑스툴) 글자
//    칸에 옮긴다(assignees.ts처럼 글자만 — Monday 사용자 조회·이메일 매핑 없음). 사람
//    칸 → 글자 칸 한 방향이고 덮어쓴다. 사람 칸을 비우면 글자 칸도 비운다.
//
// webhook이 바뀐 item을 Monday에서 다시 읽은 뒤 여기서 본다. Monday에서 고치든 우리
// 화면에서 고치든 Monday가 알림을 보내서 같은 길로 온다.
//
// "바뀌었다"는 규칙 기록(techRuleState)의 마지막으로 본 값과 비교해 정한다. 캐시와
// 비교하면 우리 화면에서 고친 경우 저장 직후 캐시가 이미 새 값이라 바뀐 것을 못
// 본다. 알림에 실려 온 이전 값은 믿지 않는다 — 가짜 요청이 와도 Monday에서 다시 읽은
// 값과 우리 기록만 본다. 우리가 쓴 칸(날짜·글자)은 보지 않는 칸이라 다시 알림이 와도
// 규칙이 되풀이되지 않는다.

export interface TechStatusRule {
  board: TechBoardKey
  /** 상태 칸 제목 */
  status: string
  /** 이 라벨로 바뀌면(when: 'leave'면 이 라벨에서 다른 값으로 바뀌면) */
  label: string
  /** 'enter'(기본) — 라벨로 바뀔 때 · 'leave' — 라벨에서 벗어날 때(보류 종료일 등) */
  when?: 'enter' | 'leave'
  /** 오늘(한국 날짜)을 넣을 날짜 칸 제목들 — 날짜만(시각 없이), 이미 오늘이면 그대로 */
  dates: string[]
  /** 옮길 그룹 제목 — 없으면 옮기지 않는다 */
  group?: string
}

export interface TechAssigneeRule {
  board: TechBoardKey
  /** 보는 사람 칸 제목 */
  people: string
  /** 이름을 옮길 글자 칸 제목 */
  text: string
}

// 칸·그룹은 제목으로 찾는다(공백 무시). 못 찾은 칸·그룹·라벨은 오류 로그를 남기고(후보
// 목록과 함께) 찾은 것만 한다. AS 2026 — 수리 진행 상태에 따라 단계별 날짜 칸과 그룹
// (2026-11-09·11-10). 보류에서 다른 상태로 가면 보류 종료일과 새 상태 규칙이 같이 돈다.
const REPAIR_STATUS = '수리 진행 상태'
const REPAIR_NEW = '새로 인입된 건 <접수>'
const REPAIR_WORKING = '현재 진행중인 업무'
export const TECH_STATUS_RULES: readonly TechStatusRule[] = [
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '입고 대기',
    dates: [],
    group: REPAIR_NEW,
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '수령 후 1차 체크',
    dates: ['수령 후 1차 체크'],
    group: REPAIR_WORKING,
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '수리 중',
    dates: ['수리 중'],
    group: REPAIR_WORKING,
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '완료 후 견적 안내',
    dates: ['완료 후 견적 안내'],
    group: '발송 대기',
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '발송 완료',
    dates: ['발송 완료', '완료일'],
    group: '완료',
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '보류',
    dates: ['보류 시작일'],
    group: '보류',
  },
  {
    board: 'repair',
    status: REPAIR_STATUS,
    label: '보류',
    when: 'leave',
    dates: ['보류 종료일'],
  },
]

/** 만들 때 규칙 — 새 item(만든 지 NEW_ITEM_MS 안)의 날짜 칸이 비어 있으면 오늘을 넣는다. item마다
 * 한 번만(규칙 기록의 created). 만들 때 이미 날짜를 넣었으면 그대로 둔다. */
export interface TechCreateRule {
  board: TechBoardKey
  dates: string[]
}

export const TECH_CREATE_RULES: readonly TechCreateRule[] = [
  { board: 'repair', dates: ['접수일'] },
]

// 담당자(엑스툴) 칸이 있는 보드(ASSIGNEE_BOARDS)면 한 줄씩 더해 켤 수 있다.
export const TECH_ASSIGNEE_RULES: readonly TechAssigneeRule[] = [
  { board: 'techInquiry', people: '담당자', text: ASSIGNEE_TITLE },
  { board: 'fieldService', people: '담당자', text: ASSIGNEE_TITLE },
  { board: 'repair', people: '담당자', text: ASSIGNEE_TITLE },
]

const STATE = 'techRuleState'
// 새 item으로 보는 시간 — 기록이 없고 만든 지 이만큼 안 됐으면 "빈 값"에서 바뀐 것으로
// 본다(줄을 추가하며 값을 처음부터 넣은 경우). 그보다 오래된 item에 기록이 없으면
// 지금 값을 기록만 한다(배포·규칙 추가 직후 기존 건이 잘못 처리되지 않게).
const NEW_ITEM_MS = 10 * 60 * 1000
// 수정 기록(techEditLogs)에 남는 이름
const RULE_EDITOR = { email: '', name: '자동화(서버)', uid: 'tech-rules' }
// 기존 기록 확인을 한 번에 읽는 수
const READ_CHUNK = 300
const BATCH_SIZE = 400

/** techRuleState/{itemId} — 규칙이 마지막으로 본 값(보는 칸 id → 글자). 처음에는
 * 상태 칸만 봐서 이름이 statuses다. */
interface RuleState {
  boardKey: TechBoardKey
  statuses: Record<string, string>
  at: number
  /** 만들 때 규칙을 돌렸다(새 item에 한 번) */
  created?: boolean
}

/** 칸·그룹을 찾은 상태 규칙. 날짜 칸이나 그룹 중 일부를 못 찾아도 찾은 쪽은 한다. */
interface ResolvedStatusRule {
  rule: TechStatusRule
  statusId: string
  dates: Array<{ id: string; title: string }>
  groupId: string | null
}

interface ResolvedAssigneeRule {
  rule: TechAssigneeRule
  peopleId: string
  text: { id: string; title: string }
}

interface ResolvedRules {
  status: ResolvedStatusRule[]
  assignee: ResolvedAssigneeRule[]
  /** 만들 때 채울 날짜 칸 */
  create: Array<{ id: string; title: string }>
  /** 보는 칸 id */
  watched: string[]
}

type BoardShape = Pick<TechBoardMeta, 'columns' | 'groups'>
type Column = BoardShape['columns'][number]

// 제목 비교 — 공백·보이지 않는 글자를 빼고, 한글 조합 방식(NFC/NFD) 차이도 없앤다.
const norm = (title: string) =>
  squash(title.normalize('NFC')).replace(/[\u200B-\u200D\uFEFF]/g, '')
const same = (a: string, b: string) => norm(a) === norm(b)

/** 날짜 칸 — 제목이 같은 것, 없으면 제목을 포함하는 날짜 칸이 하나뿐일 때 그것
 * (예: "발송 완료일"). */
function findDateColumn(columns: Column[], title: string): Column | undefined {
  const dates = columns.filter((c) => c.type === 'date')
  const exact = dates.find((c) => same(c.title, title))
  if (exact) return exact
  const near = dates.filter((c) => norm(c.title).includes(norm(title)))
  return near.length === 1 ? near[0] : undefined
}

// 못 찾은 칸 로그는 인스턴스마다 규칙당 한 번만(알림마다 남지 않게).
const reported = new Set<string>()
const reportOnce = (key: string, message: string, detail: object) => {
  if (reported.has(key)) return
  reported.add(key)
  logger.error(message, detail)
}

/** 칸 제목·종류 목록(item 내용 없음) — 제목이 다르면 이것으로 고친다. */
const columnList = (board: BoardShape, keep: (c: Column) => boolean) =>
  board.columns.filter(keep).map((c) => `${c.id}:${c.title}:${c.type}`)

function resolveStatusRules(
  key: TechBoardKey,
  board: BoardShape,
): ResolvedStatusRule[] {
  return TECH_STATUS_RULES.filter((rule) => rule.board === key).flatMap(
    (rule) => {
      const status = board.columns.find(
        (c) => c.type === 'status' && same(c.title, rule.status),
      )
      const found = rule.dates.map((title) => ({
        title,
        column: findDateColumn(board.columns, title),
      }))
      const missing = found.filter((d) => !d.column).map((d) => d.title)
      const group = rule.group ?
        board.groups.find((g) => same(g.title, rule.group as string)) :
        undefined
      // 상태 칸에 그 라벨이 없으면(이름이 다르면) 규칙이 돌 일이 없다 — 라벨 목록을 남긴다.
      const labels = status?.options
      const noLabel = !!labels && !labels.some((l) => same(l, rule.label))
      if (!status || missing.length || (rule.group && !group) || noLabel) {
        reportOnce(
          `${key}:status:${rule.label}:${rule.when ?? 'enter'}`,
          `상태 규칙의 칸·그룹을 못 찾음(${key}):`,
          {
            rule,
            status: !!status,
            ...(missing.length ? {
              missingDates: missing,
              dateCandidates: columnList(board, (c) => c.type === 'date'),
            } : {}),
            ...(rule.group && !group ?
              { groups: board.groups.map((g) => g.title) } :
              {}),
            ...(noLabel ? { labels } : {}),
          },
        )
      }
      const dates = found.flatMap((d) =>
        d.column ? [{ id: d.column.id, title: d.column.title }] : [],
      )
      if (!status || (dates.length === 0 && !group)) return []
      return [{ rule, statusId: status.id, dates, groupId: group?.id ?? null }]
    },
  )
}

function resolveAssigneeRules(
  key: TechBoardKey,
  board: BoardShape,
): ResolvedAssigneeRule[] {
  return TECH_ASSIGNEE_RULES.filter((rule) => rule.board === key).flatMap(
    (rule) => {
      const people = board.columns.find(
        (c) => c.type === 'people' && same(c.title, rule.people),
      )
      const text = board.columns.find(
        (c) => c.type === 'text' && same(c.title, rule.text),
      )
      if (!people || !text) {
        reportOnce(
          `${key}:assignee:${rule.text}`,
          `담당자 규칙의 칸을 못 찾음(${key}):`,
          {
            rule,
            people: !!people,
            text: !!text,
            candidates: columnList(
              board,
              (c) => c.type === 'people' || norm(c.title).includes('담당'),
            ),
          },
        )
        return []
      }
      return [
        {
          rule,
          peopleId: people.id,
          text: { id: text.id, title: text.title },
        },
      ]
    },
  )
}

const hasRules = (key: TechBoardKey) =>
  TECH_STATUS_RULES.some((rule) => rule.board === key) ||
  TECH_ASSIGNEE_RULES.some((rule) => rule.board === key) ||
  TECH_CREATE_RULES.some((rule) => rule.board === key)

function resolveCreateRules(
  key: TechBoardKey,
  board: BoardShape,
): Array<{ id: string; title: string }> {
  return TECH_CREATE_RULES.filter((rule) => rule.board === key).flatMap(
    (rule) =>
      rule.dates.flatMap((title) => {
        const column = findDateColumn(board.columns, title)
        if (!column) {
          reportOnce(
            `${key}:create:${title}`,
            `만들 때 규칙의 칸을 못 찾음(${key}):`,
            {
              title,
              dateCandidates: columnList(board, (c) => c.type === 'date'),
            },
          )
          return []
        }
        return [{ id: column.id, title: column.title }]
      }),
  )
}

function resolveRules(key: TechBoardKey, board: BoardShape): ResolvedRules {
  const status = resolveStatusRules(key, board)
  const assignee = resolveAssigneeRules(key, board)
  const create = resolveCreateRules(key, board)
  const watched = [
    ...new Set([
      ...status.map((r) => r.statusId),
      ...assignee.map((r) => r.peopleId),
    ]),
  ]
  return { status, assignee, create, watched }
}

/** 보는 칸들의 지금 글자 */
const valuesOf = (
  watched: string[],
  doc: TechItemDoc,
): Record<string, string> =>
  Object.fromEntries(watched.map((id) => [id, doc.values[id]?.text ?? '']))

const isRecent = (createdAt: string | null) => {
  const time = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(time) && Date.now() - time < NEW_ITEM_MS
}

const hasKey = (state: RuleState | null, id: string) =>
  !!state?.statuses && Object.prototype.hasOwnProperty.call(state.statuses, id)

/** 한국 날짜 오늘(YYYY-MM-DD) */
const koreaToday = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

/**
 * webhook으로 다시 읽은 item에 규칙을 적용한다. 보는 칸이 바뀌었으면 그 칸의 규칙을
 * 실행한다. 같은 item에 알림이 동시에 와도 기록을 트랜잭션으로 바꿔 한 번만 돈다.
 */
export async function applyBoardRules(
  db: Firestore,
  apiKey: string,
  source: TechBoardSource,
  meta: TechBoardMeta,
  doc: TechItemDoc,
): Promise<void> {
  if (!hasRules(source.key)) return
  const rules = resolveRules(source.key, meta)
  if (rules.watched.length === 0 && rules.create.length === 0) return
  const current = valuesOf(rules.watched, doc)
  const ref = db.collection(STATE).doc(doc.itemId)

  // 바뀐 칸 → 바뀌기 전 글자, 만들 때 규칙을 돌릴지(새 item에 한 번)
  const { changed, createDue } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const state = snap.exists ? (snap.data() as RuleState) : null
    const isNew = isRecent(doc.createdAt)
    // 처음 보는 칸이면 새 item일 때만 빈 값에서 바뀐 것으로 본다.
    const before = (id: string) =>
      state && hasKey(state, id) ? state.statuses[id] : isNew ? '' : current[id]
    const result = new Map<string, string>()
    for (const id of rules.watched) {
      if (before(id) !== current[id]) result.set(id, before(id))
    }
    const unseen = rules.watched.some((id) => !hasKey(state, id))
    const due = rules.create.length > 0 && isNew && !state?.created
    if (unseen || result.size > 0 || due) {
      const next: RuleState = {
        boardKey: source.key,
        statuses: { ...(state?.statuses ?? {}), ...current },
        at: Date.now(),
        ...(state?.created || due ? { created: true } : {}),
      }
      tx.set(ref, next)
    }
    return { changed: result, createDue: due }
  })

  const context = { db, apiKey, source, meta, doc, ref }
  if (createDue) {
    await attempt(context, { created: false }, () =>
      runCreateRule(context, rules.create),
    )
  }
  for (const resolved of rules.status) {
    const before = changed.get(resolved.statusId)
    if (before === undefined) continue
    const { label, when } = resolved.rule
    const entered = same(current[resolved.statusId], label)
    const fire = when === 'leave' ? same(before, label) && !entered : entered
    if (!fire) continue
    await attempt(context, { [`statuses.${resolved.statusId}`]: before }, () =>
      runStatusRule(context, resolved),
    )
  }
  for (const resolved of rules.assignee) {
    const before = changed.get(resolved.peopleId)
    if (before === undefined) continue
    await attempt(context, { [`statuses.${resolved.peopleId}`]: before }, () =>
      runAssigneeRule(context, resolved),
    )
  }
}

interface RuleContext {
  db: Firestore
  apiKey: string
  source: TechBoardSource
  meta: TechBoardMeta
  doc: TechItemDoc
  ref: DocumentReference
}

/** 규칙 하나 실행 — 실패하면 기록을 되돌려(revert — 그 칸의 이전 글자 등) 다음 알림 때
 * 다시 해 보게 하고 수정 기록에 실패를 남긴다. */
async function attempt(
  context: RuleContext,
  revert: Record<string, unknown>,
  run: () => Promise<void>,
): Promise<void> {
  const { db, source, meta, doc, ref } = context
  try {
    await run()
  } catch (error) {
    await ref.update(revert).catch(() => undefined)
    logger.error(`보드 규칙 실행 실패(${doc.itemId}):`, error)
    await addEditLog(db, {
      ...logBase(source, meta, doc),
      changes: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const logBase = (
  source: TechBoardSource,
  meta: TechBoardMeta,
  doc: TechItemDoc,
) => ({
  at: Date.now(),
  action: 'update' as const,
  boardKey: source.key,
  boardName: meta.name,
  itemId: doc.itemId,
  itemName: doc.name,
  by: RULE_EDITOR,
})

const shapeOf = (source: TechBoardSource) => ({
  subitems: !!source.subitems,
  updates: !!source.updates,
})

/** 상태 규칙 — 날짜 칸들에 오늘, 그룹 옮기기. 이미 그렇게 돼 있으면 쓰지 않는다
 * (Monday 자동화를 끄기 전 잠깐 같이 돌 때 두 번 쓰지 않게). */
async function runStatusRule(
  { db, apiKey, source, meta, doc }: RuleContext,
  resolved: ResolvedStatusRule,
): Promise<void> {
  const today = koreaToday()
  const { groupId } = resolved
  const textOf = (id: string) => doc.values[id]?.text ?? ''
  const dates = resolved.dates.filter(
    (d) => textOf(d.id).slice(0, 10) !== today,
  )
  const needsMove = !!groupId && doc.groupId !== groupId
  if (dates.length === 0 && !needsMove) return

  const shape = shapeOf(source)
  let raw: TechRawItem | null = null
  if (dates.length > 0) {
    raw = await changeColumnValues(
      apiKey,
      source.boardId,
      doc.itemId,
      Object.fromEntries(dates.map((d) => [d.id, { date: today }])),
      needsMove ? undefined : shape,
    )
  }
  if (groupId && needsMove) {
    raw = await moveItemToGroup(apiKey, doc.itemId, groupId, shape)
  }
  // 화면이 바로 보게 쓰기 응답으로 캐시를 맞춘다(뒤이은 webhook도 맞춘다).
  if (raw) await saveRawItems(db, source, meta, [doc.itemId], [raw])

  const groupTitle = (id: string | null) =>
    meta.groups.find((g) => g.id === id)?.title ?? id
  const changes: TechChange[] = [
    ...dates.map((d) => ({
      field: d.id,
      title: d.title,
      before: textOf(d.id) || null,
      after: today,
    })),
    ...(needsMove ?
      [
        {
          field: 'group',
          title: '진행 단계',
          before: groupTitle(doc.groupId),
          after: groupTitle(groupId),
        },
      ] :
      []),
  ]
  await addEditLog(db, { ...logBase(source, meta, doc), changes, ok: true })
}

/** 만들 때 규칙 — 비어 있는 날짜 칸에 오늘(한국 날짜)을 넣는다. */
async function runCreateRule(
  { db, apiKey, source, meta, doc }: RuleContext,
  dates: Array<{ id: string; title: string }>,
): Promise<void> {
  const today = koreaToday()
  const empty = dates.filter((d) => !(doc.values[d.id]?.text ?? '').trim())
  if (empty.length === 0) return
  const raw = await changeColumnValues(
    apiKey,
    source.boardId,
    doc.itemId,
    Object.fromEntries(empty.map((d) => [d.id, { date: today }])),
    shapeOf(source),
  )
  if (raw) await saveRawItems(db, source, meta, [doc.itemId], [raw])
  await addEditLog(db, {
    ...logBase(source, meta, doc),
    changes: empty.map((d) => ({
      field: d.id,
      title: d.title,
      before: null,
      after: today,
    })),
    ok: true,
  })
}

/** 담당자 규칙 — 사람 칸에 보이는 이름을 글자 칸에 덮어쓴다(비었으면 비운다). 이미
 * 같으면 쓰지 않는다. */
async function runAssigneeRule(
  { db, apiKey, source, meta, doc }: RuleContext,
  resolved: ResolvedAssigneeRule,
): Promise<void> {
  const names = peopleNames(doc.values[resolved.peopleId]?.text ?? '').join(
    ', ',
  )
  const textBefore = (doc.values[resolved.text.id]?.text ?? '').trim()
  if (textBefore === names) return
  const raw = await changeColumnValues(
    apiKey,
    source.boardId,
    doc.itemId,
    { [resolved.text.id]: names },
    shapeOf(source),
  )
  if (raw) await saveRawItems(db, source, meta, [doc.itemId], [raw])
  await addEditLog(db, {
    ...logBase(source, meta, doc),
    changes: [
      {
        field: resolved.text.id,
        title: resolved.text.title,
        before: textBefore || null,
        after: names || null,
      },
    ],
    ok: true,
  })
}

/**
 * 동기화 때 규칙 기록이 없는 item(또는 기록에 없는 칸)에 지금 값을 기록만 한다(규칙은
 * 돌리지 않는다). 배포나 규칙 추가 뒤 "지금 동기화"로 한 번 채우면 그 뒤로 우리
 * 화면에서 고친 것도 바뀐 것으로 잡힌다. 이미 기록된 칸은 건드리지 않는다 — 동기화가
 * 알림보다 먼저 새 값을 읽어 기록을 덮으면 그 변경을 놓친다.
 */
export async function seedRuleStates(
  db: Firestore,
  key: TechBoardKey,
  board: BoardShape,
  docs: TechItemDoc[],
): Promise<number> {
  if (!hasRules(key)) return 0
  const { watched } = resolveRules(key, board)
  if (watched.length === 0) return 0
  const missing: TechItemDoc[] = []
  const partial: Array<{ doc: TechItemDoc; ids: string[] }> = []
  for (let i = 0; i < docs.length; i += READ_CHUNK) {
    const chunk = docs.slice(i, i + READ_CHUNK)
    const snaps = await db.getAll(
      ...chunk.map((doc) => db.collection(STATE).doc(doc.itemId)),
    )
    snaps.forEach((snap, j) => {
      if (!snap.exists) {
        missing.push(chunk[j])
        return
      }
      const state = snap.data() as RuleState
      const ids = watched.filter((id) => !hasKey(state, id))
      if (ids.length > 0) partial.push({ doc: chunk[j], ids })
    })
  }
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of missing.slice(i, i + BATCH_SIZE)) {
      const state: RuleState = {
        boardKey: key,
        statuses: valuesOf(watched, doc),
        at: Date.now(),
      }
      // 사이에 webhook이 먼저 만들었으면 덮지 않게 create로 쓴다.
      batch.create(db.collection(STATE).doc(doc.itemId), state)
    }
    await batch.commit().catch((error) => {
      logger.warn(`규칙 기록 채우기 일부 실패(${key}):`, error)
    })
  }
  for (let i = 0; i < partial.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const { doc, ids } of partial.slice(i, i + BATCH_SIZE)) {
      // 없는 칸만 더한다(merge — 이미 있는 칸은 그대로).
      batch.set(
        db.collection(STATE).doc(doc.itemId),
        { statuses: valuesOf(ids, doc) },
        { merge: true },
      )
    }
    await batch.commit().catch((error) => {
      logger.warn(`규칙 기록 채우기 일부 실패(${key}):`, error)
    })
  }
  return missing.length + partial.length
}
