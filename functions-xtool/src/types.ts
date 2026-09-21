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

/** 접수(리드 유입) 1건 — 같은 고객(전화번호)이 폼을 여러 번 제출할 수 있어
 * 리드 최상위가 아니라 배열 원소로 둔다. device는 optional — 웹 폼 호출부가
 * 항상 device를 같이 보내는 건 아니고(예: 수기 등록 모달엔 기기 입력이 없음),
 * 마이그레이션된 예전 리드에도 있을 수 있어서 필수로 두지 않는다. */
export type IntakeRecord = {
  id: string
  at: number
  device?: Device
}

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
  intakes: IntakeRecord[]
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
  /** 최초 접수 기록(intakes 배열의 첫 원소)의 시각으로 쓰인다. */
  createdAt: number
  /** 최초 접수 기록의 device로 쓰인다 — optional(안 보내는 호출부도 있음). */
  device?: Device
}

export type ValidationResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }
