import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { normalizeEmail } from '@/xtool-auth/members'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { addDays, koreaToday } from '../lib/dates'
import type { TechBoardKey, TechColumn, TechItemDoc } from './tech-boards'

// 보드 보기 — 보드마다 이름 붙여 저장해 두는 거르기(조건)·정렬·숨길 칸. 기술팀 모두가 같이 보고 만들고
// 고치고 지운다(Monday 보드의 "보기" 탭). Firestore techBoardViews에 화면이 직접 쓰고, 규칙이 모양을 본다
// (firestore.rules). 조건은 캐시에 적힌 칸 글자(text)로 맞춘다 — 레이아웃과 상관없이 같은 결과.

const VIEWS = 'techBoardViews'

/** 이름 칸·그룹을 조건에 쓸 때의 칸 id */
export const NAME_COLUMN = 'name'
export const GROUP_COLUMN = '__group'

export type ViewOp =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'notContains'
  | 'empty'
  | 'notEmpty'
  | 'checked'
  | 'unchecked'
  | 'eq'
  | 'gt'
  | 'lt'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'past'
  | 'future'

export interface ViewRule {
  columnId: string
  op: ViewOp
  /** 고른 값(is·isNot) 또는 적은 값 하나(contains·eq 등). 나머지 조건은 빈 배열 */
  values: string[]
}

export type ViewSort = { columnId: string; dir: 1 | -1 } | null

/** 보기에 저장하는 것 — 모달이 고친다 */
export interface BoardViewSpec {
  name: string
  /** all: 조건을 모두 만족 · any: 하나라도 */
  match: 'all' | 'any'
  rules: ViewRule[]
  sort: ViewSort
  /** 숨길 칸 id */
  hidden: string[]
}

export interface BoardView extends BoardViewSpec {
  id: string
  board: TechBoardKey
  createdBy: string
  /** ms — 탭 순서(먼저 만든 것부터) */
  createdAt: number
  updatedBy: string
}

export const VIEW_LIMITS = { name: 40, rules: 20, hidden: 80 } as const

// ── 조건 종류 ────────────────────────────────────────────────────────────────

/** 칸 타입 → 조건 종류. choice는 고를 값 목록이 있는 칸(여러 값이면 ", "로 나뉜다) */
export type RuleKind = 'choice' | 'check' | 'date' | 'number' | 'file' | 'text'

const CHOICE_TYPES = new Set(['status', 'dropdown', 'people', 'assignee', 'board_relation'])
/** 한 칸에 값이 여럿 들어가는 타입 — 글자를 ", "로 나눠 본다 */
const MULTI_TYPES = new Set(['dropdown', 'people', 'assignee', 'board_relation'])

export function ruleKind(column: Pick<TechColumn, 'id' | 'type'>): RuleKind {
  if (column.id === GROUP_COLUMN || CHOICE_TYPES.has(column.type)) return 'choice'
  if (column.type === 'checkbox') return 'check'
  if (column.type === 'date') return 'date'
  if (column.type === 'numbers') return 'number'
  if (column.type === 'file') return 'file'
  return 'text'
}

export const OPS_BY_KIND: Record<RuleKind, readonly { op: ViewOp; label: string }[]> = {
  choice: [
    { op: 'is', label: '다음 중 하나' },
    { op: 'isNot', label: '다음이 아님' },
    { op: 'empty', label: '비어 있음' },
    { op: 'notEmpty', label: '비어 있지 않음' },
  ],
  check: [
    { op: 'checked', label: '체크됨' },
    { op: 'unchecked', label: '체크 안 됨' },
  ],
  date: [
    { op: 'today', label: '오늘' },
    { op: 'thisWeek', label: '이번 주' },
    { op: 'thisMonth', label: '이번 달' },
    { op: 'past', label: '오늘 전(지남)' },
    { op: 'future', label: '오늘 뒤(남음)' },
    { op: 'empty', label: '비어 있음' },
    { op: 'notEmpty', label: '비어 있지 않음' },
  ],
  number: [
    { op: 'eq', label: '=' },
    { op: 'gt', label: '보다 큼' },
    { op: 'lt', label: '보다 작음' },
    { op: 'empty', label: '비어 있음' },
    { op: 'notEmpty', label: '비어 있지 않음' },
  ],
  file: [
    { op: 'notEmpty', label: '파일 있음' },
    { op: 'empty', label: '파일 없음' },
  ],
  text: [
    { op: 'contains', label: '포함' },
    { op: 'notContains', label: '포함하지 않음' },
    { op: 'empty', label: '비어 있음' },
    { op: 'notEmpty', label: '비어 있지 않음' },
  ],
}

/** 값을 고르는 조건(is·isNot) · 값을 적는 조건(contains·eq …) · 값이 없는 조건 */
export const opInput = (op: ViewOp): 'pick' | 'type' | 'none' =>
  op === 'is' || op === 'isNot' ? 'pick' : op === 'contains' || op === 'notContains' || op === 'eq' || op === 'gt' || op === 'lt' ? 'type' : 'none'

// ── 맞추기 ───────────────────────────────────────────────────────────────────

const splitValues = (text: string | undefined): string[] =>
  (text ?? '').split(', ').map((s) => s.trim()).filter(Boolean)

/** 그 칸에서 고를 값들 — 상태·드롭다운은 Monday 라벨, 여러 값 칸은 나눠서 */
export const cellChoices = (column: TechColumn, item: TechItemDoc, groupId: string): string[] => {
  if (column.id === GROUP_COLUMN) return [groupId]
  const text = item.values[column.id]?.text?.trim() ?? ''
  return MULTI_TYPES.has(column.type) ? splitValues(text) : text ? [text] : []
}

const cellText = (column: TechColumn, item: TechItemDoc): string =>
  column.id === NAME_COLUMN ? item.name : (item.values[column.id]?.text ?? '').trim()

const isChecked = (item: TechItemDoc, columnId: string) => {
  const cell = item.values[columnId]
  if (cell?.text === 'v') return true
  try {
    const checked = (JSON.parse(cell?.value ?? 'null') as { checked?: unknown } | null)?.checked
    return checked === true || checked === 'true'
  } catch {
    return false
  }
}

const hasFiles = (item: TechItemDoc, columnId: string) => Boolean(item.values[columnId]?.text?.trim())

/** 이번 주 월요일(한국 날짜) */
const weekStart = (today: string) => addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))

/** 아직 다 고르지 않은 조건(값을 안 고름·안 적음) — 거르지 않는다 */
export const ruleReady = (rule: ViewRule): boolean => opInput(rule.op) === 'none' || rule.values.some((v) => v.trim())

function matchRule(rule: ViewRule, column: TechColumn, item: TechItemDoc, groupId: string, today: string): boolean {
  switch (rule.op) {
    case 'is':
    case 'isNot': {
      const has = cellChoices(column, item, groupId).some((v) => rule.values.includes(v))
      return rule.op === 'is' ? has : !has
    }
    case 'checked':
      return isChecked(item, column.id)
    case 'unchecked':
      return !isChecked(item, column.id)
  }
  const kind = ruleKind(column)
  if (kind === 'file') return rule.op === 'empty' ? !hasFiles(item, column.id) : hasFiles(item, column.id)
  const text = kind === 'choice' ? cellChoices(column, item, groupId).join(', ') : cellText(column, item)
  if (rule.op === 'empty') return !text
  if (rule.op === 'notEmpty') return Boolean(text)
  if (kind === 'date') {
    const date = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0]
    if (!date) return false
    if (rule.op === 'today') return date === today
    if (rule.op === 'thisWeek') return date >= weekStart(today) && date <= addDays(weekStart(today), 6)
    if (rule.op === 'thisMonth') return date.slice(0, 7) === today.slice(0, 7)
    if (rule.op === 'past') return date < today
    if (rule.op === 'future') return date > today
    return true
  }
  if (kind === 'number') {
    const n = Number(text.replace(/,/g, ''))
    const target = Number((rule.values[0] ?? '').replace(/,/g, ''))
    if (!text || !Number.isFinite(n) || !Number.isFinite(target)) return false
    return rule.op === 'eq' ? n === target : rule.op === 'gt' ? n > target : n < target
  }
  const needle = (rule.values[0] ?? '').trim().toLowerCase()
  const found = text.toLowerCase().includes(needle)
  return rule.op === 'notContains' ? !found : found
}

/**
 * 보기 조건으로 거르기. columns는 조건에 쓸 수 있는 칸(이름·그룹 칸 포함 — viewColumns), groupOf는 항목의 그룹 id.
 * 모르는 칸(보드에서 지워진 칸)·덜 고른 조건은 건너뛴다.
 */
export function applyViewRules(
  items: TechItemDoc[],
  spec: Pick<BoardViewSpec, 'match' | 'rules'>,
  columns: TechColumn[],
  groupOf: (item: TechItemDoc) => string,
): TechItemDoc[] {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const rules = spec.rules.filter((r) => byId.has(r.columnId) && ruleReady(r))
  if (rules.length === 0) return items
  const today = koreaToday()
  return items.filter((item) => {
    const groupId = groupOf(item)
    const test = (rule: ViewRule) => matchRule(rule, byId.get(rule.columnId)!, item, groupId, today)
    return spec.match === 'any' ? rules.some(test) : rules.every(test)
  })
}

// ── 목록(실시간) ─────────────────────────────────────────────────────────────

interface ViewsState {
  views: BoardView[] | null
  error: string | null
}

let state: ViewsState = { views: null, error: null }
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const millis = (value: unknown): number =>
  value && typeof value === 'object' && 'toMillis' in value ? (value as { toMillis: () => number }).toMillis() : Date.now()

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])

function toView(id: string, data: Record<string, unknown>): BoardView {
  const sort = data.sort as { columnId?: unknown; dir?: unknown } | null | undefined
  return {
    id,
    board: data.board as TechBoardKey,
    name: String(data.name ?? ''),
    match: data.match === 'any' ? 'any' : 'all',
    rules: (Array.isArray(data.rules) ? data.rules : []).flatMap((raw) => {
      const r = raw as { columnId?: unknown; op?: unknown; values?: unknown }
      return typeof r.columnId === 'string' && typeof r.op === 'string'
        ? [{ columnId: r.columnId, op: r.op as ViewOp, values: strings(r.values) }]
        : []
    }),
    sort: sort && typeof sort.columnId === 'string' ? { columnId: sort.columnId, dir: sort.dir === -1 ? -1 : 1 } : null,
    hidden: strings(data.hidden),
    createdBy: String(data.createdBy ?? ''),
    // 방금 만든 것(서버 시각을 아직 모른다)은 맨 뒤로
    createdAt: millis(data.createdAt),
    updatedBy: String(data.updatedBy ?? ''),
  }
}

function ensureViews() {
  if (unsubscribe) return
  unsubscribe = onSnapshot(
    collection(xtoolFirebase().db, VIEWS),
    (snap) => {
      state = { error: null, views: snap.docs.map((d) => toView(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt) }
      emit()
    },
    (error) => {
      unsubscribe?.()
      unsubscribe = null
      state = { views: state.views, error: error.code === 'permission-denied' ? '보기를 볼 권한이 없어요.' : error.message }
      emit()
    },
  )
}

/** 그 보드의 보기 — 먼저 만든 것부터. views가 null이면 아직 받는 중. */
export function useBoardViews(board: TechBoardKey): { views: BoardView[] | null; error: string | null } {
  useEffect(() => ensureViews(), [])
  const all = useSyncExternalStore(subscribe, () => state)
  return useMemo(
    () => ({ views: all.views?.filter((v) => v.board === board) ?? null, error: all.error }),
    [all, board],
  )
}

// ── 만들기·고치기·지우기 ─────────────────────────────────────────────────────

const me = () => normalizeEmail(xtoolFirebase().auth.currentUser?.email ?? '')

/** 저장할 모양으로 다듬기 — 이름 자르기, 덜 고른 조건 빼기, 한도 */
const clean = (spec: BoardViewSpec) => ({
  name: spec.name.trim().slice(0, VIEW_LIMITS.name),
  match: spec.match,
  rules: spec.rules
    .filter(ruleReady)
    .slice(0, VIEW_LIMITS.rules)
    .map((r) => ({ columnId: r.columnId, op: r.op, values: r.values.map((v) => v.trim()).filter(Boolean) })),
  sort: spec.sort ? { columnId: spec.sort.columnId, dir: spec.sort.dir } : null,
  hidden: [...new Set(spec.hidden)].slice(0, VIEW_LIMITS.hidden),
})

/** 새 보기 — 새 문서 id */
export async function createBoardView(board: TechBoardKey, spec: BoardViewSpec): Promise<string> {
  const email = me()
  const ref = await addDoc(collection(xtoolFirebase().db, VIEWS), {
    board,
    ...clean(spec),
    createdBy: email,
    createdAt: serverTimestamp(),
    updatedBy: email,
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateBoardView(id: string, spec: BoardViewSpec): Promise<void> {
  await updateDoc(doc(xtoolFirebase().db, VIEWS, id), { ...clean(spec), updatedBy: me(), updatedAt: serverTimestamp() })
}

export async function deleteBoardView(id: string): Promise<void> {
  await deleteDoc(doc(xtoolFirebase().db, VIEWS, id))
}
