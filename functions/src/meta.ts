import * as crypto from 'crypto'
import * as logger from 'firebase-functions/logger'
import { Lead } from './types'

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

// 010-1234-5678 -> 821012345678 형태로 변환 후 해시 (Meta 권장 포맷)
export const normalizePhoneForMeta = (digitsOnlyPhone: string) => {
  const withoutLeadingZero = digitsOnlyPhone.replace(/^0/, '')
  return `82${withoutLeadingZero}`
}

type MetaEventName = 'Contact' | 'Purchase'

type SendMetaEventParams = {
  pixelId: string
  accessToken: string
  eventName: MetaEventName
  lead: Omit<Lead, 'id'>
  customData?: Record<string, unknown>
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
}: SendMetaEventParams): Promise<SendMetaEventResult> => {
  const eventTime = Math.floor(Date.now() / 1000)

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        action_source: 'phone_call',
        ...(customData ? { custom_data: customData } : {}),
        user_data: {
          ph: [sha256(normalizePhoneForMeta(lead.ph))],
          fn: [sha256(lead.fn)],
          client_ip_address: lead.ip || undefined,
          client_user_agent: lead.user_agent || undefined,
          fbc: lead.fbc || undefined,
          fbp: lead.fbp || undefined,
        },
      },
    ],
  }

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
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
