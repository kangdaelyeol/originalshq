/**
 * 통합 CRM Firestore 스키마
 * 원칙
 *  1) 문서 ID는 항상 결정적(deterministic) — 재실행해도 같은 문서에 덮어씀
 *  2) 원본(raw)은 절대 버리지 않음 — 파싱 규칙이 바뀌어도 Monday 재호출 불필요
 *  3) 조인이 없으므로, 화면 단위로 필요한 최소 필드는 복제(denormalize)
 */

import type { Timestamp } from '../types'

/* ────────────────────────────────────────────────────────────── */
/*  0. 원본 미러 — source_records/{mon_{boardId}_{itemId}}          */
/* ────────────────────────────────────────────────────────────── */

export interface SourceRecord {
  /** 문서 ID = `mon_${boardId}_${itemId}` — 멱등성의 핵심 */
  sourceSystem: 'monday'
  boardId: string
  boardName: string
  itemId: string
  parentItemId?: string // 하위 아이템인 경우
  /** Monday 컬럼 원본 그대로. 컬럼 id → 값 */
  raw: Record<string, unknown>
  /** Monday의 updated_at. 순서 역전(stale write) 방지에 사용 */
  sourceUpdatedAt: Timestamp
  ingestedAt: Timestamp
  /** 이 원본이 만들어낸 정규화 문서들 */
  resolvedUserId?: string
  resolvedDocPath?: string
  parseConfidence?: number
  status: 'pending' | 'resolved' | 'needs_review' | 'ignored'
}

/* ────────────────────────────────────────────────────────────── */
/*  1. 고객 — users/{userId}                                       */
/* ────────────────────────────────────────────────────────────── */

export interface Contact {
  name: string
  role?: string // "대표", "실장", "제과장" 등
  phones: string[] // E.164
  email?: string
  isPrimary?: boolean
}

export interface User {
  /** 문서 ID = 합성키(ULID). 전화번호 아님. */
  userId: string

  kind: 'individual' | 'organization'
  /** 리스트/검색에 쓰는 대표 표기 */
  displayName: string
  orgName?: string
  /** 조직이면 담당자 여러 명 */
  contacts: Contact[]

  /** 정규화된 전체 전화번호 (E.164). array-contains 쿼리용 */
  phones: string[]
  emails: string[]
  /** 표기 변형 전부 — 검색 매칭용 평탄화 */
  aliases: string[]

  /* ── Meta CAPI 대응 ──
     원본 이름은 절대 쪼개서 저장하지 않는다. fn/ln 분리는 전송 시점 유틸이 담당.
     분리 규칙을 고쳐도 원본이 남아 있으면 재전송으로 복구된다. */
  /** Monday Name 컬럼 원문. 파싱 실패해도 반드시 보존 */
  nameRaw: string[]
  /** phones 기준 결정적 파생값. buildExternalId() 참조 */
  externalId?: string
  /** fn/ln 전송 가능 여부. 회사명뿐이거나 미결이면 false */
  nameSendable: boolean

  addresses: Array<{
    label?: string // "설치지", "배송지"
    postalCode?: string
    address: string
    source: string
  }>

  /** 내부 담당자 (staff.staffId) — 복수 가능 */
  assigneeIds: string[]

  /* ── 롤업: 리스트 화면이 users 컬렉션만 읽고 끝나도록 ── */
  stage?: 'lead' | 'consulting' | 'experienced' | 'customer' | 'churned'
  lastContactAt?: Timestamp
  lastPurchaseAt?: Timestamp
  purchaseCount: number
  lifetimeValue: number // KRW
  asOpenCount: number
  tags: string[] // "B2B", "지원사업", "제주" 등

  /* ── 병합 이력 ── */
  mergedFrom: string[] // 흡수한 userId 목록
  canonicalUserId?: string // 이 문서가 패자면 승자 포인터 (tombstone)

  /** 이 유저를 만든 모든 원본 */
  sourceRefs: string[] // ["mon_1234_5678", ...]

  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 전화번호 유니크 인덱스 — phone_index/{+821012345678} */
export interface PhoneIndex {
  userId: string
  addedAt: Timestamp
  /** 대표번호처럼 여러 유저가 공유하면 true (유니크 강제 해제) */
  shared?: boolean
}

/** email_index/{email} — 동일 패턴 */
export interface EmailIndex {
  userId: string
  addedAt: Timestamp
}

/* ────────────────────────────────────────────────────────────── */
/*  2. 내부 직원 — staff/{staffId}                                 */
/* ────────────────────────────────────────────────────────────── */

export interface Staff {
  staffId: string
  name: string
  mondayUserId?: string
  active: boolean // "삭제된 팀원" → false
  aliases: string[] // Monday 표기 변형
}

/* ────────────────────────────────────────────────────────────── */
/*  3. 행위 컬렉션 — 전부 top-level + userId                        */
/*     (서브컬렉션이 아닌 이유: 유저 병합 시 필드 1개만 갱신하면 됨)    */
/* ────────────────────────────────────────────────────────────── */

interface EventBase {
  /** 문서 ID = `mon_${boardId}_${itemId}` */
  userId: string
  /** 매칭 실패 시 null — 고아 레코드로 남기고 나중에 붙임 */
  userIdResolved: boolean
  sourceRecordId: string
  sourceBoardName: string
  assigneeIds: string[]
  occurredAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  sourceUpdatedAt: Timestamp
  /** 스냅샷: 이벤트 발생 시점의 고객 표기. 리스트에서 users를 안 읽어도 됨 */
  customerSnapshot: { displayName: string; phone?: string }
}

export interface Purchase extends EventBase {
  type: 'purchase'
  paidAt: Timestamp
  /** 하위 아이템 = 라인 아이템. 항상 같이 읽고 개수가 유계 → 임베드 */
  lineItems: Array<{
    sku?: string
    name: string
    listPrice?: number
    unitPrice?: number
    quantity: number
    discount?: number // 할인은 음수 라인으로 들어오기도 함
    finalAmount: number
    note?: string
  }>
  totalAmount: number
  /** lineItems 합계와 totalAmount 불일치 시 true — 검토 대상 */
  totalMismatch: boolean
  channel?: string // "B2B DTF", "방문체험", "기타오프라인"
  paymentMethod?: string // 카드/현금/…
  deliveryMethod?: string
  hasBusinessNumber: boolean
  status: string // 결제완료(예약) / 출고완료(차감) …
  note?: string
}

export interface Consultation extends EventBase {
  type: 'consultation'
  stage: string // 신규 상담 유입 / 콜백1~4단계 / 보류 / 미전환 / 결제
  probability?: '매우 높음' | '높음' | '중간' | '낮음'
  interestedProducts: string[]
  /** 상담내역은 여러 통화가 누적된 긴 텍스트 — 날짜별로 쪼개면 더 좋음 */
  notes: Array<{ at?: Timestamp; text: string }>
  dueAt?: Timestamp
  callbackDates: Timestamp[]
  quotationIssued: boolean
  attribution?: {
    utmCampaign?: string
    utmMedium?: string
    utmSource?: string
    fbc?: string
    fbp?: string
  }
  firstResponseSeconds?: number // "첫콜까지 걸린 시간"
  inquiryType?: string
  inquiryDetail?: string
}

export interface Visit extends EventBase {
  type: 'visit' // 방문체험 / 주말방문체험 통합
  visitAt: Timestamp
  isWeekend: boolean
  reservedDevices: string[]
  actualDevices: string[]
  materials: string[]
  status: string
  inflowChannel?: string
  surveySent: boolean
  surveyScore?: number // 만족도 조사 보드에서 조인
  memo?: string
}

export interface AsTicket extends EventBase {
  type: 'as'
  receivedAt?: Timestamp
  purchasedAt?: Timestamp
  purchaseChannel?: '온라인' | '오프라인'
  deviceModel?: string
  deviceSerial?: string
  symptom: string
  resolution?: string
  status: string
  shippingAddress?: string
  closedAt?: Timestamp
}

export interface FieldService extends EventBase {
  type: 'field_service' // 출장/설치
  serviceType: string // 방문 설치 등
  status: string
  scheduledAt?: Timestamp
  region?: string
  address: string
  installItems: Array<{ name: string; quantity: number; note?: string }>
  stockDeducted: boolean
}

export interface Shipment extends EventBase {
  type: 'shipment'
  paidAt?: Timestamp
  scheduledShipAt?: Timestamp
  shippedAt?: Timestamp
  postalCode?: string
  address: string
  items: Array<{ name: string; quantity: number }>
  trackingNumber?: string
  status: string
  channel: '온라인' | '오프라인'
  /** 연결된 구매 문서 */
  purchaseId?: string
}

export interface SampleTest extends EventBase {
  type: 'sample_test'
  requestedAt: Timestamp
  material: string
  testDevices: string[]
  status: string
  reportUrl?: string
  sampleAddress?: string
  completedAt?: Timestamp
}

export interface Inquiry extends EventBase {
  type: 'inquiry' // 아톡문의 등
  channel: string
  deviceCategory?: string
  deviceModel?: string
  inquiryType?: string
  content: string
  attachments: string[]
  status: string
}

/* ────────────────────────────────────────────────────────────── */
/*  4. 고객 360 타임라인 — users/{userId}/timeline/{eventId}        */
/*     행위 컬렉션 저장 시 fan-out. 상세 화면 1회 쿼리로 끝냄.        */
/* ────────────────────────────────────────────────────────────── */

export interface TimelineEntry {
  type:
    | Purchase['type']
    | Consultation['type']
    | Visit['type']
    | AsTicket['type']
    | FieldService['type']
    | Shipment['type']
    | SampleTest['type']
    | Inquiry['type']
  at: Timestamp
  title: string // "M2 20W 올인원 콤보 세트 결제"
  amount?: number
  status?: string
  assigneeIds: string[]
  /** 상세는 클릭 시 이 경로로 1건만 읽음 */
  ref: string // "purchases/mon_1234_5678"
}

/* ────────────────────────────────────────────────────────────── */
/*  5. 검토 큐 — review_queue/{id}                                 */
/* ────────────────────────────────────────────────────────────── */

export interface ReviewItem {
  kind: 'parse' | 'merge' | 'orphan' | 'amount_mismatch'
  sourceRecordId: string
  rawValue: string
  parsed: unknown
  confidence: number
  /** merge 후보 */
  candidateUserIds?: string[]
  createdAt: Timestamp
  resolvedAt?: Timestamp
  resolvedBy?: string
  decision?: unknown
}

/* ────────────────────────────────────────────────────────────── */
/*  6. 웹훅 원장 — ingest_events/{mondayEventId}                    */
/*     웹훅은 여기 쓰고 즉시 200 반환. 변환은 워커가 담당.            */
/* ────────────────────────────────────────────────────────────── */

export interface IngestEvent {
  boardId: string
  itemId: string
  eventType: string // create_item / change_column_value / …
  payload: unknown
  receivedAt: Timestamp
  processedAt?: Timestamp
  attempts: number
  error?: string
}
