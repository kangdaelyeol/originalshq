/**
 * cmip API 공용 요청(callFunction·CallableError) — 이름은 처음 CSV 업로드용으로
 * 만들어서 남은 것이다(퍼셉트론 화면도 이 경로에서 가져다 쓴다).
 *
 * cmip 백엔드는 onRequest + cors 로 구성되어 있어 순수 JSON 요청/응답이다
 * (onCall의 { data }/{ result } 콜러블 프로토콜이 아님). 성공 시 반환값이 body에
 * 그대로 오고, 실패 시 { error: string } 형태로 온다 (index.ts의 sendError 참고).
 */
import { authFetch } from '@/xtool-auth/auth-fetch'
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'

export class CallableError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CallableError'
    this.status = status
  }
}

interface ErrorBody {
  error?: string
}

export async function callFunction<TReq, TRes>(
  name: string,
  data: TReq,
): Promise<TRes> {
  const res = await authFetch(`${CMIP_API_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(`${name} 응답을 해석할 수 없습니다.`, res.status)
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `${name} 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as TRes
}
