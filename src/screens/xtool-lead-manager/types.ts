export const DEVICE_OPTIONS = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
  'o1',
] as const

export type Device = (typeof DEVICE_OPTIONS)[number]

export type DeviceFilter = Device | 'all'

export const EditingField = {
  FIRST_NAME: 'fn',
  PHONE: 'ph',
  PRICE: 'price',
  CREATED_AT: 'createdAt',
  PURCHASED_AT: 'purchasedAt',
} as const

export type EditingField = (typeof EditingField)[keyof typeof EditingField]

export const LeadState = {
  NEW: 'new',
  CONTACTED: 'contacted',
  PURCHASED: 'purchased',
} as const

export type LeadState = (typeof LeadState)[keyof typeof LeadState]

export const ConfirmVariant = {
  DELETE: 'delete',
  REGISTER: 'register',
} as const

export type ConfirmVariant =
  (typeof ConfirmVariant)[keyof typeof ConfirmVariant]

export type SortField = 'createdAt' | 'fn' | 'ph'
export type SortDirection = 'asc' | 'desc'

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
