export const Device = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
  'o1',
  '기타',
] as const

export type Device = (typeof Device)[number]

/** 상담 1건 — 상담/구매를 여러 번 할 수 있어 리드 최상위가 아니라 배열 원소로 둔다. */
export type ConsultationRecord = {
  id: string
  at: number
  device: Device
}

/** 구매 1건. */
export type PurchaseRecord = {
  id: string
  at: number
  device: Device
  price: number
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
  /** 내부 참고용 메모(회사명/직책/동반 구매자 등) — 정형화하지 않고 자유 텍스트로. */
  remarks: string
  consultations: ConsultationRecord[]
  purchases: PurchaseRecord[]
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
  remarks?: string
  createdAt: number
}

export const TimestampField = ['createdAt'] as const

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
