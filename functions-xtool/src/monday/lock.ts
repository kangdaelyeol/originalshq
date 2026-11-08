import { randomUUID } from 'crypto'
import * as logger from 'firebase-functions/logger'
import { Firestore } from 'firebase-admin/firestore'

// Monday 동기화·고객 통합 잠금 — 예약 동기화와 수동 동기화·재생성·보드
// 등록·해제가 겹쳐 돌면, 한쪽이 반쯤 바뀐 item으로 통합해 섞인 결과가 다음
// 실행까지 남거나, 같은 인스턴스의 메모리를 나눠 쓰다 둘 다 멈출 수 있다. 그래서
// 한 번에 하나만 돌게 한다. 잠금은 문서 하나(syncLocks/monday)이고, 함수가
// 중간에 죽어 못 푼 잠금은 만료 시각이 지나면 다음 실행이 가져간다(함수 제한
// 시간 9분보다 길게).
const LOCK_COLLECTION = 'syncLocks'
const LOCK_DOC = 'monday'
const LOCK_TTL_MS = 12 * 60_000
// 기다릴 때 다시 볼 간격.
const RETRY_MS = 15_000

interface MondayLock {
  holder: string
  token: string
  at: number
  expiresAt: number
}

/** 다른 Monday 작업이 잠금을 잡고 있다. */
export class MondayBusyError extends Error {
  constructor(
    readonly holder: string,
    readonly since: number,
  ) {
    super(
      `다른 Monday 작업(${holder})이 진행 중입니다 — 잠시 뒤 다시 시도하세요`,
    )
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 잠금을 잡고 run을 돌린다. 다른 작업이 잡고 있으면 waitMs까지 기다려 보고,
 * 그래도 못 잡으면 MondayBusyError. 잠금은 run이 끝나면(실패해도) 푼다. */
export async function withMondayLock<T>(
  db: Firestore,
  holder: string,
  run: () => Promise<T>,
  { waitMs = 0 }: { waitMs?: number } = {},
): Promise<T> {
  const ref = db.collection(LOCK_COLLECTION).doc(LOCK_DOC)
  const token = randomUUID()
  const giveUpAt = Date.now() + waitMs
  for (;;) {
    try {
      await db.runTransaction(async (tx) => {
        const lock = (await tx.get(ref)).data() as MondayLock | undefined
        const now = Date.now()
        if (lock && lock.expiresAt > now) {
          throw new MondayBusyError(lock.holder, lock.at)
        }
        const next: MondayLock = {
          holder,
          token,
          at: now,
          expiresAt: now + LOCK_TTL_MS,
        }
        tx.set(ref, next)
      })
      break
    } catch (error) {
      if (!(error instanceof MondayBusyError) || Date.now() >= giveUpAt) {
        throw error
      }
      await sleep(RETRY_MS)
    }
  }
  try {
    return await run()
  } finally {
    // 내 잠금일 때만 푼다 — 만료 뒤 다른 작업이 가져갔으면 그대로 둔다.
    await db
      .runTransaction(async (tx) => {
        const lock = (await tx.get(ref)).data() as MondayLock | undefined
        if (lock?.token === token) tx.delete(ref)
      })
      .catch((error) =>
        logger.warn('Monday 잠금 풀기 실패(만료 시각에 풀린다):', error),
      )
  }
}
