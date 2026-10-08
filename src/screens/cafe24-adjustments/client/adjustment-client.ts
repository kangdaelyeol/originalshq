import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'

/** functions-cmip의 cafe24Adjustments 문서 1건 — 관리자가 손으로 넣는 환불
 * 보정. amount는 그 날 "환불 금액"에 더해지는 값이라, 양수면 환불이 늘고
 * (순매출 감소) 음수면 환불이 줄어든다(순매출 증가). */
export interface Cafe24Adjustment {
  id: string
  date: string
  amount: number
  orderId: string
  memo: string
  createdAt: number
}

export type Cafe24AdjustmentInput = Pick<
  Cafe24Adjustment,
  'date' | 'amount' | 'orderId' | 'memo'
>

export type ClientResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const request = async <T>(
  endpoint: string,
  init: RequestInit | undefined,
  pick: (body: Record<string, unknown>) => T,
): Promise<ClientResponse<T>> => {
  try {
    const response = await fetch(`${CMIP_API_BASE}/${endpoint}`, init)
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof body.error === 'string'
            ? body.error
            : `${endpoint} 실패 (HTTP ${response.status})`,
      }
    }
    return { ok: true, data: pick(body) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${endpoint} 실패`,
    }
  }
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const adjustmentClient = {
  list: () =>
    request('listCafe24Adjustments', undefined, (body) =>
      (body.adjustments ?? []) as Cafe24Adjustment[],
    ),
  create: (input: Cafe24AdjustmentInput) =>
    request(
      'createCafe24Adjustment',
      post(input),
      (body) => body.adjustment as Cafe24Adjustment,
    ),
  delete: (id: string) =>
    request('deleteCafe24Adjustment', post({ id }), () => id),
}
