import * as crypto from 'crypto'
import * as logger from 'firebase-functions/logger'
import { Lead, Device } from './types'

export const DEVICE_EXPECTED_VALUE: Record<Device, number> = {
  F2Ultra: 104500,
  F2UltraUV: 195000,
  P3: 89000,
  DTF: 152000,
  Metalfab: 492000,
}

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export const normalizePhoneForMeta = (digitsOnlyPhone: string) => {
  const withoutLeadingZero = digitsOnlyPhone.replace(/^0/, '')
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
          ph: hashPhoneVariants(lead.ph),
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
