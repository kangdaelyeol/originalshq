/**
 * Firebase Functions v2 onCall은 firebase-functions SDK가 없어도 순수 fetch로 호출 가능하지만,
 * 정해진 요청/응답 포맷을 그대로 따라야 한다 (SDK가 내부적으로 하던 걸 직접 구현하는 것):
 *   요청: POST {API_BASE}/{functionName}, body { data: <입력값> }
 *   성공 응답: { result: <반환값> }
 *   실패 응답: { error: { message, status, details? } } (HTTP 상태코드도 4xx/5xx로 옴)
 * 이 포맷을 안 지키고 입력값을 그대로 body에 넣거나 응답을 그대로 쓰면 동작하지 않는다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type {
  PreviewCsvData,
  PreviewCsvResult,
  ImportCsvData,
  ImportCsvResult,
} from '../types'

export class CallableError extends Error {
  status: string
  details?: unknown

  constructor(message: string, status: string, details?: unknown) {
    super(message)
    this.name = 'CallableError'
    this.status = status
    this.details = details
  }
}

interface CallableErrorBody {
  error?: { message?: string; status?: string; details?: unknown }
}

async function callFunction<TReq, TRes>(
  name: string,
  data: TReq,
): Promise<TRes> {
  const res = await fetch(`${API_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(`${name} 응답을 해석할 수 없습니다.`, 'unknown')
  }

  if (!res.ok || (body && typeof body === 'object' && 'error' in body)) {
    const err = (body as CallableErrorBody).error
    throw new CallableError(
      err?.message ?? `${name} 호출에 실패했습니다. (HTTP ${res.status})`,
      err?.status ?? 'unknown',
      err?.details,
    )
  }

  return (body as { result: TRes }).result
}

export function previewCsv(data: PreviewCsvData): Promise<PreviewCsvResult> {
  return callFunction<PreviewCsvData, PreviewCsvResult>('previewCsv', data)
}

export function importCsv(data: ImportCsvData): Promise<ImportCsvResult> {
  return callFunction<ImportCsvData, ImportCsvResult>('importCsv', data)
}
