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
  REMARKS: 'remarks',
  CONSULTATION_AT: 'consultationAt',
  PURCHASE_AT: 'purchaseAt',
} as const

export type SortField = (typeof SortField)[keyof typeof SortField]

export type SortDirection = 'asc' | 'desc'

export const PAGE_SIZE_OPTIONS = [15, 30, 50] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

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
  /** 접수 기기 — 그냥 "등록"(고객 정보만)에서도 최초 접수에 실어 보내고,
   * "상담 등록"/"구매 등록"(고객 정보 + 상담/구매 동시 등록)에서는 상담/구매
   * 기기로도 그대로 쓴다. */
  device: Device
  /** "구매 등록"에서만 쓰는 구매 금액 — 나머지 버튼("등록"/"상담 등록")에는
   * 필요 없어 빈 문자열로 둬도 무방하다. */
  price: string
  /** "상담 등록"/"구매 등록"이 이어서 보내는 Meta CAPI 호출에 test_event_code를
   * 실어 보낼지 여부 — RegisterFormValues와 같은 용도. */
  isTest: boolean
  testEventCode: string
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
  device: 'F2Ultra',
  price: '',
  isTest: false,
  testEventCode: '',
}

/** 상담/구매 "등록" 확인 모달에서 쓰는 최소 입력폼 — price는 구매 등록에서만 쓴다.
 * isTest/testEventCode는 Meta CAPI 호출에 test_event_code를 실어 보낼지 여부 —
 * 체크하고 코드를 입력하면 이벤트 관리자의 테스트 이벤트로 잡힌다. */
export type RegisterFormValues = {
  device: Device
  at: string // <input type="datetime-local"> 바인딩용 문자열, 빈 값이면 지금 시각
  price: string
  isTest: boolean
  testEventCode: string
}

export const INITIAL_REGISTER_FORM: RegisterFormValues = {
  device: 'F2Ultra',
  at: '',
  price: '',
  isTest: false,
  testEventCode: '',
}

export interface Timestamp {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}
