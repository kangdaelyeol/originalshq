export const Device = {
  F2: 'F2',
  F2_ULTRA: 'F2Ultra',
  F2_ULTRA_UV: 'F2UltraUV',
  P3: 'P3',
  DTF: 'DTF',
  METAL_FAB: 'Metalfab',
  M2: 'M2',
  O1: 'o1',
} as const

export type Device = (typeof Device)[keyof typeof Device]

export const LeadState = {
  NEW: 'new',
  CONTACTED: 'contacted',
  PURCHASED: 'purchased',
} as const

export type LeadState = (typeof LeadState)[keyof typeof LeadState]

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
