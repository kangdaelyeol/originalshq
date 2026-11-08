// API 비용 추적 — 함수 호출 하나가 쓴 자원(시간·Firestore 읽기/쓰기/삭제·응답
// 크기·외부 호출)을 세어, 끝날 때 구조화 로그 한 줄로 남긴다.
//
//   호출 시작 → traceRun이 요청별 측정 상자(AsyncLocalStorage)를 연다
//   처리 중   → Firestore SDK·fetch에 끼운 계수기가 그 상자에 더한다
//               (각 API 코드는 고치지 않는다 — installCostCounters)
//   끝        → logger.info('api-cost', { kind: 'api-cost', ... })
//
// 로그는 Cloud Logging의 싱크(api-cost-to-bigquery)가 BigQuery
// xtool-63b29.ops_logs로 옮기고(필터 jsonPayload.kind="api-cost"), /log의
// "비용 분석" 탭이 거기서 집계한다. Firestore에 쓰지 않으므로 비용을 재는 일이
// 비용을 늘리지 않는다.
//
// 세는 방식은 Firestore 과금과 같게 맞춘다 — 쿼리는 읽은 문서 수(0건이어도
// 1회), 문서 get·getAll은 문서 수, count() 집계는 1,000건당 1회, 쓰기는 set·
// create·update 1건당 1회, 삭제는 1건당 1회. 응답을 보낸 뒤에도 도는 작업은
// 핸들러가 끝날 때까지만 센다.
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import * as logger from 'firebase-functions/logger'
import {
  CollectionReference,
  Firestore,
  Query,
  QuerySnapshot,
  Transaction,
  WriteBatch,
} from 'firebase-admin/firestore'

/** 어떤 방식으로 불린 함수인지. */
export type TraceTrigger = 'http' | 'callable' | 'schedule'

interface TraceState {
  fn: string
  trigger: TraceTrigger
  method: string
  startedAt: number
  coldStart: boolean
  /** 콜드 스타트면 인스턴스(프로세스)가 뜬 뒤 이 호출을 받기까지 걸린 시간(ms) —
   * 컨테이너 시작·모듈 불러오기. 따뜻한 인스턴스면 0. */
  initMs: number
  reads: number
  /** Firestore 읽기를 몇 번 오갔는지(쿼리·문서 묶음 하나가 한 번)와 그 시간의
   * 합(ms) — 동시에 읽으면 합이 실제 걸린 시간보다 클 수 있다. */
  readCalls: number
  readMs: number
  /** 외부 HTTP 호출 시간의 합(ms). */
  externalMs: number
  writes: number
  deletes: number
  /** 외부 HTTP 호출 — 호스트별 횟수(api.monday.com 등). */
  external: Record<string, number>
  bigqueryBytes: number
  ended: boolean
}

export interface TraceEnd {
  /** HTTP 상태 코드(호출형은 성공 200·실패 500, 예약 실행은 성공 200). */
  status: number
  responseBytes?: number
  error?: unknown
}

const storage = new AsyncLocalStorage<TraceState>()

// 인스턴스가 뜬 뒤 첫 호출 — 콜드 스타트(모듈을 불러오는 시간이 붙는다).
let coldStart = true
// 이 프로세스가 뜬 시각 — 첫 호출의 준비 시간(initMs)을 잰다.
const processStartedAt = Date.now() - Math.round(process.uptime() * 1000)

/** 이 인스턴스의 메모리 한도(MB) — Cloud Run 컨테이너의 cgroup에서 읽는다.
 * 못 읽으면 0. 실행 비용(메모리 × 시간)을 어림할 때 쓴다. */
const memoryMb = (() => {
  for (const path of [
    '/sys/fs/cgroup/memory.max',
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
  ]) {
    try {
      const bytes = Number(readFileSync(path, 'utf8').trim())
      // 한도가 없으면 아주 큰 수가 들어 있다.
      if (bytes > 0 && bytes < 64 * 1024 ** 3) {
        return Math.round(bytes / 1024 ** 2)
      }
    } catch {
      // 다음 경로로.
    }
  }
  return 0
})()

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 300)

/** 측정 상자를 닫고 로그 한 줄을 남긴다 — 여러 번 불려도 한 번만. */
const finish = (state: TraceState, end: TraceEnd) => {
  if (state.ended) return
  state.ended = true
  const externalCalls = Object.values(state.external).reduce(
    (sum, count) => sum + count,
    0,
  )
  // 필드는 늘 같은 이름·같은 타입으로 — BigQuery 열이 흔들리지 않게(빈 값도
  // 0이나 ''로 채운다). external은 호스트가 늘어도 열이 늘지 않게 문자열로.
  logger.info('api-cost', {
    kind: 'api-cost',
    codebase: 'xtool',
    fn: state.fn,
    trigger: state.trigger,
    method: state.method,
    status: end.status,
    // 4xx(찾을 수 없음·잘못된 입력 등)는 서버가 정상으로 답한 것 — 실패는
    // 5xx와 예외만.
    ok: end.status < 500 && !end.error,
    startedAtMs: state.startedAt,
    durationMs: Date.now() - state.startedAt,
    initMs: state.initMs,
    reads: state.reads,
    readCalls: state.readCalls,
    readMs: Math.round(state.readMs),
    externalMs: Math.round(state.externalMs),
    writes: state.writes,
    deletes: state.deletes,
    responseBytes: end.responseBytes ?? 0,
    externalCalls,
    external: externalCalls ? JSON.stringify(state.external) : '',
    bigqueryBytes: state.bigqueryBytes,
    coldStart: state.coldStart,
    memoryMb,
    service: process.env.K_SERVICE ?? '',
    revision: process.env.K_REVISION ?? '',
    error: end.error ? errorMessage(end.error) : '',
  })
}

export interface Trace {
  /** 끝났다고 알린다 — 그때까지 센 것으로 로그를 남긴다(두 번째부터는 무시). */
  end: (result: TraceEnd) => void
}

/** 응답 헤더 Server-Timing의 값 — 지금까지의 처리 시간(app), Firestore(db),
 * 외부 호출(ext), 콜드 스타트 준비 시간(cold). 브라우저 개발자 도구의 Timing에
 * 그대로 보여, 걸린 시간 중 서버 몫과 네트워크 몫을 나눠 볼 수 있다. 헤더 값은
 * ASCII만 되므로 설명(desc)은 영어로. */
const serverTimingOf = (state: TraceState): string =>
  [
    `app;dur=${Date.now() - state.startedAt};desc="handler"`,
    `db;dur=${Math.round(state.readMs)};desc="firestore ` +
      `${state.readCalls} calls ${state.reads} reads"`,
    ...(state.externalMs > 0
      ? [`ext;dur=${Math.round(state.externalMs)};desc="external calls"`]
      : []),
    ...(state.coldStart
      ? [`cold;dur=${state.initMs};desc="new instance"`]
      : []),
  ].join(', ')

/** HTTP 응답에 Server-Timing을 붙인다 — 헤더를 보내기 직전(writeHead)에 그때까지
 * 잰 값으로. res.send·res.end가 모두 writeHead를 거친다. 다른 출처(화면)의
 * 스크립트도 이 값을 읽을 수 있게 Timing-Allow-Origin을 같이 단다. */
export const attachServerTiming = (response: ServerResponse) => {
  const state = storage.getStore()
  if (!state) return
  const writeHead = response.writeHead.bind(response) as (
    ...args: unknown[]
  ) => ServerResponse
  response.writeHead = ((...args: unknown[]) => {
    if (!response.headersSent) {
      response.setHeader('Server-Timing', serverTimingOf(state))
      response.setHeader('Timing-Allow-Origin', '*')
    }
    return writeHead(...args)
  }) as ServerResponse['writeHead']
}

/**
 * 측정 상자를 열고 body를 그 안에서 돌린다. body 안에서(그리고 거기서 이어진
 * 비동기 작업에서) 일어난 Firestore 읽기·쓰기와 외부 호출이 이 상자에 더해진다.
 * 끝을 알리는 것(trace.end)은 body가 정한다 — HTTP는 응답이 끝났을 때 등.
 */
export const traceRun = <T>(
  info: { fn: string; trigger: TraceTrigger; method?: string },
  body: (trace: Trace) => T,
): T => {
  const state: TraceState = {
    fn: info.fn,
    trigger: info.trigger,
    method: info.method ?? '',
    startedAt: Date.now(),
    coldStart,
    initMs: 0,
    reads: 0,
    readCalls: 0,
    readMs: 0,
    externalMs: 0,
    writes: 0,
    deletes: 0,
    external: {},
    bigqueryBytes: 0,
    ended: false,
  }
  if (state.coldStart) state.initMs = state.startedAt - processStartedAt
  coldStart = false
  return storage.run(state, () =>
    body({ end: (result) => finish(state, result) }),
  )
}

/** 호출형·예약 실행 함수의 핸들러를 감싼다 — 끝나면(성공·실패) 로그. 호출형
 * 응답 크기는 돌려준 값을 JSON으로 바꾼 길이로 어림한다. */
export const traced =
  <A extends unknown[], R>(
    fn: string,
    trigger: Exclude<TraceTrigger, 'http'>,
    handler: (...args: A) => Promise<R>,
  ) =>
  (...args: A): Promise<R> =>
    traceRun({ fn, trigger }, async (trace) => {
      try {
        const result = await handler(...args)
        trace.end({
          status: 200,
          responseBytes:
            trigger === 'callable' && result !== undefined
              ? Buffer.byteLength(JSON.stringify(result) ?? '')
              : 0,
        })
        return result
      } catch (error) {
        trace.end({ status: 500, error })
        throw error
      }
    })

/** BigQuery 조회가 처리한 바이트 — 조회 코드가 직접 알린다(BigQuery 클라이언트는
 * fetch를 거치지 않아 아래 계수기에 잡히지 않는다). */
export const addBigQueryBytes = (bytes: number) => {
  const state = storage.getStore()
  if (state && Number.isFinite(bytes)) state.bigqueryBytes += bytes
}

// ── 계수기 ─────────────────────────────────────────────────────────────

/** 읽기 결과 하나가 몇 회 읽기인지 — Firestore 과금과 같은 기준. 집계 결과
 * (count)는 클래스가 런타임에 내보내지지 않아 모양으로 가린다 — 문서
 * 스냅샷(ref가 있다)이 아니면서 data().count가 숫자인 것. */
const readsOf = (result: unknown): number => {
  if (Array.isArray(result)) return Math.max(1, result.length)
  if (result instanceof QuerySnapshot) return Math.max(1, result.size)
  if (
    result &&
    typeof result === 'object' &&
    !('ref' in result) &&
    typeof (result as { data?: unknown }).data === 'function'
  ) {
    const count = (result as { data: () => Record<string, unknown> }).data()
      .count
    if (typeof count === 'number') return Math.max(1, Math.ceil(count / 1000))
  }
  return 1
}

type Patchable = Record<string, unknown>
const PATCHED = Symbol('costTrace')

/** 프로토타입의 메서드 하나를 감싼다(한 번만). */
const patch = (
  proto: object,
  method: string,
  wrap: (
    original: (...args: unknown[]) => unknown,
  ) => (this: unknown, ...args: unknown[]) => unknown,
) => {
  const target = proto as Patchable
  const original = target[method] as ((...args: unknown[]) => unknown) & {
    [PATCHED]?: boolean
  }
  if (typeof original !== 'function' || original[PATCHED]) return
  const wrapped = wrap(original) as typeof original
  wrapped[PATCHED] = true
  target[method] = wrapped
}

/** 결과(Promise)를 받으면 읽기 수와 그 왕복 시간을 더한다 — 측정 상자 밖이면
 * 그대로. */
const countReadsOnResolve = (original: (...args: unknown[]) => unknown) =>
  function(this: unknown, ...args: unknown[]) {
    // SDK 메서드를 그 객체(this)로 그대로 부른다.
    // eslint-disable-next-line no-invalid-this
    const result = original.apply(this, args)
    const state = storage.getStore()
    if (!state || !(result instanceof Promise)) return result
    const startedAt = performance.now()
    return result.then((value: unknown) => {
      state.reads += readsOf(value)
      state.readCalls += 1
      state.readMs += performance.now() - startedAt
      return value
    })
  }

/** 부르는 순간 횟수를 더한다(쓰기·삭제는 쌓을 때 센다 — 단건 set·update·
 * delete, 트랜잭션, bulkWriter가 모두 WriteBatch의 이 메서드들을 거친다). */
const countOnCall =
  (field: 'writes' | 'deletes') =>
  (original: (...args: unknown[]) => unknown) =>
    function(this: unknown, ...args: unknown[]) {
      const state = storage.getStore()
      if (state) state[field] += 1
      // eslint-disable-next-line no-invalid-this
      return original.apply(this, args)
    }

let installed = false

/**
 * Firestore SDK와 fetch에 계수기를 끼운다(앱 시작 때 한 번 — app.ts).
 *   · 읽기: Query.get(쿼리·컬렉션), 집계 쿼리 get(count), Firestore.getAll
 *     (문서 get도 내부에서 이걸 부른다), Transaction.get/getAll,
 *     CollectionReference.listDocuments
 *   · 쓰기·삭제: WriteBatch.set/create/update/delete
 *   · 외부 호출: 전역 fetch — 호스트별 횟수(Monday·Meta·SOLAPI 등)
 * 끼우다 실패해도 함수는 그대로 돈다(추적만 빠진다) — 로그만 남긴다.
 */
export const installCostCounters = (db: Firestore) => {
  if (installed) return
  installed = true
  try {
    installCounters(db)
  } catch (error) {
    logger.error('API 비용 추적 계수기 설치 실패(추적 없이 계속):', error)
  }
}

const installCounters = (db: Firestore) => {
  patch(Query.prototype, 'get', countReadsOnResolve)
  // 집계 쿼리 클래스는 런타임에 내보내지지 않아 count() 객체에서 꺼낸다(만들기만
  // 하고 실행하지 않는다).
  patch(
    Object.getPrototypeOf(db.collection('_costTrace').count()),
    'get',
    countReadsOnResolve,
  )
  patch(Firestore.prototype, 'getAll', countReadsOnResolve)
  patch(Transaction.prototype, 'get', countReadsOnResolve)
  patch(Transaction.prototype, 'getAll', countReadsOnResolve)
  patch(CollectionReference.prototype, 'listDocuments', countReadsOnResolve)

  patch(WriteBatch.prototype, 'set', countOnCall('writes'))
  patch(WriteBatch.prototype, 'create', countOnCall('writes'))
  patch(WriteBatch.prototype, 'update', countOnCall('writes'))
  patch(WriteBatch.prototype, 'delete', countOnCall('deletes'))

  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const state = storage.getStore()
    if (state) {
      try {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        const host = new URL(url).host
        state.external[host] = (state.external[host] ?? 0) + 1
      } catch {
        // 주소를 못 읽으면 세지 않는다.
      }
    }
    if (!state) return originalFetch(input, init)
    const startedAt = performance.now()
    return originalFetch(input, init).finally(() => {
      state.externalMs += performance.now() - startedAt
    })
  }
}
