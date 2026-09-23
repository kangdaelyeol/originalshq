export const Device = {
  F2: 'F2',
  F2_ULTRA: 'F2Ultra',
  F2_ULTRA_UV: 'F2UltraUV',
  P3: 'P3',
  DTF: 'DTF',
  METAL_FAB: 'Metalfab',
  M2: 'M2',
  O1: 'o1',
  ETC: '기타',
} as const

export type Device = (typeof Device)[keyof typeof Device]

export const LeadState = {
  NEW: 'new',
  CONTACTED: 'contacted',
  PURCHASED: 'purchased',
} as const

export type LeadState = (typeof LeadState)[keyof typeof LeadState]

/** 접수(리드 유입) 1건 — 같은 고객(전화번호)이 폼을 여러 번 제출할 수 있어
 * 리드 최상위가 아니라 배열 원소로 둔다. device는 optional — 지금 리드 생성
 * 흐름(웹 폼/수기 등록)엔 기기 입력이 없어서(기기는 상담 등록 때 정해짐) 새로
 * 만들어지는 접수엔 항상 비어 있고, 마이그레이션된 예전 리드에만 값이 있다. */
export type IntakeRecord = {
  id: string
  at: number
  device?: Device
}

/** 상담 1건 — 상담/구매를 여러 번 할 수 있어 리드 최상위가 아니라 배열 원소로 둔다.
 * externalId/eventId는 이 상담을 등록(또는 재전송)할 때 Meta CAPI에 실제로
 * 보낸 값의 스냅샷 — 이벤트 매니저와 대조해볼 수 있도록 표시용으로 갖고 있다.
 * 재전송하면 최신 값으로 덮어써진다. */
export type ConsultationRecord = {
  id: string
  at: number
  device: Device
  externalId?: string
  eventId?: string
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

/** 저장값이 아니라 화면 표시용 파생값 — 상담/구매 배열 길이로만 계산한다.
 * 기존 상태 뱃지(new/contacted/purchased 3색)를 그대로 재사용하기 위해 남겨둔다.
 * 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수 있어 방어적으로
 * 기본값을 둔다. */
export const getLeadState = (lead: Lead): LeadState => {
  if ((lead.purchases ?? []).length > 0) return LeadState.PURCHASED
  if ((lead.consultations ?? []).length > 0) return LeadState.CONTACTED
  return LeadState.NEW
}

/** 리드의 가장 최근 접수 시각 — 정렬(접수일 기준)에 쓴다. 접수 이력이 없으면
 * (이론상 없어야 하지만 방어적으로) 0. */
export const latestIntakeAt = (lead: Lead): number =>
  (lead.intakes ?? []).reduce((max, i) => Math.max(max, i.at), 0)

/** 리드의 가장 최근 접수 이력(레코드 전체) — 상담 등록 폼의 기본값(접수 일시·
 * 기기)을 채울 때 쓴다. 접수 이력이 없으면 null. */
export const latestIntake = (lead: Lead): IntakeRecord | null => {
  const intakes = lead.intakes ?? []
  if (intakes.length === 0) return null
  return intakes.reduce((latest, i) => (i.at > latest.at ? i : latest))
}
