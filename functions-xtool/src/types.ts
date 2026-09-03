export const Device = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
  'o1',
] as const

export type Device = (typeof Device)[number]

export const LeadState = ['new', 'contacted', 'purchased']

export type LeadState = (typeof LeadState)[number]

export type Lead = {
  id: string
  createdAt: number
  utm_campaign: string
  utm_medium: string
  utm_source: string
  ip: string
  fbc: string
  fbp: string
  user_agent: string
  fn: string
  ph: string
  device: Device
  price: number
  purchasedAt: number
  state: LeadState
  externalId?: string
}

export type CreateLeadInput = {
  utm_campaign: string
  utm_medium: string
  utm_source: string
  ip: string
  fbc: string
  fbp: string
  user_agent: string
  fn: string
  ph: string
  device: Device
  createdAt: number
  state: LeadState
}

export const TimestampField = ['createdAt', 'purchasedAt'] as const

export type TimestampField = (typeof TimestampField)[number]

export type ValidationResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }
