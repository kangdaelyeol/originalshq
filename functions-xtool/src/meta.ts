import * as crypto from 'crypto'
import * as logger from 'firebase-functions/logger'
import { Lead, Device } from './types'
import { getActionSource } from './utils'

export const DEVICE_EXPECTED_VALUE: Record<Device, number> = {
  F2Ultra: 104500,
  F2UltraUV: 195000,
  P3: 89000,
  DTF: 152000,
  Metalfab: 492000,
  F2: 800000,
  M2: 570000,
  o1: 800000,
}

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export const normalizePhoneForMeta = (digitsOnlyPhone: string) => {
  const withoutLeadingZero = digitsOnlyPhone.replace(/^0/, '').replace(/-/g, '')
  return `82${withoutLeadingZero}`
}

const hashPhoneVariants = (digitsOnlyPhone: string): string[] => {
  const withCountryCode = sha256(normalizePhoneForMeta(digitsOnlyPhone))
  const raw = sha256(digitsOnlyPhone)

  return Array.from(new Set([withCountryCode, raw]))
}

type MetaEventName = 'Contact' | 'Purchase'

type SendMetaEventParams = {
  pixelId: string
  accessToken: string
  eventName: MetaEventName
  lead: Omit<Lead, 'id'>
  customData?: Record<string, unknown>
  eventTimeMs: number
  /** Meta 이벤트 관리자에서 테스트 이벤트로 확인할 때 쓰는 코드 — 테스트
   * 이벤트마다 값이 달라서 호출부에서 그때그때 받아온다. 최상위(data와 형제)
   * 필드라 event 객체 안이 아니라 payload 바로 아래 넣어야 한다. */
  testEventCode?: string
}

type SendMetaEventResult =
  | { ok: true; result: unknown }
  | { ok: false; result: unknown }

export const sendMetaEvent = async ({
  pixelId,
  accessToken,
  eventName,
  lead,
  customData,
  eventTimeMs,
  testEventCode,
}: SendMetaEventParams): Promise<SendMetaEventResult> => {
  const eventTime = Math.floor(eventTimeMs / 1000)

  const actionSource = getActionSource(eventTime)

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        action_source: actionSource,
        ...(customData ? { custom_data: customData } : {}),
        user_data: {
          ph: hashPhoneVariants(lead.ph),
          ...(lead.fn ? { fn: sha256(lead.fn) } : {}),
          external_id: lead.externalId,
          client_ip_address: lead.ip || undefined,
          client_user_agent: lead.user_agent || undefined,
          fbc: lead.fbc || undefined,
          fbp: lead.fbp || undefined,
        },
      },
    ],
    // data와 같은 레벨(최상위)에 있어야 Meta 이벤트 관리자의 테스트 이벤트로
    // 잡힌다 — event 객체 안에 넣으면 무시된다.
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  const response = await fetch(
    `https://graph.facebook.com/v26.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    logger.error(`Meta CAPI(${eventName}) 전송 실패:`, result)
    return { ok: false, result }
  }

  logger.info(`Meta CAPI(${eventName}) 전송 성공:`, result)
  return { ok: true, result }
}
