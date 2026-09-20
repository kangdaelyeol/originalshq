import { Device } from './entity'

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
  REMARKS: 'remarks',
  CREATED_AT: 'createdAt',
} as const

export type EditingField = (typeof EditingField)[keyof typeof EditingField]

export const ConfirmVariant = {
  DELETE: 'delete',
  REGISTER_CONSULTATION: 'register_consultation',
  REGISTER_PURCHASE: 'register_purchase',
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
  remarks: string
  createdAt: string // <input type="datetime-local"> 바인딩용 문자열
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
  remarks: '',
  createdAt: '',
}

/** 상담/구매 "등록" 확인 모달에서 쓰는 최소 입력폼 — price는 구매 등록에서만 쓴다. */
export type RegisterFormValues = {
  device: Device
  at: string // <input type="datetime-local"> 바인딩용 문자열, 빈 값이면 지금 시각
  price: string
}

export const INITIAL_REGISTER_FORM: RegisterFormValues = {
  device: 'F2Ultra',
  at: '',
  price: '',
}

export interface Timestamp {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}
