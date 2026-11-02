import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import { xtoolFirebase } from '@/xtool-auth/firebase'

// /log가 functions-xtool을 부르는 공용 길 — 응답 JSON을 읽고, 실패하면 서버가
// 준 오류 문구(없으면 "무엇을 못 했는지 (HTTP 코드)")로 돌려준다. 던지지 않는다.
// 부를 때마다 로그인한 관리자의 ID 토큰을 붙인다 — 서버가 관리자인지 확인한다
// (functions-xtool admin-auth.ts). 만료가 가까우면 SDK가 새 토큰을 받아 준다.

const authHeader = async (): Promise<Record<string, string>> => {
  const token = await xtoolFirebase().auth.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type ClientResponse<T> =
  { ok: true; data: T } | { ok: false; error: string }

export const requestJson = async <T>(
  path: string,
  /** 실패 문구 — "실행 기록을 불러오지 못했습니다" 등. */
  fallback: string,
  init?: RequestInit,
): Promise<ClientResponse<T>> => {
  try {
    const response = await fetch(`${API_BASE}/${path}`, {
      ...init,
      headers: { ...init?.headers, ...(await authHeader()) },
    })
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: string
    }
    if (!response.ok) {
      return {
        ok: false,
        error: body.error ?? `${fallback} (HTTP ${response.status})`,
      }
    }
    return { ok: true, data: body }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '네트워크 오류',
    }
  }
}

export const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** 이어 받기 응답 한 쪽 — 기간 전체(incremental false)거나, since 뒤에 바뀐 것만
 * (true — 가진 목록에 합친다). fetchedAt은 다음 since로 쓸 서버 시각. */
export interface IncrementalPage<T> {
  items: T[]
  fetchedAt: number
  incremental: boolean
}

/**
 * 최근 days일 목록 — since(지난 응답의 fetchedAt)를 주면 그 뒤에 바뀐 것만.
 * 서버는 목록을 key 이름(runs·segments·inquiries)으로 주므로 items로 맞춘다.
 * 옛 서버(since를 모름)는 incremental 없이 전체를 준다 — 그러면 통째로 바꾼다.
 */
export const getIncremental = async <T>(
  endpoint: string,
  key: string,
  days: number,
  since: number | undefined,
  fallback: string,
): Promise<ClientResponse<IncrementalPage<T>>> => {
  const res = await requestJson<Record<string, unknown>>(
    `${endpoint}?days=${days}${since ? `&since=${since}` : ''}`,
    fallback,
  )
  if (!res.ok) return res
  return {
    ok: true,
    data: {
      items: (res.data[key] as T[] | undefined) ?? [],
      fetchedAt: Number(res.data.fetchedAt) || Date.now(),
      incremental: res.data.incremental === true,
    },
  }
}
