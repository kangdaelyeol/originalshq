import { useSyncExternalStore } from 'react'
import {
  createTechItem,
  deleteTechItems,
  MAX_DELETE,
  updateTechItem,
  type TechBoardKey,
  type TechCellValue,
  type TechConflict,
  type TechEditInput,
  type TechEditValue,
  type TechItemDoc,
  type TechSubitemDoc,
} from './tech-boards'
import { dismissToast, hasToast, markSaving, pushToast, setToast } from './tech-save-queue'

// 저장 대기열 — 고친 것은 화면에 바로 보이고(RTDB처럼) Monday에는 뒤에서 쓴다.
//
// · 보드 저장소(tech-boards-store)가 캐시 위에 여기 '대기 중 변경'을 덮어 그려서 보드·내 업무·개요가
//   같은 값을 본다. 변경은 서버가 받은 뒤 캐시가 그 값으로 바뀌면(또는 잠시 뒤) 뗀다.
// · 항목마다 한 번에 요청 하나 — 나가 있는 동안 고친 것은 모아 다음 요청 하나로 보낸다(같은 칸은
//   마지막 값). 순서가 뒤집히지 않는다. 다른 항목끼리는 같이 나간다.
// · 새 항목은 임시 id(temp-N)로 바로 줄이 생기고 고칠 수 있다. 그 사이 고친 것은 만들어진 뒤 보낸다.
// · 성공은 조용히(상단바 "저장 중 · 모두 저장됨"), 실패만 토스트 — 원래 값으로 돌아가고 "다시 시도".
// · 겹침 — 칸을 처음 고칠 때 본 캐시 값을 같이 보낸다. 그사이 다른 사람이 같은 칸을 바꿨으면 서버가
//   그 칸만 쓰지 않고 알려 준다 → 그 사람 값으로 돌아가고 토스트에 "내 값으로 덮기".

const TEMP = 'temp-'
export const isTempId = (id: string): boolean => id.startsWith(TEMP)

/** 서버가 받은 뒤 캐시가 안 바뀌어도 먼저 보여 준 값을 떼는 시간 */
const GRACE_MS = 3000

/** 칸 하나 고치기 — preview는 저장이 끝나기 전 칸에 보여 줄 모양(없으면 캐시 값 그대로) */
export interface CellEdit {
  value: TechEditValue
  preview?: TechCellValue
}

export interface PendingEdit {
  name?: string
  groupId?: string
  columns?: Record<string, CellEdit>
  subitems?: TechEditInput['subitems']
  /** 고친 하위 아이템 칸에 저장 전 보여 줄 값 — 하위 아이템 id → 칸 id → 값(없는 칸은 캐시 값 그대로) */
  subitemPreviews?: Record<string, Record<string, TechCellValue>>
  /** 겹침 확인 없이 덮어쓰기("내 값으로 덮기") */
  force?: boolean
}

/**
 * 먼저 보여 주는 값 하나 — 열쇠는 'name' · 'group' · 'c:<칸 id>' · 's:<번호>'(새 하위 아이템) ·
 * 'sn:<id>'·'sc:<id>:<칸 id>'·'sd:<id>'(하위 아이템 이름·칸·지우기)
 */
interface Patch {
  value: TechCellValue | string
  seq: number
  acked: boolean
  ackedAt: number
  /** 서버가 받은 때의 캐시 값 — 그 뒤 캐시가 바뀌면 뗀다 */
  rawAtAck: string
}

/** 보낼 것 — 모은 수정 한 번 */
interface Outgoing {
  create: boolean
  name?: string
  groupId?: string
  columns: Record<string, TechEditValue>
  subitems?: TechEditInput['subitems']
  /** 담은 열쇠와 그 차례 — 끝나면 이 차례까지의 미리 보기를 확인하거나 되돌린다 */
  seqs: Map<string, number>
  previews: Map<string, TechCellValue | string>
  /** 열쇠마다 고치기 전에 본 캐시 글자(겹침 확인) */
  base: Map<string, string | null>
  labels: string[]
}

interface ItemState {
  boardKey: TechBoardKey
  /** 처음 열쇠 — 임시 id 또는 Monday id */
  key: string
  realId: string | null
  /** 이 탭에서 만드는 항목 — 캐시에 오기 전까지 표에 그릴 모양 */
  created: {
    name: string
    groupId: string | null
    createdAt: string
    /** 만들 때 캐시에 있던 id — 응답보다 캐시가 먼저 오면 새로 생긴 줄을 이걸로 알아본다 */
    before: ReadonlySet<string> | null
  } | null
  patches: Map<string, Patch>
  /** 지우는 중(acked: 서버가 지웠다 — 캐시에서 빠질 때까지 숨긴다) */
  hidden: { acked: boolean } | null
  /** 만드는 중에 지웠다 — 만들어지면 지운다 */
  deleteAfterCreate: boolean
  queued: Outgoing | null
  inFlight: Outgoing | null
}

const states = new Map<string, ItemState>()
// 이 탭에서 만든 항목 — Monday id ↔ 임시 id(줄 열쇠가 바뀌지 않게, 그룹 맨 아래에 그대로 두게)
const tempOf = new Map<string, string>()
const realOf = new Map<string, string>()
const rawIndex = new Map<TechBoardKey, ReadonlyMap<string, TechItemDoc>>()
let seqNo = 0
let tempNo = 0
let subNo = 0
let deleting = 0

// ── 알림 ───────────────────────────────────────────────────────────────────────

type Listener = (boardKey: TechBoardKey) => void
const boardListeners = new Set<Listener>()
const statusListeners = new Set<() => void>()

/** 보드 저장소가 듣는다 — 그 보드를 다시 그린다. */
export function onPendingChange(listener: Listener): () => void {
  boardListeners.add(listener)
  return () => boardListeners.delete(listener)
}

export interface SyncStatus {
  /** 보내는 중이거나 보낼 차례를 기다리는 항목 수 */
  saving: number
  /** 마지막으로 저장을 마친 때(이 탭에서 저장한 적이 없으면 null) */
  savedAt: number | null
}

let status: SyncStatus = { saving: 0, savedAt: null }
let savedAt: number | null = null

const warnBeforeLeave = (e: BeforeUnloadEvent) => e.preventDefault()

function emitStatus() {
  let saving = deleting
  for (const s of states.values()) if (s.queued || s.inFlight) saving++
  if (saving !== status.saving || savedAt !== status.savedAt) {
    // 안 보낸 수정이 있으면 창을 닫기 전에 묻는다.
    if (saving > 0 && status.saving === 0) window.addEventListener('beforeunload', warnBeforeLeave)
    if (saving === 0 && status.saving > 0) window.removeEventListener('beforeunload', warnBeforeLeave)
    status = { saving, savedAt }
    statusListeners.forEach((listener) => listener())
  }
}

function emit(boardKey: TechBoardKey) {
  boardListeners.forEach((listener) => listener(boardKey))
  emitStatus()
}

export const useSyncStatus = (): SyncStatus =>
  useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    () => status,
  )

// ── 실패 토스트 — 같은 제목은 하나로 모아 건수를 센다 ─────────────────────────────

const failures = new Map<string, { toastId: number; count: number; retries: (() => void)[] }>()

const errorText = (error: unknown) =>
  // 함수 오류 문구 끝의 상태 코드 꼬리표([500])는 뗀다.
  (error instanceof Error ? error.message : String(error)).replace(/(\s*\[\d+\])+$/, '')

function reportFailure(title: string, error: unknown, retry: () => void) {
  notify(title, errorText(error), '다시 시도', retry)
}

function notify(title: string, message: string, actionLabel: string, retry: () => void) {
  const prev = failures.get(title)
  const entry = prev && hasToast(prev.toastId) ? prev : { toastId: 0, count: 0, retries: [] as (() => void)[] }
  entry.count++
  entry.retries.push(retry)
  const toast = {
    tone: 'error' as const,
    title,
    message: entry.count > 1 ? `${entry.count}건 — ${message}` : message,
    action: {
      label: actionLabel,
      run: () => {
        dismissToast(entry.toastId)
        failures.delete(title)
        entry.retries.forEach((run) => run())
      },
    },
  }
  if (entry.toastId) setToast(entry.toastId, toast)
  else entry.toastId = pushToast(toast)
  failures.set(title, entry)
}

// ── 캐시와 맞추기 ───────────────────────────────────────────────────────────────

const cellKey = (cell: TechCellValue | undefined) => `${cell?.text ?? ''}\u0000${cell?.value ?? ''}`

/** 고친·지운 하위 아이템 열쇠 — 'sn:<id>' 이름 · 'sc:<id>:<칸 id>' 칸 · 'sd:<id>' 지우기 */
const isSubEdit = (field: string) => /^s[ncd]:/.test(field)

/** 고친·지운 하위 아이템 열쇠 → 종류(sn·sc·sd)·하위 아이템·칸 id */
function subField(field: string, raw: TechItemDoc | undefined) {
  const [kind, subId, columnId = ''] = field.split(':')
  return { kind, subId, columnId, sub: raw?.subitems?.find((s) => s.id === subId) }
}

/** 캐시에 지금 적힌 값(열쇠 하나) */
function rawText(field: string, raw: TechItemDoc | undefined): string {
  if (!raw) return ''
  if (field === 'name') return raw.name
  if (field === 'group') return raw.groupId ?? ''
  if (field.startsWith('c:')) return cellKey(raw.values[field.slice(2)])
  if (isSubEdit(field)) {
    const { kind, subId, columnId, sub } = subField(field, raw)
    if (kind === 'sd') return sub ? subId : ''
    return kind === 'sn' ? (sub?.name ?? '') : cellKey(sub?.values[columnId])
  }
  return (raw.subitems ?? []).map((sub) => sub.id).join(',')
}

/** 겹침 확인에 보낼 캐시 글자 — 서버가 캐시와 같은 방법으로 비교한다(edits.ts findConflicts). */
function baseText(field: string, raw: TechItemDoc): string | null {
  if (field === 'name') return raw.name
  if (field === 'group') return raw.groupId ?? null
  return raw.values[field.slice(2)]?.text ?? ''
}

/** 캐시가 먼저 보여 준 값과 같아졌는지(글자로) */
function sameAsRaw(field: string, patch: Patch, raw: TechItemDoc | undefined): boolean {
  if (!raw) return false
  if (field === 'name') return raw.name === patch.value
  if (field === 'group') return raw.groupId === patch.value
  if (field.startsWith('c:')) return (raw.values[field.slice(2)]?.text ?? '') === (patch.value as TechCellValue).text
  if (isSubEdit(field)) {
    const { kind, columnId, sub } = subField(field, raw)
    if (kind === 'sd') return !sub
    if (kind === 'sn') return sub?.name === patch.value
    return (sub?.values[columnId]?.text ?? '') === (patch.value as TechCellValue).text
  }
  return false
}

const rawOf = (s: ItemState) => (s.realId ? rawIndex.get(s.boardKey)?.get(s.realId) : undefined)

function link(s: ItemState, realId: string) {
  s.realId = realId
  tempOf.set(realId, s.key)
  realOf.set(s.key, realId)
}

/** 응답보다 캐시가 먼저 오면 — 만들 때 없던 줄 중 이름·그룹이 같은 것을 그 항목으로 본다. */
function tryClaim(s: ItemState) {
  const created = s.created
  const raw = rawIndex.get(s.boardKey)
  if (!created?.before || !raw || s.realId) return
  for (const item of raw.values()) {
    if (created.before.has(item.itemId) || tempOf.has(item.itemId)) continue
    if (item.name !== created.name || (created.groupId && item.groupId !== created.groupId)) continue
    link(s, item.itemId)
    return
  }
}

const idle = (s: ItemState) =>
  !s.queued &&
  !s.inFlight &&
  s.patches.size === 0 &&
  !s.hidden &&
  !s.deleteAfterCreate &&
  (!s.created || !!rawOf(s))

/** 떼어도 되는 것을 뗀다 — 바뀐 게 있으면 true */
function sweep(boardKey: TechBoardKey): boolean {
  const now = Date.now()
  let changed = false
  for (const s of [...states.values()]) {
    if (s.boardKey !== boardKey) continue
    if (s.created && !s.realId) {
      tryClaim(s)
      if (s.realId) changed = true
    }
    const raw = rawOf(s)
    for (const [field, patch] of s.patches) {
      if (!patch.acked) continue
      if (now - patch.ackedAt >= GRACE_MS || rawText(field, raw) !== patch.rawAtAck || sameAsRaw(field, patch, raw)) {
        s.patches.delete(field)
        changed = true
      }
    }
    if (s.hidden?.acked && !raw) {
      s.hidden = null
      changed = true
    }
    if (idle(s)) {
      states.delete(s.key)
      changed = true
    }
  }
  return changed
}

/** 보드 저장소가 캐시를 새로 받을 때마다 부른다(그 뒤에 applyPending). */
export function observeRaw(boardKey: TechBoardKey, items: readonly TechItemDoc[]): void {
  rawIndex.set(boardKey, new Map(items.map((item) => [item.itemId, item])))
  if (sweep(boardKey)) emitStatus()
}

// ── 덮어 그리기 ─────────────────────────────────────────────────────────────────

function patched(item: TechItemDoc, s: ItemState | undefined, localKey: string | undefined): TechItemDoc {
  if (!s?.patches.size) return localKey ? { ...item, localKey } : item
  const values = { ...item.values }
  let { name, groupId } = item
  const subs: TechSubitemDoc[] = []
  // 고친 하위 아이템(id → 덮을 이름·칸) · 지운 하위 아이템 id
  const subEdits = new Map<string, { name?: string; values: Record<string, TechCellValue> }>()
  const subGone = new Set<string>()
  for (const [field, patch] of s.patches) {
    if (field === 'name') name = patch.value as string
    else if (field === 'group') groupId = patch.value as string
    else if (field.startsWith('c:')) values[field.slice(2)] = patch.value as TechCellValue
    else if (field.startsWith('s:')) subs.push({ id: `${s.key}:${field}`, name: patch.value as string, values: {} })
    else {
      const { kind, subId, columnId } = subField(field, undefined)
      if (kind === 'sd') subGone.add(subId)
      else {
        const edit = subEdits.get(subId) ?? { values: {} }
        if (kind === 'sn') edit.name = patch.value as string
        else edit.values[columnId] = patch.value as TechCellValue
        subEdits.set(subId, edit)
      }
    }
  }
  const subitems =
    subs.length || subEdits.size || subGone.size
      ? [
          ...(item.subitems ?? [])
            .filter((sub) => !subGone.has(sub.id))
            .map((sub) => {
              const edit = subEdits.get(sub.id)
              return edit ? { ...sub, name: edit.name ?? sub.name, values: { ...sub.values, ...edit.values } } : sub
            }),
          ...subs,
        ]
      : null
  return {
    ...item,
    name,
    groupId,
    values,
    ...(subitems ? { subitems } : {}),
    ...(localKey ? { localKey } : {}),
  }
}

/** 만드는 중인 하위 아이템(아직 Monday id가 없다) — 다 만들어지기 전에는 고치거나 지울 수 없다. */
export const isDraftSubitem = (id: string): boolean => /:s:\d+$/.test(id)

/** 아직 캐시에 없는 새 항목 — 표에 그릴 모양만(record는 비어 있다, draft) */
function draftDoc(s: ItemState): TechItemDoc {
  const created = s.created!
  const itemId = s.realId ?? s.key
  return {
    itemId,
    boardKey: s.boardKey,
    boardId: '',
    name: created.name,
    groupId: created.groupId,
    record: { itemId, name: created.name } as unknown as TechItemDoc['record'],
    values: {},
    subitems: [],
    updateCount: 0,
    createdAt: created.createdAt,
    updatedAt: created.createdAt,
    syncedAt: 0,
    draft: true,
  }
}

/** 캐시 항목 위에 대기 중 변경을 덮는다 — 지우는 중은 빼고, 만드는 중은 붙인다. */
export function applyPending(boardKey: TechBoardKey, raw: TechItemDoc[]): TechItemDoc[] {
  const mine = [...states.values()].filter((s) => s.boardKey === boardKey)
  if (mine.length === 0 && tempOf.size === 0) return raw
  const byReal = new Map(mine.filter((s) => s.realId).map((s) => [s.realId!, s]))
  const out: TechItemDoc[] = []
  for (const item of raw) {
    const s = byReal.get(item.itemId)
    if (s?.hidden) continue
    out.push(patched(item, s, tempOf.get(item.itemId)))
  }
  for (const s of mine) {
    if (!s.created || s.hidden || rawOf(s)) continue
    out.push(patched(draftDoc(s), s, s.key))
  }
  return out
}

// ── 보내기 ──────────────────────────────────────────────────────────────────────

const emptyOutgoing = (create = false): Outgoing => ({
  create,
  columns: {},
  seqs: new Map(),
  previews: new Map(),
  base: new Map(),
  labels: [],
})

function mergeSubitems(
  a: TechEditInput['subitems'],
  b: TechEditInput['subitems'],
): TechEditInput['subitems'] {
  if (!a) return b
  if (!b) return a
  const update = new Map((a.update ?? []).map((u) => [u.id, u]))
  for (const u of b.update ?? []) update.set(u.id, { ...update.get(u.id), ...u, columns: { ...update.get(u.id)?.columns, ...u.columns } })
  const remove = [...new Set([...(a.remove ?? []), ...(b.remove ?? [])])]
  return {
    create: [...(a.create ?? []), ...(b.create ?? [])],
    // 지울 줄은 고치지 않는다 — 서버는 지운 뒤에 고치므로 같이 보내면 실패한다.
    update: [...update.values()].filter((u) => !u.id || !remove.includes(u.id)),
    remove,
  }
}

/** 고친 것을 보낼 것에 모으고 먼저 보여 줄 값을 건다. */
function mergeInto(s: ItemState, out: Outgoing, edit: PendingEdit, label: string) {
  if (!out.labels.includes(label)) out.labels.push(label)
  const raw = rawOf(s)
  const show = (field: string, value: TechCellValue | string | undefined) => {
    // 고치기 전에 본 값 — 이 칸을 처음 고칠 때만 싣는다. 이어 고친 것(아직 저장 중인 내 값 위)은
    // 앞 요청이 이미 확인했다.
    const chained = s.patches.has(field) || s.inFlight?.seqs.has(field) || out.base.has(field)
    if (raw && !edit.force && !chained && !field.startsWith('s:') && !isSubEdit(field)) out.base.set(field, baseText(field, raw))
    const seq = ++seqNo
    out.seqs.set(field, seq)
    if (value === undefined) {
      // 미리 보기 없이 고친 칸 — 먼저 걸어 둔 옛 미리 보기는 뗀다.
      s.patches.delete(field)
      return
    }
    out.previews.set(field, value)
    s.patches.set(field, { value, seq, acked: false, ackedAt: 0, rawAtAck: '' })
  }
  if (edit.name !== undefined) {
    out.name = edit.name
    show('name', edit.name)
  }
  if (edit.groupId !== undefined) {
    out.groupId = edit.groupId
    show('group', edit.groupId)
  }
  for (const [id, cell] of Object.entries(edit.columns ?? {})) {
    out.columns[id] = cell.value
    show(`c:${id}`, cell.preview)
  }
  if (edit.subitems) {
    out.subitems = mergeSubitems(out.subitems, edit.subitems)
    for (const sub of edit.subitems.create ?? []) if (sub.name) show(`s:${++subNo}`, sub.name)
    // 고친·지운 하위 아이템도 바로 보인다(칸은 미리 보기를 준 것만).
    for (const sub of edit.subitems.update ?? []) {
      if (!sub.id) continue
      if (sub.name !== undefined) show(`sn:${sub.id}`, sub.name)
      for (const id of Object.keys(sub.columns ?? {})) show(`sc:${sub.id}:${id}`, edit.subitemPreviews?.[sub.id]?.[id])
    }
    for (const id of edit.subitems.remove ?? []) show(`sd:${id}`, id)
  }
}

/**
 * 보낸 것을 다시 고친 것으로(다시 시도·내 값으로 덮기) — 그 뒤에 또 고친 칸은 새 값이 이미 나갈
 * 차례라 뺀다. only를 주면 그 열쇠만(하위 아이템은 빼고).
 */
function editFrom(s: ItemState | undefined, out: Outgoing, only?: ReadonlySet<string>): PendingEdit {
  const take = (field: string) =>
    (!only || only.has(field)) && (s?.patches.get(field)?.seq ?? 0) <= (out.seqs.get(field) ?? 0)
  const edit: PendingEdit = { columns: {} }
  if (out.name !== undefined && take('name')) edit.name = out.name
  if (out.groupId !== undefined && take('group')) edit.groupId = out.groupId
  for (const [id, value] of Object.entries(out.columns)) {
    if (take(`c:${id}`)) edit.columns![id] = { value, preview: out.previews.get(`c:${id}`) as TechCellValue | undefined }
  }
  if (out.subitems && !only) {
    // 하위 아이템도 그 뒤에 또 고친 이름·칸은 빼고, 칸 미리 보기를 다시 건다.
    const update = (out.subitems.update ?? []).flatMap((u) => {
      const columns = Object.fromEntries(Object.entries(u.columns ?? {}).filter(([id]) => take(`sc:${u.id}:${id}`)))
      const name = u.name !== undefined && take(`sn:${u.id}`) ? u.name : undefined
      if (name === undefined && Object.keys(columns).length === 0) return []
      return [{ id: u.id, ...(name !== undefined ? { name } : {}), columns }]
    })
    const { create = [], remove = [] } = out.subitems
    if (create.length || update.length || remove.length) edit.subitems = { create, update, remove }
    const previews: NonNullable<PendingEdit['subitemPreviews']> = {}
    for (const [field, value] of out.previews) {
      if (!field.startsWith('sc:')) continue
      const { subId, columnId } = subField(field, undefined)
      previews[subId] = { ...previews[subId], [columnId]: value as TechCellValue }
    }
    edit.subitemPreviews = previews
  }
  return edit
}

const hasChanges = (edit: PendingEdit) =>
  edit.name !== undefined || edit.groupId !== undefined || Object.keys(edit.columns ?? {}).length > 0 || !!edit.subitems

const labelOf = (out: Outgoing) => (out.labels.length > 1 ? `${out.labels[0]} 외 ${out.labels.length - 1}건` : (out.labels[0] ?? '항목'))

function toInput(s: ItemState, out: Outgoing): TechEditInput {
  const base: NonNullable<TechEditInput['base']> = {}
  for (const [field, text] of out.base) {
    if (field === 'name') base.name = text ?? ''
    else if (field === 'group') base.groupId = text
    else (base.columns ??= {})[field.slice(2)] = text ?? ''
  }
  return {
    boardKey: s.boardKey,
    ...(out.create ? {} : { itemId: s.realId! }),
    ...(out.name !== undefined ? { name: out.name } : {}),
    ...(out.groupId !== undefined ? { groupId: out.groupId } : {}),
    columns: out.columns,
    ...(out.subitems ? { subitems: out.subitems } : {}),
    ...(out.base.size > 0 && !out.create ? { base } : {}),
  }
}

/** 서버가 알려 준 칸 이름 → 열쇠 */
const fieldOf = (conflict: TechConflict) =>
  conflict.field === 'name' ? 'name' : conflict.field === 'group' ? 'group' : `c:${conflict.field}`

function flush(s: ItemState) {
  if (s.inFlight || !s.queued) return
  // 지우는 중이면 보내지 않는다.
  if (s.hidden) {
    s.queued = null
    return
  }
  // 아직 만드는 중 — 만들어지면 다시 부른다.
  if (!s.queued.create && !s.realId) return
  const out = s.queued
  s.queued = null
  s.inFlight = out
  if (s.realId) markSaving(s.realId, true)
  // 만들기는 겹침이 없다(conflicts 없음).
  const request: Promise<{ data: { itemId: string | null; conflicts?: TechConflict[] } }> = out.create
    ? createTechItem(toInput(s, out))
    : updateTechItem(toInput(s, out))
  request.then(
    (res) => settle(s, out, res.data.itemId, res.data.conflicts ?? []),
    (error: unknown) => fail(s, out, error),
  )
}

function settle(s: ItemState, out: Outgoing, itemId: string | null, conflicts: TechConflict[] = []) {
  s.inFlight = null
  if (s.realId) markSaving(s.realId, false)
  if (out.create) {
    if (itemId) link(s, itemId)
    if (!s.realId) {
      // 만들었지만 다시 읽지 못했다 — 뒤에 고친 것은 보낼 곳이 없다.
      fail(s, out, new Error('만든 항목을 Monday에서 찾지 못했어요. 새로고침해 주세요'))
      return
    }
  }
  const now = Date.now()
  const raw = rawOf(s)
  const skipped = new Set(conflicts.map(fieldOf))
  for (const [field, seq] of out.seqs) {
    const patch = s.patches.get(field)
    if (patch?.seq !== seq) continue
    // 다른 사람이 먼저 바꾼 칸 — 내 값을 떼고 그 사람 값(캐시)을 보여 준다.
    if (skipped.has(field)) {
      s.patches.delete(field)
      continue
    }
    patch.acked = true
    patch.ackedAt = now
    patch.rawAtAck = rawText(field, raw)
  }
  if (conflicts.length > 0) {
    const label = labelOf(out)
    notify(
      `${label} — 다른 사람이 먼저 바꿨어요`,
      conflicts.map((c) => `${c.title}: ${c.theirs ?? '(빈 칸)'}`).join(' · '),
      '내 값으로 덮기',
      () => {
        const edit = editFrom(states.get(s.key), out, skipped)
        if (hasChanges(edit)) editItem(s.boardKey, s.realId ?? s.key, { ...edit, force: true }, label)
      },
    )
  }
  savedAt = now
  setTimeout(() => {
    if (sweep(s.boardKey)) emit(s.boardKey)
  }, GRACE_MS + 50)
  if (s.deleteAfterCreate) {
    s.deleteAfterCreate = false
    sendDeletes(s.boardKey, [s])
  }
  sweep(s.boardKey)
  flush(s)
  emit(s.boardKey)
}

function fail(s: ItemState, out: Outgoing, error: unknown) {
  s.inFlight = null
  if (s.realId) markSaving(s.realId, false)
  // 이 요청이 건 미리 보기를 뗀다(그 뒤에 또 고친 칸은 남긴다).
  for (const [field, seq] of out.seqs) if (s.patches.get(field)?.seq === seq) s.patches.delete(field)
  const deleted = !!s.hidden || s.deleteAfterCreate
  if (out.create) {
    // 만들지 못했다 — 줄을 빼고, 그 사이 고친 것까지 모아 "다시 시도"에 싣는다.
    const later = s.queued
    states.delete(s.key)
    if (!deleted) {
      const edit = editFrom(undefined, out)
      if (later) Object.assign(edit.columns!, editFrom(undefined, later).columns)
      const name = later?.name ?? out.name ?? s.created?.name ?? ''
      reportFailure(`${name} — 만들지 못했어요`, error, () =>
        createItem(s.boardKey, { ...edit, name, groupId: later?.groupId ?? out.groupId }, labelOf(out)),
      )
    }
  } else if (!deleted) {
    reportFailure(`${labelOf(out)} — 저장하지 못했어요`, error, () => {
      const edit = editFrom(states.get(s.key), out)
      if (hasChanges(edit)) editItem(s.boardKey, s.realId ?? s.key, edit, labelOf(out))
    })
  }
  sweep(s.boardKey)
  if (states.has(s.key)) flush(s)
  emit(s.boardKey)
}

/** 항목 상태 — 이 탭에서 만든 항목은 Monday id로 불러도 임시 id 쪽을 찾는다. */
function stateFor(boardKey: TechBoardKey, id: string): ItemState | null {
  const existing = states.get(id) ?? states.get(tempOf.get(id) ?? '') ?? states.get(realOf.get(id) ?? '')
  if (existing) return existing
  // 지나간 임시 id — 만들어졌으면 Monday id로, 아니면(만들지 못함) 할 일이 없다.
  const realId = isTempId(id) ? realOf.get(id) : id
  if (!realId) return null
  const s: ItemState = {
    boardKey,
    key: realId,
    realId,
    created: null,
    patches: new Map(),
    hidden: null,
    deleteAfterCreate: false,
    queued: null,
    inFlight: null,
  }
  states.set(realId, s)
  return s
}

// ── 화면이 부르는 것 ────────────────────────────────────────────────────────────

/** 항목 고치기 — 바로 보이고 뒤에서 보낸다. id는 Monday id나 임시 id(만드는 중인 줄). */
export function editItem(boardKey: TechBoardKey, id: string, edit: PendingEdit, label: string): void {
  const s = stateFor(boardKey, id)
  if (!s || s.hidden) return
  s.queued ??= emptyOutgoing()
  mergeInto(s, s.queued, edit, label)
  emit(boardKey)
  flush(s)
}

/** 새 항목 — 임시 id로 바로 줄이 생긴다. 임시 id를 돌려준다. */
export function createItem(boardKey: TechBoardKey, edit: PendingEdit & { name: string }, label = edit.name): string {
  const key = `${TEMP}${++tempNo}`
  const raw = rawIndex.get(boardKey)
  const s: ItemState = {
    boardKey,
    key,
    realId: null,
    created: {
      name: edit.name,
      groupId: edit.groupId ?? null,
      createdAt: new Date().toISOString(),
      before: raw ? new Set(raw.keys()) : null,
    },
    patches: new Map(),
    hidden: null,
    deleteAfterCreate: false,
    queued: { ...emptyOutgoing(true), name: edit.name, groupId: edit.groupId },
    inFlight: null,
  }
  states.set(key, s)
  mergeInto(s, s.queued!, { columns: edit.columns, subitems: edit.subitems }, label)
  emit(boardKey)
  flush(s)
  return key
}

/** 여러 항목을 그룹으로 옮기기 */
export function moveItems(boardKey: TechBoardKey, ids: string[], groupId: string): void {
  for (const id of ids) editItem(boardKey, id, { groupId }, '그룹 이동')
}

/** 지우기 — 표에서 바로 빠지고 Monday 휴지통으로 보낸다. 만드는 중인 줄은 만들어진 뒤 지운다. */
export function deleteItems(boardKey: TechBoardKey, ids: string[]): void {
  const ready: ItemState[] = []
  for (const id of ids) {
    const s = stateFor(boardKey, id)
    if (!s || s.hidden) continue
    s.hidden = { acked: false }
    s.queued = null
    if (s.created && s.inFlight?.create) s.deleteAfterCreate = true
    else if (s.realId) ready.push(s)
  }
  emit(boardKey)
  sendDeletes(boardKey, ready)
}

function sendDeletes(boardKey: TechBoardKey, list: ItemState[]) {
  if (list.length === 0) return
  deleting += list.length
  emitStatus()
  void (async () => {
    const failed: ItemState[] = []
    for (let i = 0; i < list.length; i += MAX_DELETE) {
      const chunk = list.slice(i, i + MAX_DELETE)
      const bad = await deleteTechItems(boardKey, chunk.map((s) => s.realId!)).then(
        (result) => new Set(result.failed.map((f) => f.itemId)),
        () => new Set(chunk.map((s) => s.realId!)),
      )
      for (const s of chunk) {
        if (bad.has(s.realId!)) failed.push(s)
        else if (s.hidden) s.hidden.acked = true
      }
    }
    deleting -= list.length
    for (const s of failed) s.hidden = null
    savedAt = Date.now()
    sweep(boardKey)
    emit(boardKey)
    const done = list.length - failed.length
    if (done > 0) {
      pushToast({ tone: 'success', title: `${done}건을 지웠어요`, message: 'Monday 휴지통에 있어요 — 30일 안에는 되살릴 수 있어요.' })
    }
    if (failed.length > 0) {
      reportFailure('일부를 지우지 못했어요', new Error(`${list.length}건 중 ${failed.length}건`), () =>
        deleteItems(boardKey, failed.map((s) => s.realId!)),
      )
    }
  })()
}
