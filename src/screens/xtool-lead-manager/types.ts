export type Device = 'F2Ultra' | 'F2UltraUV' | 'P3' | 'DTF' | 'Metalfab'

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
  price: number
  purchasedAt: number
  state: LeadState
  device: Device
}
