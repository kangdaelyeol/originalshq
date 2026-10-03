import * as logger from 'firebase-functions/logger'
import { Device } from './types'

/** GA4 Measurement Protocol only backdates events this far. An older
 * `timestamp_micros` is not rejected with an error — the request still
 * returns 2xx — the event is just dropped, so it has to be caught here. */
const MAX_BACKDATE_MS = 72 * 60 * 60 * 1000

/** 상담 등록 시 GA4로 보낼 이벤트 — 기기별로 둔다. 여기 없는 기기는 GA4
 * 이벤트를 보내지 않는다(지금은 '기타'만). 다른 기기를 추가하려면 항목만
 * 늘리면 된다. */
export const GA4_CONSULTATION_EVENTS: Partial<
  Record<Device, { name: string; value: number }>
> = {
  기타: { name: 'other_online_submit', value: 150000 },
}

type SendGa4EventParams = {
  measurementId: string
  apiSecret: string
  /** GA4가 "같은 사용자"로 묶는 기준. 브라우저의 _ga 쿠키 값이 있으면 그
   * 세션에 귀속되지만, 리드엔 저장돼 있지 않아 호출부가 고객별로 고정된 값을
   * 대신 넘긴다. */
  clientId: string
  name: string
  params: Record<string, string | number>
  eventTimeMs: number
}

export type SendGa4EventResult = {
  ok: boolean
  status: number
  /** 72시간보다 오래된 이벤트라 timestamp_micros를 빼고 "지금"으로 보냈는지. */
  backdateDropped: boolean
}

export const sendGa4Event = async ({
  measurementId,
  apiSecret,
  clientId,
  name,
  params,
  eventTimeMs,
}: SendGa4EventParams): Promise<SendGa4EventResult> => {
  const backdateDropped = Date.now() - eventTimeMs > MAX_BACKDATE_MS

  const payload = {
    client_id: clientId,
    ...(backdateDropped ? {} : { timestamp_micros: eventTimeMs * 1000 }),
    events: [{ name, params }],
  }

  const response = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  // Measurement Protocol은 잘못된 payload에도 2xx를 돌려준다 — 여기서 ok는
  // "요청이 GA4에 도달했다"까지만 뜻한다. payload 검증은 /debug/mp/collect로
  // 따로 해야 한다.
  if (!response.ok) {
    logger.error(`GA4(${name}) 전송 실패:`, response.status)
  } else {
    logger.info(`GA4(${name}) 전송:`, {
      status: response.status,
      backdateDropped,
    })
  }

  return { ok: response.ok, status: response.status, backdateDropped }
}
