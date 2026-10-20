import { Firestore, Timestamp } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'

// 배치(예약 실행) 함수의 실행 기록 — /log 화면이 읽는다. functions-xtool과
// functions-cmip가 같은 DB(xtool-read)의 같은 컬렉션에 쌓아서, 한 화면에서
// 두 코드베이스의 배치를 함께 본다. 두 코드베이스에 이 파일이 똑같이 있다
// (패키지가 달라 공유할 수 없다) — 고칠 때는 둘 다 고친다. 조회 함수
// (listBatchRuns)와 조회 API는 xtool 쪽에만 있다.

export const BATCH_RUNS_COLLECTION = 'batchRuns'

// 기록을 얼마나 남길지 — expireAt에 적어 두고, Firestore TTL 정책을
// batchRuns.expireAt에 걸면 그 뒤로 자동으로 지워진다(정책이 없으면 그냥
// 남는다. 하루 36건 남짓이라 쌓여도 부담은 적다).
const RETENTION_DAYS = 90

// 결과(요약 객체)를 저장할 때의 최대 길이 — 문서 한도(1MB)보다 한참 작게.
const MAX_RESULT_LENGTH = 200_000
const MAX_STACK_LENGTH = 4_000

export type BatchTrigger = 'scheduled' | 'manual'

/** 실행이 끝난 뒤 결과를 보고 "일부 실패"인지 가려낸다 — 함수는 성공으로
 * 끝났어도 안에서 일부(예: 보드 몇 개)가 실패했을 수 있다. */
export type BatchAssess<T> = (
  result: T,
) => { partial: boolean; note?: string } | undefined

export interface BatchRunMeta {
  /** 작업 id — 화면이 이 값으로 작업 이름·예약 시각을 찾는다. */
  job: string
  codebase: 'xtool' | 'cmip'
  trigger: BatchTrigger
  /** 예약 실행이면 Cloud Scheduler가 정한 시각(ISO) — 실제 시작과 비교해
   * 지연을 본다. */
  scheduledAt?: string | null
  /** 이 실행의 입력(조회 기간 등) — 화면에 그대로 보여 준다. */
  params?: Record<string, string | number | boolean | null>
}

/** 기록 쓰기가 실패해도 배치 자체는 계속 돌아야 한다 — 로그만 남긴다. */
const safely = async (label: string, write: () => Promise<unknown>) => {
  try {
    await write()
  } catch (error) {
    logger.warn(`배치 실행 기록(${label}) 저장 실패:`, error)
  }
}

/** 결과를 JSON 문자열로 — Firestore는 배열 안의 배열을 못 담고 undefined도
 * 거부해서, 객체 그대로 두지 않고 문자열로 저장한다(화면이 다시 푼다). */
const toResultJson = (result: unknown): string | null => {
  if (result === undefined) return null
  try {
    const json = JSON.stringify(result)
    return json.length > MAX_RESULT_LENGTH
      ? JSON.stringify({ truncated: true, preview: json.slice(0, 2_000) })
      : json
  } catch {
    return JSON.stringify({ unserializable: String(result) })
  }
}

/**
 * run을 실행하면서 그 결과를 batchRuns에 기록한다. 시작할 때 "running"으로
 * 먼저 써 두므로, 함수가 제한 시간에 걸려 강제로 끝나면 기록이 running으로
 * 남는다(화면이 "시간 초과 의심"으로 보여 준다). run이 던진 오류는 기록한 뒤
 * 그대로 다시 던진다.
 */
export async function recordBatchRun<T>(
  db: Firestore,
  meta: BatchRunMeta,
  run: () => Promise<T>,
  assess?: BatchAssess<T>,
): Promise<T> {
  const ref = db.collection(BATCH_RUNS_COLLECTION).doc()
  const startedAt = Date.now()
  await safely('시작', () =>
    ref.set({
      job: meta.job,
      codebase: meta.codebase,
      trigger: meta.trigger,
      scheduledAt: meta.scheduledAt ?? null,
      params: meta.params ?? null,
      status: 'running',
      startedAt,
      finishedAt: null,
      durationMs: null,
      resultJson: null,
      note: null,
      error: null,
      expireAt: Timestamp.fromMillis(
        startedAt + RETENTION_DAYS * 86_400_000,
      ),
    }),
  )

  try {
    const result = await run()
    const finishedAt = Date.now()
    const verdict = assess?.(result)
    await safely('성공', () =>
      ref.update({
        status: verdict?.partial ? 'partial' : 'success',
        finishedAt,
        durationMs: finishedAt - startedAt,
        resultJson: toResultJson(result),
        note: verdict?.note ?? null,
      }),
    )
    return result
  } catch (error) {
    const finishedAt = Date.now()
    await safely('실패', () =>
      ref.update({
        status: 'failed',
        finishedAt,
        durationMs: finishedAt - startedAt,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack:
            error instanceof Error && error.stack
              ? error.stack.slice(0, MAX_STACK_LENGTH)
              : null,
        },
      }),
    )
    throw error
  }
}

/** /log 화면용 — 최근 기록부터 since(ms) 이후 것만. */
export async function listBatchRuns(
  db: Firestore,
  since: number,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const snapshot = await db
    .collection(BATCH_RUNS_COLLECTION)
    .where('startedAt', '>=', since)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get()
  // expireAt(TTL용 Timestamp)은 화면에 필요 없어 뺀다.
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    delete data.expireAt
    return { id: doc.id, ...data }
  })
}
