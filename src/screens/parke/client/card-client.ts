import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database'
import { parkeDb } from '../firebase'
import type { CardRecord } from '../entity/card'

// Parké Realtime Database
//   allow/{serial}: true          — 관리자가 만든(앱에서 등록 가능한) 시리얼
//   card/{serial}                 — 앱에서 등록한 카드
//   adminLog/deletions/{logId}    — 관리자 화면의 삭제 기록(되돌리기용 스냅샷)

/** 카드 1장 — 없으면(등록 전) null. */
export const getCard = async (serial: string): Promise<CardRecord | null> => {
  const snapshot = await get(ref(parkeDb, `card/${serial}`))
  return snapshot.exists() ? (snapshot.val() as CardRecord) : null
}

/** 시리얼 목록(allow의 키)을 실시간으로 받는다. 해제 함수를 돌려준다. */
export const subscribeSerials = (
  onChange: (serials: string[]) => void,
  onError: (error: Error) => void,
) =>
  onValue(
    ref(parkeDb, 'allow'),
    (snapshot) => onChange(Object.keys(snapshot.val() ?? {})),
    onError,
  )

/** 새 시리얼을 사용 가능하게 등록한다. */
export const createSerial = (serial: string) =>
  update(ref(parkeDb), { [`allow/${serial}`]: true })

export interface DeletionLog {
  id: string
  serial: string
  /** 지우기 직전 카드 — 등록 전 시리얼이면 null. */
  card: CardRecord | null
  deletedAt: number
  deletedBy: string
  restoredAt?: number
  restoredBy?: string
}

/**
 * 시리얼 삭제 — allow와 카드를 함께 지우고, 지우기 직전 카드를 삭제 기록에
 * 남긴다. 세 곳을 한 번의 update로 써서 일부만 지워지는 일이 없다.
 * 삭제 기록 id를 돌려준다(되돌리기에 쓴다).
 */
export const deleteSerial = async (serial: string, deletedBy: string) => {
  const cardSnapshot = await get(ref(parkeDb, `card/${serial}`))
  const logRef = push(ref(parkeDb, 'adminLog/deletions'))
  await update(ref(parkeDb), {
    [`allow/${serial}`]: null,
    [`card/${serial}`]: null,
    [`adminLog/deletions/${logRef.key}`]: {
      serial,
      card: cardSnapshot.exists() ? cardSnapshot.val() : null,
      deletedAt: serverTimestamp(),
      deletedBy,
    },
  })
  return logRef.key as string
}

/** 삭제 되돌리기 — 시리얼과(있었다면) 카드를 그대로 되살리고 기록에 표시한다.
 * 그 사이 같은 시리얼로 새 카드가 생겼으면 덮어쓰지 않고 실패한다. */
export const restoreDeletion = async (logId: string, restoredBy: string) => {
  const logSnapshot = await get(ref(parkeDb, `adminLog/deletions/${logId}`))
  if (!logSnapshot.exists()) throw new Error('삭제 기록을 찾을 수 없습니다')
  const log = logSnapshot.val() as Omit<DeletionLog, 'id'>
  if (log.restoredAt) throw new Error('이미 되돌린 기록입니다')

  if (log.card) {
    const current = await get(ref(parkeDb, `card/${log.serial}`))
    if (current.exists()) {
      throw new Error('같은 시리얼로 새 카드가 이미 있어 되돌릴 수 없습니다')
    }
  }

  await update(ref(parkeDb), {
    [`allow/${log.serial}`]: true,
    ...(log.card ? { [`card/${log.serial}`]: log.card } : {}),
    [`adminLog/deletions/${logId}/restoredAt`]: serverTimestamp(),
    [`adminLog/deletions/${logId}/restoredBy`]: restoredBy,
  })
}

/** 최근 삭제 기록(최신순, 최대 100건)을 실시간으로 받는다. */
export const subscribeDeletionLogs = (
  onChange: (logs: DeletionLog[]) => void,
  onError: (error: Error) => void,
) =>
  onValue(
    query(
      ref(parkeDb, 'adminLog/deletions'),
      orderByChild('deletedAt'),
      limitToLast(100),
    ),
    (snapshot) => {
      const logs: DeletionLog[] = []
      snapshot.forEach((child) => {
        logs.push({ id: child.key as string, ...child.val() })
      })
      onChange(logs.reverse())
    },
    onError,
  )
