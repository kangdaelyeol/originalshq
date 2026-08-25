export const DEVICE_VALUES = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
  'o1',
] as const

export type Device = (typeof DEVICE_VALUES)[number]

export type LeadState = 'new' | 'contacted' | 'purchased'

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
  createdAt?: number
  state?: 'new' | 'contacted'
}

export const TIMESTAMP_FIELDS = ['createdAt', 'purchasedAt'] as const
export type TimestampField = (typeof TIMESTAMP_FIELDS)[number]

export const CREATE_LEAD_WITHOUT_CONTACT_REQUIRED_FIELDS = [
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'device',
]
