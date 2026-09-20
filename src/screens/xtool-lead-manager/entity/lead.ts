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

/** 저장값이 아니라 화면 표시용 파생값 — 상담/구매 배열 길이로만 계산한다.
 * 기존 상태 뱃지(new/contacted/purchased 3색)를 그대로 재사용하기 위해 남겨둔다.
 * 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수 있어 방어적으로
 * 기본값을 둔다. */
export const getLeadState = (lead: Lead): LeadState => {
  if ((lead.purchases ?? []).length > 0) return LeadState.PURCHASED
  if ((lead.consultations ?? []).length > 0) return LeadState.CONTACTED
  return LeadState.NEW
}
