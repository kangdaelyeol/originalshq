// 바깥 API(Monday·SOLAPI) 호출을 일시적인 오류에만 몇 번 더 시도한다.
//
// 다시 보내도 결과가 같은 오류(컬럼 값 오류, 인증 실패 등)는 바로 던지고,
// 네트워크 끊김·타임아웃·5xx·429처럼 잠깐 뒤 다시 하면 될 수 있는 오류만
// TransientError로 표시해 재시도한다.

/** 다시 시도하면 될 수 있는 오류. sent가 true면 요청이 상대에게 닿았는지
 * 알 수 없다(타임아웃 등) — 이미 처리됐을 수 있다. */
export class TransientError extends Error {
  constructor(message: string, readonly sent: boolean) {
    super(message)
  }
}

/** 시도 횟수를 붙인 최종 오류. */
export class RetryError extends Error {
  constructor(message: string, readonly attempts: number) {
    super(message)
  }
}

/** 응답을 기다리는 한도 — 넘으면 끊고 TransientError(sent)로 본다. */
export const REQUEST_TIMEOUT_MS = 10_000

/** fetch + 타임아웃. 응답 전 연결 실패와 타임아웃을 TransientError로 바꾼다. */
export const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> => {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const name = (error as { name?: string }).name
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new TransientError(
        `${label} 응답이 ${REQUEST_TIMEOUT_MS / 1000}초 안에 오지 않았습니다`,
        true,
      )
    }
    // 연결 자체가 안 된 경우(DNS·연결 거부 등) — 요청이 닿지 않았다.
    const reason = error instanceof Error ? error.message : String(error)
    throw new TransientError(`${label} 연결 실패: ${reason}`, false)
  }
}

/** HTTP 상태가 일시적인 오류인지 — 5xx와 429. */
export const isTransientStatus = (status: number) =>
  status === 429 || status >= 500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 시도 사이 대기(ms) — 첫 재시도 1초, 다음 3초. */
const BACKOFF_MS = [1000, 3000]

export const MAX_ATTEMPTS = 3

/**
 * run을 최대 MAX_ATTEMPTS번 실행한다. TransientError만 다시 시도하고,
 * shouldRetry가 false를 돌려주면 그 오류에서 멈춘다. run은 몇 번째
 * 시도인지(1부터)를 받는다. 결과와 실제 시도 횟수를 돌려주고, 끝내
 * 실패하면 RetryError(attempts 포함)를 던진다.
 */
export const withRetry = async <T>(
  run: (attempt: number) => Promise<T>,
  shouldRetry: (error: TransientError) => boolean = () => true,
): Promise<{ value: T; attempts: number }> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await run(attempt), attempts: attempt }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable =
        error instanceof TransientError &&
        attempt < MAX_ATTEMPTS &&
        shouldRetry(error)
      if (!retryable) throw new RetryError(message, attempt)
      await sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1])
    }
  }
}
