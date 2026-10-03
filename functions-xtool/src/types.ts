export const Device = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
  'o1',
  'WonderPress',
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

/** 상담 1건 — 상담/구매를 여러 번 할 수 있어 리드 최상위가 아니라 배열 원소로 둔다.
 * externalId/eventId는 이 상담을 등록(또는 재전송)할 때 Meta CAPI에 실제로
 * 실어 보낸 값의 스냅샷 — 나중에 "이 상담 건이 정확히 어떤 이벤트로 잡혔는지"
 * 이벤트 매니저에서 대조해볼 수 있도록 남겨둔다. 재전송하면 그때 값으로
 * 덮어쓴다. */
export type ConsultationRecord = {
  id: string
  at: number
  device: Device
  externalId?: string
  eventId?: string
  /** 이 상담 건에 대한 메모 — 나중에 Monday CRM에 쌓인 상담 메모를 이 필드로
   * 가져올 예정이라 미리 스키마를 만들어둔다. 그 전까지는 수기 입력도 가능. */
  note?: string
}

/** 구매 1건. externalId/eventId는 ConsultationRecord와 같은 이유(이 구매를
 * 등록할 때 Meta CAPI에 실제로 실어 보낸 값의 스냅샷 — 이벤트 매니저와
 * 대조용)로 둔다. */
export type PurchaseRecord = {
  id: string
  at: number
  device: Device
  price: number
  externalId?: string
  eventId?: string
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
  /** 고객 이메일 — 필수가 아니라 없는 리드가 대부분이고, 이 필드가 생기기 전에
   * 만들어진 문서엔 키 자체가 없다. 저장할 땐 utils.normalizeEmail을 거친
   * 값(앞뒤 공백 제거 + 소문자)만 넣는다 — Meta CAPI의 em 해시 규칙과 같은
   * 정규화라, 화면에 보이는 값이 곧 해시되는 값이다. */
  em?: string
  /** 내부 참고용 메모(회사명/직책/동반 구매자 등) — 정형화하지 않고 자유 텍스트로. */
  remarks: string
  intakes: IntakeRecord[]
  consultations: ConsultationRecord[]
  purchases: PurchaseRecord[]
  externalId?: string
  /** 문의 폼이 보낸 GA4 client_id(_ga 쿠키 값에서 "GA1.1."을 뗀 부분). GA4
   * 이벤트를 이 고객의 웹 방문(광고 유입 세션)과 연결하는 데 쓴다. 쿠키가
   * 없었거나 수기 등록한 리드, 이 필드가 생기기 전의 리드엔 없다. */
  ga4ClientId?: string
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
  em?: string
  remarks?: string
  /** 최초 접수 기록(intakes 배열의 첫 원소)의 시각으로 쓰인다. */
  createdAt: number
  /** 최초 접수 기록의 device로 쓰인다 — optional(안 보내는 호출부도 있음). */
  device?: Device
  /** 문의 폼에서만 온다. 쿠키가 없으면 null로 올 수 있다. */
  ga4ClientId?: string | null
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
