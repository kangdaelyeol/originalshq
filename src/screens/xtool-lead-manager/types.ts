export type Device =
  | 'F2Ultra'
  | 'F2UltraUV'
  | 'P3'
  | 'DTF'
  | 'Metalfab'
  | 'F2'
  | 'M2'
export type DeviceFilter = Device | 'all'
export const DEVICE_OPTIONS: Device[] = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
]

export type LeadState = 'new' | 'contacted' | 'purchased'
export type ConfirmVariant = 'delete' | 'register'
export type SortField = 'createdAt' | 'fn' | 'ph'
export type SortDirection = 'asc' | 'desc'

export type EditingField = 'fn' | 'ph' | 'price' | 'createdAt' | 'purchasedAt'

export type EditingCell = {
  rowId: string
  field: EditingField
} | null

export interface TableFold {
  new: boolean
  contacted: boolean
  purchased: boolean
}

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

export type CreateLeadFormValues = {
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
  createdAt: string // <input type="datetime-local"> 바인딩용 문자열
  state: 'new' | 'contacted'
}

export const INITIAL_CREATE_LEAD_FORM: CreateLeadFormValues = {
  utm_campaign: '',
  utm_medium: '',
  utm_source: '',
  ip: '',
  fbc: '',
  fbp: '',
  user_agent: '',
  fn: '',
  ph: '',
  device: 'F2Ultra',
  createdAt: '',
  state: 'new',
}
