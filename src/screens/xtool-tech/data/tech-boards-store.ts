import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useSyncExternalStore } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import {
  normalizeRecord,
  type TechBoardDoc,
  type TechBoardKey,
  type TechBoardMeta,
  type TechItemDoc,
  type TechMondayUser,
} from './tech-boards'

// 보드 데이터 — Firestore 캐시를 실시간으로 구독한다(누가 고치면 모든 화면에 바로 반영).
// 처음 그 보드 화면에 들어올 때 구독을 시작하고, 탭을 오가도 끊지 않는다(다시 받지 않게).
// 권한 오류 등으로 끊기면 다음에 들어올 때 다시 구독한다.

export interface TechBoardState {
  meta: TechBoardMeta | null
  /** 아직 첫 응답 전이면 false */
  metaLoaded: boolean
  items: TechItemDoc[] | null
  /** 화면용 — meta와 item이 둘 다 오면 만든다. */
  board: TechBoardDoc | null
  itemsById: ReadonlyMap<string, TechItemDoc>
  error: string | null
}

const EMPTY: TechBoardState = {
  meta: null,
  metaLoaded: false,
  items: null,
  board: null,
  itemsById: new Map(),
  error: null,
}

const states = new Map<TechBoardKey, TechBoardState>()
const subscriptions = new Map<TechBoardKey, () => void>()
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const errorMessage = (error: { code?: string; message?: string }) =>
  error.code === 'permission-denied' ? '이 보드를 볼 권한이 없어요.' : (error.message ?? '보드를 불러오지 못했어요.')

/** 새로 만든 건이 위로 — Monday 화면 순서는 캐시에 없어서 만든 시각으로 정렬한다. */
const newestFirst = (a: TechItemDoc, b: TechItemDoc) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')

function update(key: TechBoardKey, patch: Partial<TechBoardState>) {
  const next = { ...(states.get(key) ?? EMPTY), ...patch }
  if ('items' in patch || 'meta' in patch) {
    next.itemsById = new Map((next.items ?? []).map((item) => [item.itemId, item]))
    next.board =
      next.meta && next.items
        ? {
            key,
            boardId: next.meta.boardId,
            name: next.meta.name,
            syncedAt: next.meta.syncedAt,
            lastSync: next.meta.lastSync,
            records: next.items.map((item) => normalizeRecord(item.record)),
          }
        : null
  }
  states.set(key, next)
  emit()
}

function stop(key: TechBoardKey, error: { code?: string; message?: string }) {
  subscriptions.get(key)?.()
  subscriptions.delete(key)
  update(key, { error: errorMessage(error) })
}

function ensureBoard(key: TechBoardKey) {
  if (subscriptions.has(key)) return
  const { db } = xtoolFirebase()
  update(key, { error: null })
  const offMeta = onSnapshot(
    doc(db, 'techBoardMeta', key),
    (snap) => update(key, { meta: snap.exists() ? (snap.data() as TechBoardMeta) : null, metaLoaded: true }),
    (error) => stop(key, error),
  )
  const offItems = onSnapshot(
    query(collection(db, 'techItems'), where('boardKey', '==', key)),
    (snap) => update(key, { items: snap.docs.map((d) => d.data() as TechItemDoc).sort(newestFirst) }),
    (error) => stop(key, error),
  )
  subscriptions.set(key, () => {
    offMeta()
    offItems()
  })
}

/** 보드 하나 — 실시간. */
export function useTechBoard(key: TechBoardKey): TechBoardState {
  const snapshot = useSyncExternalStore(subscribe, () => states.get(key) ?? EMPTY)
  useEffect(() => {
    ensureBoard(key)
  }, [key])
  return snapshot
}

// ── 담당자로 고를 Monday 사용자 ─────────────────────────────────────────────

let users: TechMondayUser[] | null = null
let usersOff: (() => void) | null = null
const userListeners = new Set<() => void>()

/** 이름순, 쓰지 않는(비활성) 계정은 뺀다. */
export function useMondayUsers(): TechMondayUser[] | null {
  const snapshot = useSyncExternalStore(
    (listener) => {
      userListeners.add(listener)
      return () => userListeners.delete(listener)
    },
    () => users,
  )
  useEffect(() => {
    if (usersOff) return
    usersOff = onSnapshot(
      doc(xtoolFirebase().db, 'techMeta', 'mondayUsers'),
      (snap) => {
        const list = ((snap.data()?.users ?? []) as TechMondayUser[]).filter((user) => user.enabled)
        users = list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        userListeners.forEach((listener) => listener())
      },
      () => {
        usersOff?.()
        usersOff = null
      },
    )
  }, [])
  return snapshot
}
