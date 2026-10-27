import { API_BASE } from '../constants'

export type ClientResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
      /** HTTP 응답은 받았지만 실패한 경우의 상태 코드 — "없음"(404)과 진짜
       * 오류를 가려야 하는 호출부만 본다. */
      status?: number
    }

/**
 * xtool Functions 호출 하나 — 모든 client가 이걸 쓴다. body를 주면 JSON
 * POST, 없으면 GET(method로 바꿀 수 있다).
 *
 * 실패는 던지지 않고 { ok: false, error }로 돌려준다. error는 항상
 * 문자열이다 — 서버가 보낸 { error: '...' }가 있으면 그 문구, 없으면
 * fallbackError. 응답이 JSON이 아니어도(5xx의 HTML 오류 페이지 등) 깨지지
 * 않는다.
 */
export const request = async <T>(
  endpoint: string,
  fallbackError: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
): Promise<ClientResponse<T>> => {
  const { body } = options
  const method = options.method ?? (body ? 'POST' : 'GET')
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method,
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    })
    const json: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const serverError =
        json && typeof json === 'object' && 'error' in json
          ? json.error
          : undefined
      return {
        ok: false,
        error: typeof serverError === 'string' ? serverError : fallbackError,
        status: response.status,
      }
    }

    return { ok: true, data: json as T }
  } catch (error) {
    // 응답을 아예 못 받은 경우(네트워크 끊김 등).
    return {
      ok: false,
      error: `${fallbackError}: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}
