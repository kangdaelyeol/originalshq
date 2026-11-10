import { useSyncExternalStore } from 'react'
import { errorText } from './error-text'
import {
  createTechItem,
  deleteTechItems,
  MAX_DELETE,
  updateTechItem,
  type TechBoardKey,
  type TechBoardMeta,
  type TechCellValue,
  type TechConflict,
  type TechEditInput,
  type TechEditValue,
  type TechItemDoc,
  type TechSubitemDoc,
  type TechSubitemEdit,
} from './tech-boards'
import { columnLabel, initialState, toEditValue, type LocationState } from './tech-edit'
import { dismissToast, hasToast, markSaving, pushToast, setToast } from './tech-save-queue'
import { revertText, undoText, type UndoChange } from './undo-text'

// 저장 대기열 — 고친 것은 화면에 바로 보이고(RTDB처럼) Monday에는 뒤에서 쓴다.
//
// · 보드 저장소(tech-boards-store)가 캐시 위에 여기 '대기 중 변경'을 덮어 그려서 보드·내 업무·개요가
//   같은 값을 본다. 변경은 서버가 받은 뒤 캐시가 그 값으로 바뀌면(또는 잠시 뒤) 뗀다.
// · 항목마다 한 번에 요청 하나 — 나가 있는 동안 고친 것은 모아 다음 요청 하나로 보낸다(같은 칸은
//   마지막 값). 순서가 뒤집히지 않는다. 다른 항목끼리는 같이 나간다.
// · 새 항목은 임시 id(temp-N)로 바로 줄이 생기고 고칠 수 있다. 그 사이 고친 것은 만들어진 뒤 보낸다.
// · 새 하위 줄도 같다 — "만드는 중" 줄(id '<항목>:s:N')을 바로 고치거나 지울 수 있다. 만들기를 아직 안 보냈으면
//   그 만들기에 싣고, 보내는 중이면 만들어진 뒤(서버가 돌려준 Monday id로 바꿔) 보낸다.
// · 고치면 "…을 …로 수정했어요 · 되돌리기" 토스트(아래 되돌리기), 저장 상태는 상단바("저장 중 · 모두 저장됨").
//   실패는 토스트 — 원래 값으로 돌아가고 "다시 시도".
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
 * 'sn:<id>'·'sc:<id>:<칸 id>'·'sd:<id>'(하위 아이템 이름·칸·지우기 — 만드는 중인 줄은 id 대신 'd<번호>')
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
  /** subitems.create 줄마다 붙인 번호(s:<번호>) — 응답의 createdSubitems와 같은 순서 */
  subCreates: number[]
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
  /** 이 탭에서 만든 하위 줄 — 번호(s:<번호>) → Monday id */
  subReal: Map<number, string>
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

function emitStatus() {
  let saving = deleting
  for (const s of states.values()) if (s.queued || s.inFlight) saving++
  if (saving !== status.saving || savedAt !== status.savedAt) {
    status = { saving, savedAt }
    statusListeners.forEach((listener) => listener())
  }
}

function emit(boardKey: TechBoardKey) {
  boardListeners.forEach((listener) => listener(boardKey))
  emitStatus()
}

/** 저장 상태 — 안 보낸 수정이 있으면 창을 닫기 전에 묻는 것은 플랫폼이 한다(웹 lib/warn-before-leave). */
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

function reportFailure(title: string, error: unknown, retry: () => void) {
  // 함수 오류 문구 끝의 상태 코드 꼬리표([500])는 겹친 것까지 뗀다.
  notify(title, errorText(error, { allTails: true }), '다시 시도', retry)
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
  // 새로 만드는 하위 줄 — 번호와 이름
  const drafts: { no: number; name: string }[] = []
  // 고친 하위 아이템(id 또는 'd<번호>' → 덮을 이름·칸) · 지운 하위 아이템
  const subEdits = new Map<string, { name?: string; values: Record<string, TechCellValue> }>()
  const subGone = new Set<string>()
  for (const [field, patch] of s.patches) {
    if (field === 'name') name = patch.value as string
    else if (field === 'group') groupId = patch.value as string
    else if (field.startsWith('c:')) values[field.slice(2)] = patch.value as TechCellValue
    else if (field.startsWith('s:')) drafts.push({ no: Number(field.slice(2)), name: patch.value as string })
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
  if (!drafts.length && !subEdits.size && !subGone.size) {
    return { ...item, name, groupId, values, ...(localKey ? { localKey } : {}) }
  }
  // 만든 하위 줄의 Monday id → 만드는 중에 쓰던 열쇠('d<번호>') — 그때 고친 값을 실제 줄에도 덮는다.
  const draftKey = new Map([...s.subReal].map(([no, id]) => [id, `d${no}`]))
  const gone = (...keys: (string | undefined)[]) => keys.some((key) => key !== undefined && subGone.has(key))
  const withEdits = (sub: TechSubitemDoc, ...keys: (string | undefined)[]): TechSubitemDoc => {
    let out = sub
    for (const key of keys) {
      const edit = key === undefined ? undefined : subEdits.get(key)
      if (edit) out = { ...out, name: edit.name ?? out.name, values: { ...out.values, ...edit.values } }
    }
    return out
  }
  const rawIds = new Set((item.subitems ?? []).map((sub) => sub.id))
  const subitems = [
    ...(item.subitems ?? [])
      .filter((sub) => !gone(sub.id, draftKey.get(sub.id)))
      .map((sub) => withEdits(sub, draftKey.get(sub.id), sub.id)),
    ...drafts.flatMap(({ no, name: draftName }) => {
      const realId = s.subReal.get(no)
      // 캐시에 실제 줄이 왔으면 그 줄이 대신한다.
      if (realId && rawIds.has(realId)) return []
      if (gone(`d${no}`, realId)) return []
      // Monday id를 받았으면 그 id로(그 뒤로 고치는 것은 바로 그 줄로 간다), 아니면 만드는 중 열쇠로
      const sub: TechSubitemDoc = { id: realId ?? `${s.key}:s:${no}`, name: draftName, values: {} }
      return [withEdits(sub, `d${no}`, realId)]
    }),
  ]
  return {
    ...item,
    name,
    groupId,
    values,
    subitems,
    ...(localKey ? { localKey } : {}),
  }
}

/** 만드는 중인 하위 아이템(아직 Monday id가 없다) — 고치거나 지울 수 있다(만들어진 뒤 보낸다). 고르기만 안 된다. */
export const isDraftSubitem = (id: string): boolean => /:s:\d+$/.test(id)

/** 만드는 중인 하위 아이템 id → 번호(s:<번호>) */
const draftNo = (id: string | undefined): number | null => {
  const match = id ? /:s:(\d+)$/.exec(id) : null
  return match ? Number(match[1]) : null
}

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
  subCreates: [],
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
    // 고친·지운 하위 아이템도 바로 보인다(칸은 미리 보기를 준 것만). 만드는 중인 줄은 열쇠가 'd<번호>'.
    const previews = edit.subitemPreviews ?? {}
    const showUpdate = (key: string, sub: TechSubitemEdit, preview: Record<string, TechCellValue> | undefined) => {
      if (sub.name !== undefined) show(`sn:${key}`, sub.name)
      for (const id of Object.keys(sub.columns ?? {})) show(`sc:${key}:${id}`, preview?.[id])
    }
    const update: TechSubitemEdit[] = []
    const remove: string[] = []
    for (const sub of edit.subitems.update ?? []) {
      if (!sub.id) continue
      const ref = resolveDraft(s, out, sub.id)
      if (ref.kind === 'real') {
        update.push(ref.id === sub.id ? sub : { ...sub, id: ref.id })
        showUpdate(ref.id, sub, previews[sub.id])
      } else if (ref.kind === 'queued') {
        // 아직 안 보낸 만들기 — 그 만들기 줄에 싣는다(서버는 고치기를 만들기보다 먼저 해서 따로 보내면 실패한다).
        foldIntoCreate(out, ref.index, sub)
        if (sub.name !== undefined) show(`s:${ref.no}`, sub.name)
        showUpdate(`d${ref.no}`, { columns: sub.columns }, previews[sub.id])
      } else if (ref.kind === 'inFlight') {
        // 만드는 중 — 만들어지면(settle) Monday id로 바꿔 보낸다.
        update.push(sub)
        showUpdate(`d${ref.no}`, sub, previews[sub.id])
      }
      // lost — 만들지 못한 줄: 버린다(실패 토스트의 "다시 시도"가 만들기와 함께 다시 보낸다).
    }
    for (const id of edit.subitems.remove ?? []) {
      const ref = resolveDraft(s, out, id)
      if (ref.kind === 'real') {
        remove.push(ref.id)
        show(`sd:${ref.id}`, ref.id)
      } else if (ref.kind === 'queued') {
        dropQueuedCreate(s, out, ref.index, ref.no)
      } else if (ref.kind === 'inFlight') {
        remove.push(id)
        show(`sd:d${ref.no}`, id)
      }
    }
    const create = [...(edit.subitems.create ?? [])]
    out.subitems = mergeSubitems(out.subitems, { create, update, remove })
    for (const sub of create) {
      const no = ++subNo
      out.subCreates.push(no)
      if (sub.name) show(`s:${no}`, sub.name)
    }
  }
}

/** 하위 아이템 id가 가리키는 것 — 실제 줄(Monday id) · 아직 안 보낸 만들기(out 안) · 보내는 중인 만들기 · 잃은 줄 */
type DraftRef =
  | { kind: 'real'; id: string }
  | { kind: 'queued'; no: number; index: number }
  | { kind: 'inFlight'; no: number }
  | { kind: 'lost' }

function resolveDraft(s: ItemState, out: Outgoing, id: string): DraftRef {
  const no = draftNo(id)
  if (no === null) return { kind: 'real', id }
  const realId = s.subReal.get(no)
  if (realId) return { kind: 'real', id: realId }
  const index = out.subCreates.indexOf(no)
  if (index >= 0) return { kind: 'queued', no, index }
  if (s.inFlight?.subCreates.includes(no)) return { kind: 'inFlight', no }
  return { kind: 'lost' }
}

/** 아직 안 보낸 만들기 줄에 이름·칸을 덮는다. */
function foldIntoCreate(out: Outgoing, index: number, sub: TechSubitemEdit) {
  const create = out.subitems?.create
  const row = create?.[index]
  if (!create || !row) return
  create[index] = {
    ...row,
    ...(sub.name !== undefined ? { name: sub.name } : {}),
    columns: { ...row.columns, ...sub.columns },
  }
}

/** 아직 안 보낸 만들기 줄을 뺀다 — 만드는 중에 지운 줄(그 줄의 미리 보기도 뗀다). */
function dropQueuedCreate(s: ItemState, out: Outgoing, index: number, no: number) {
  out.subitems?.create?.splice(index, 1)
  out.subCreates.splice(index, 1)
  forgetDraft(s, out, no)
}

/** 만드는 중인 줄 하나의 미리 보기('s:<번호>'·'d<번호>' 열쇠)를 out에서 뗀다. */
function forgetDraft(s: ItemState, out: Outgoing | null, no: number) {
  const mine = (field: string) => field === `s:${no}` || (/^s[ncd]:/.test(field) && field.split(':')[1] === `d${no}`)
  for (const field of [...s.patches.keys()]) if (mine(field)) s.patches.delete(field)
  if (!out) return
  for (const field of [...out.seqs.keys()]) if (mine(field)) out.seqs.delete(field)
  for (const field of [...out.previews.keys()]) if (mine(field)) out.previews.delete(field)
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

/** 보낼 것이 하나도 없는지 — 만들기는 늘 보낸다. */
const isEmptyOutgoing = (out: Outgoing) =>
  !out.create &&
  out.name === undefined &&
  out.groupId === undefined &&
  Object.keys(out.columns).length === 0 &&
  !out.subitems?.create?.length &&
  !out.subitems?.update?.length &&
  !out.subitems?.remove?.length

function flush(s: ItemState) {
  if (s.inFlight || !s.queued) return
  // 지우는 중이면 보내지 않는다.
  if (s.hidden) {
    s.queued = null
    return
  }
  // 아직 만드는 중 — 만들어지면 다시 부른다.
  if (!s.queued.create && !s.realId) return
  // 보낼 게 남지 않았다(만드는 중에 만들고 지운 하위 줄 등) — 빈 요청은 보내지 않는다.
  if (isEmptyOutgoing(s.queued)) {
    s.queued = null
    emitStatus()
    return
  }
  const out = s.queued
  s.queued = null
  s.inFlight = out
  if (s.realId) markSaving(s.realId, true)
  // 만들기는 겹침이 없다(conflicts 없음).
  const request: Promise<{
    data: { itemId: string | null; conflicts?: TechConflict[]; createdSubitems?: string[] }
  }> = out.create ? createTechItem(toInput(s, out)) : updateTechItem(toInput(s, out))
  request.then(
    (res) => settle(s, out, res.data.itemId, res.data.conflicts ?? [], res.data.createdSubitems),
    (error: unknown) => fail(s, out, error),
  )
}

function settle(
  s: ItemState,
  out: Outgoing,
  itemId: string | null,
  conflicts: TechConflict[] = [],
  createdSubitems?: string[],
) {
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
  mapDrafts(s, out, createdSubitems)
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
  // 만들지 못한 하위 줄 — 그 사이 그 줄에 고친 것은 다음 요청에서 빼서 "다시 시도"의 만들기에 싣는다.
  const drafts = takeDrafts(s, out.subCreates)
  const deleted = !!s.hidden || s.deleteAfterCreate
  if (out.create) {
    // 만들지 못했다 — 줄을 빼고, 그 사이 고친 것까지 모아 "다시 시도"에 싣는다.
    const later = s.queued
    states.delete(s.key)
    if (!deleted) {
      const edit = withDraftEdits(editFrom(undefined, out), out.subCreates, drafts)
      if (later) Object.assign(edit.columns!, editFrom(undefined, later).columns)
      const name = later?.name ?? out.name ?? s.created?.name ?? ''
      reportFailure(`${name} — 만들지 못했어요`, error, () =>
        createItem(s.boardKey, { ...edit, name, groupId: later?.groupId ?? out.groupId }, labelOf(out)),
      )
    }
  } else if (!deleted) {
    reportFailure(`${labelOf(out)} — 저장하지 못했어요`, error, () => {
      const edit = withDraftEdits(editFrom(states.get(s.key), out), out.subCreates, drafts)
      // 다시 보내기라 되돌리기 알림은 띄우지 않는다.
      if (hasChanges(edit)) submitEdit(s.boardKey, s.realId ?? s.key, edit, labelOf(out), false)
    })
  }
  sweep(s.boardKey)
  if (states.has(s.key)) flush(s)
  emit(s.boardKey)
}

/**
 * 만든 하위 줄의 Monday id(createdSubitems — 보낸 만들기 순서)를 번호에 잇고, 그 사이 그 줄에 고친 것(다음 요청에
 * '<항목>:s:<번호>'로 담겨 있다)을 Monday id로 바꾼다. id를 받지 못했으면(예전 서버) 보낼 곳이 없어 떼고 알린다.
 */
function mapDrafts(s: ItemState, out: Outgoing, created: string[] | undefined) {
  if (out.subCreates.length === 0) return
  if (created && created.length === out.subCreates.length) {
    out.subCreates.forEach((no, i) => s.subReal.set(no, created[i]))
  }
  const queued = s.queued
  if (!queued?.subitems) return
  const lost = new Set<number>()
  const toReal = (id: string): string | null => {
    const no = draftNo(id)
    if (no === null) return id
    const realId = s.subReal.get(no) ?? null
    if (!realId) lost.add(no)
    return realId
  }
  const remove = (queued.subitems.remove ?? []).flatMap((id) => {
    const realId = toReal(id)
    return realId ? [realId] : []
  })
  const update = (queued.subitems.update ?? []).flatMap((sub) => {
    if (!sub.id) return [sub]
    const id = toReal(sub.id)
    // 지울 줄은 고치지 않는다(mergeSubitems와 같다).
    return id && !remove.includes(id) ? [{ ...sub, id }] : []
  })
  queued.subitems = { create: queued.subitems.create ?? [], update, remove }
  for (const no of lost) forgetDraft(s, queued, no)
  if (lost.size > 0) {
    pushToast({
      tone: 'error',
      title: '새 줄에 고친 내용을 보내지 못했어요',
      message: '만든 줄을 찾지 못했어요 — 새로고침한 뒤 다시 고쳐 주세요.',
    })
  }
}

/** 만드는 중에 고친 것 — 이름·칸·지우기 */
interface DraftEdit {
  name?: string
  columns: Record<string, TechEditValue>
  removed: boolean
}

/** 만들지 못한 하위 줄(번호들)에 고친 것을 다음 요청에서 빼 온다(미리 보기도 뗀다). */
function takeDrafts(s: ItemState, nos: readonly number[]): Map<number, DraftEdit> {
  const taken = new Map<number, DraftEdit>()
  const queued = s.queued
  if (nos.length === 0) return taken
  const mine = (id: string | undefined) => {
    const no = draftNo(id)
    return no !== null && nos.includes(no) ? no : null
  }
  const entry = (no: number) => taken.get(no) ?? { columns: {}, removed: false }
  if (queued?.subitems) {
    for (const sub of queued.subitems.update ?? []) {
      const no = mine(sub.id)
      if (no === null) continue
      const edit = entry(no)
      taken.set(no, { ...edit, ...(sub.name !== undefined ? { name: sub.name } : {}), columns: { ...edit.columns, ...sub.columns } })
    }
    for (const id of queued.subitems.remove ?? []) {
      const no = mine(id)
      if (no !== null) taken.set(no, { ...entry(no), removed: true })
    }
    queued.subitems = {
      create: queued.subitems.create ?? [],
      update: (queued.subitems.update ?? []).filter((sub) => mine(sub.id) === null),
      remove: (queued.subitems.remove ?? []).filter((id) => mine(id) === null),
    }
  }
  for (const no of nos) forgetDraft(s, queued, no)
  return taken
}

/** "다시 시도"의 만들기 줄에 만드는 중에 고친 것을 싣는다(지운 줄은 뺀다). nos는 만들기 줄 순서의 번호. */
function withDraftEdits(edit: PendingEdit, nos: readonly number[], drafts: ReadonlyMap<number, DraftEdit>): PendingEdit {
  const create = edit.subitems?.create
  if (!create || drafts.size === 0) return edit
  const rows = create.flatMap((row, i) => {
    const draft = drafts.get(nos[i])
    if (!draft) return [row]
    if (draft.removed) return []
    return [{ ...row, ...(draft.name !== undefined ? { name: draft.name } : {}), columns: { ...row.columns, ...draft.columns } }]
  })
  return { ...edit, subitems: { ...edit.subitems, create: rows } }
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
    subReal: new Map(),
  }
  states.set(realId, s)
  return s
}

// ── 화면이 부르는 것 ────────────────────────────────────────────────────────────

/** 항목 고치기 — 바로 보이고 뒤에서 보낸다. id는 Monday id나 임시 id(만드는 중인 줄). "되돌리기" 토스트를 띄운다. */
export function editItem(boardKey: TechBoardKey, id: string, edit: PendingEdit, label: string): void {
  submitEdit(boardKey, id, edit, label, true)
}

/** 고치기 — undoable이면 고치기 전 보이던 값을 잡아 두고 "되돌리기" 토스트를 띄운다(되돌리기·다시 보내기는 끈다). */
function submitEdit(boardKey: TechBoardKey, id: string, edit: PendingEdit, label: string, undoable: boolean): void {
  const s = stateFor(boardKey, id)
  if (!s || s.hidden) return
  const before = undoable ? shownDoc(s) : null
  s.queued ??= emptyOutgoing()
  const firstNew = s.queued.subCreates.length
  mergeInto(s, s.queued, edit, label)
  // 이번에 새로 만든 하위 줄 — 되돌리면 지운다(만드는 중 열쇠로 — 만들어진 뒤면 Monday id로 바뀐다)
  const drafts = s.queued.subCreates.slice(firstNew).map((no) => `${s.key}:s:${no}`)
  emit(boardKey)
  flush(s)
  if (before) {
    const entry = invertEdit(s, before, edit, drafts)
    if (entry) recordUndo(entry)
  }
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
    subReal: new Map(),
  }
  states.set(key, s)
  mergeInto(s, s.queued!, { columns: edit.columns, subitems: edit.subitems }, label)
  emit(boardKey)
  flush(s)
  recordUndo({ boardKey, id: key, inverse: null, itemName: edit.name, changes: [{ kind: 'create' }] })
  return key
}

/** 여러 항목을 그룹으로 옮기기 — 되돌리기 토스트는 하나로 */
export function moveItems(boardKey: TechBoardKey, ids: string[], groupId: string): void {
  undoBatch = []
  try {
    for (const id of ids) editItem(boardKey, id, { groupId }, '그룹 이동')
  } finally {
    const batch = undoBatch
    undoBatch = null
    if (batch.length > 0) announceUndo(batch)
  }
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

// ── 되돌리기 ───────────────────────────────────────────────────────────────────
// 고칠 때마다 "…을 …로 수정했어요 · 되돌리기" 토스트(성공, UNDO_MS 동안). 되돌리기는 고치기 전에 보이던 값(캐시 +
// 대기 중 변경)을 같은 대기열로 다시 보낸다 — 항목마다 순서가 뒤집히지 않는다. 토스트는 하나라 새로 고치면 그것으로
// 바뀐다(마지막 것만 되돌린다). 새 항목은 되돌리면 지우고(휴지통), 새 하위 줄은 지운다. 되돌릴 수 없는 것(하위 줄
// 지우기·칸 정보가 없는 칸·좌표 없는 주소)이 섞인 고치기는 토스트를 띄우지 않는다. 서버 보드 규칙(상태 → 그룹·날짜
// 칸)이 한 일은 되돌리지 않는다 — 되돌린 상태로 규칙이 다시 돈다.

const UNDO_MS = 6000
const EMPTY_CELL: TechCellValue = { text: '', value: null }

/** 되돌릴 것 하나 — inverse가 null이면 새 항목(지운다) */
interface UndoEntry {
  boardKey: TechBoardKey
  id: string
  inverse: PendingEdit | null
  itemName: string
  changes: UndoChange[]
}

// 칸 정보(제목·종류) — 되돌릴 값을 Monday 값에서 다시 만들 때 쓴다. 보드 저장소가 넣는다.
const metaIndex = new Map<TechBoardKey, TechBoardMeta>()
let undoToast = 0
// 여러 항목을 한 번에 고칠 때(그룹 옮기기) 모아서 토스트 하나로
let undoBatch: UndoEntry[] | null = null

/** 보드 저장소가 보드 정보(techBoardMeta)를 새로 받을 때마다 부른다 — 되돌리기가 칸 종류를 안다. */
export function observeMeta(boardKey: TechBoardKey, meta: TechBoardMeta | null): void {
  if (meta) metaIndex.set(boardKey, meta)
  else metaIndex.delete(boardKey)
}

/** 지금 화면에 보이는 항목(캐시 + 대기 중 변경) */
function shownDoc(s: ItemState): TechItemDoc | null {
  const raw = rawOf(s)
  if (raw) return patched(raw, s, undefined)
  return s.created ? patched(draftDoc(s), s, undefined) : null
}

/** 고치기 전 값으로 되돌리는 고치기와 알림 글 — 되돌릴 수 없는 것이 섞였거나 바뀐 것이 없으면 null */
function invertEdit(s: ItemState, before: TechItemDoc, edit: PendingEdit, drafts: string[]): UndoEntry | null {
  const meta = metaIndex.get(s.boardKey)
  const inverse: PendingEdit = {}
  const changes: UndoChange[] = []
  if (edit.name !== undefined && edit.name !== before.name) {
    inverse.name = before.name
    changes.push({ kind: 'name', to: edit.name })
  }
  if (edit.groupId !== undefined && edit.groupId !== before.groupId) {
    if (!before.groupId) return null
    inverse.groupId = before.groupId
    changes.push({ kind: 'group', to: meta?.groups.find((g) => g.id === edit.groupId)?.title ?? '' })
  }
  for (const [id, cell] of Object.entries(edit.columns ?? {})) {
    const column = meta?.columns.find((c) => c.id === id)
    if (!column) return null
    const prev = before.values[id]
    if (cell.preview && cellKey(cell.preview) === cellKey(prev)) continue
    const state = initialState(column, prev)
    // 좌표 없는 주소는 Monday에 다시 쓸 수 없다(지워진다).
    if (column.type === 'location' && prev?.text && !(state as LocationState).lat) return null
    inverse.columns = { ...inverse.columns, [id]: { value: toEditValue(column, state), preview: prev ?? EMPTY_CELL } }
    changes.push({ kind: 'column', title: columnLabel(column), to: cell.preview ? cell.preview.text : null })
  }
  const subs = edit.subitems
  if (subs?.remove?.length) return null
  if (subs?.update?.length) {
    const subColumns = meta?.subitems?.columns ?? []
    const update: TechSubitemEdit[] = []
    const previews: Record<string, Record<string, TechCellValue>> = {}
    for (const sub of subs.update) {
      const prevSub = sub.id ? before.subitems?.find((x) => x.id === sub.id) : undefined
      if (!sub.id || !prevSub) return null
      const back: TechSubitemEdit = { id: sub.id }
      if (sub.name !== undefined && sub.name !== prevSub.name) {
        back.name = prevSub.name
        changes.push({ kind: 'subitem', sub: prevSub.name, title: '이름', to: sub.name })
      }
      for (const columnId of Object.keys(sub.columns ?? {})) {
        const column = subColumns.find((c) => c.id === columnId)
        if (!column) return null
        const prev = prevSub.values[columnId]
        const preview = edit.subitemPreviews?.[sub.id]?.[columnId]
        if (preview && cellKey(preview) === cellKey(prev)) continue
        back.columns = { ...back.columns, [columnId]: toEditValue(column, initialState(column, prev)) }
        previews[sub.id] = { ...previews[sub.id], [columnId]: prev ?? EMPTY_CELL }
        changes.push({
          kind: 'subitem',
          sub: prevSub.name,
          title: columnLabel(column),
          to: preview ? preview.text : null,
        })
      }
      if (back.name !== undefined || back.columns) update.push(back)
    }
    if (update.length > 0) {
      inverse.subitems = { update }
      inverse.subitemPreviews = previews
    }
  }
  if (drafts.length > 0) {
    inverse.subitems = { ...inverse.subitems, remove: drafts }
    for (const sub of subs?.create ?? []) changes.push({ kind: 'subitemAdd', name: sub.name ?? '' })
  }
  if (changes.length === 0) return null
  return { boardKey: s.boardKey, id: s.realId ?? s.key, inverse, itemName: before.name, changes }
}

function recordUndo(entry: UndoEntry) {
  if (undoBatch) undoBatch.push(entry)
  else announceUndo([entry])
}

function announceUndo(entries: UndoEntry[]) {
  const { title, message } = undoText(entries)
  const toast = {
    tone: 'success' as const,
    title,
    message,
    durationMs: UNDO_MS,
    action: { label: '되돌리기', run: () => revertUndo(entries) },
  }
  if (undoToast && hasToast(undoToast)) setToast(undoToast, toast)
  else undoToast = pushToast(toast)
}

function revertUndo(entries: UndoEntry[]) {
  dismissToast(undoToast)
  undoToast = 0
  const created = entries.filter((e) => e.inverse === null)
  for (const e of entries) if (e.inverse) submitEdit(e.boardKey, e.id, e.inverse, `${e.itemName} 되돌리기`, false)
  // 새 항목은 지운다 — "지웠어요(휴지통)" 토스트가 따로 뜬다.
  for (const boardKey of new Set(created.map((e) => e.boardKey))) {
    const ids = created.filter((e) => e.boardKey === boardKey).map((e) => e.id)
    deleteItems(boardKey, ids)
  }
  const edited = entries.filter((e) => e.inverse !== null)
  if (edited.length > 0) pushToast({ tone: 'success', title: '되돌렸어요', message: revertText(edited) })
}
