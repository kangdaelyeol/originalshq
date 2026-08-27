import { Device, LeadState } from './entity'

export const DeviceFilterLabel = {
  ALL: '전체 기기',
  ...Device,
} as const

export type DeviceFilterLabel =
  (typeof DeviceFilterLabel)[keyof typeof DeviceFilterLabel]

export type DeviceFilterOption = keyof typeof DeviceFilterLabel

export const EditingField = {
  FIRST_NAME: 'fn',
  PHONE: 'ph',
  PRICE: 'price',
  CREATED_AT: 'createdAt',
  PURCHASED_AT: 'purchasedAt',
} as const

export type EditingField = (typeof EditingField)[keyof typeof EditingField]

export const ConfirmVariant = {
  DELETE: 'delete',
  REGISTER: 'register',
} as const

export type ConfirmVariant =
  (typeof ConfirmVariant)[keyof typeof ConfirmVariant]

export const SortField = {
  CREATED_AT: 'createdAt',
  FIRST_NAME: 'fn',
  PHONE: 'ph',
} as const

export type SortField = (typeof SortField)[keyof typeof SortField]

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
  state: LeadState
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
