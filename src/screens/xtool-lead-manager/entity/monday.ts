// Monday CRM 통합 고객 — functions-xtool/src/monday/types.ts와 같은 모양이다.
// 원본은 Monday라서 이 화면에서는 읽기만 한다(고칠 것은 Monday에서 고친다).

export interface MondayCustomerSummary {
  consultationCount: number
  visitCount: number
  purchaseCount: number
  surveyCount: number
  sampleTestCount: number
  /** 기술지원팀 기록 — 출장·AS·기술 문의·기타업무. */
  fieldServiceCount: number
  repairCount: number
  techInquiryCount: number
  techTaskCount: number
  latestFieldServiceAt: string | null
  latestRepairAt: string | null
  latestTechInquiryAt: string | null
  /** 아직 끝나지 않은 AS·기술 문의 건수. */
  openRepairCount: number
  openTechInquiryCount: number
  /** AS 부품·공임 청구액 합계. */
  repairAmount: number
  latestConsultationStatus: string | null
  latestConsultationAt: string | null
  latestVisitAt: string | null
  latestPurchaseAt: string | null
  /** 납부 기록(계약금·분할납부) 건수 — 구매가 아니다. */
  paymentCount: number
  /** 온라인(Cafe24) 구매 건수·금액 — purchaseCount·purchaseAmount에 이미
   * 포함된 값을 따로 뗀 것. */
  onlinePurchaseCount: number
  onlinePurchaseAmount: number
  /** 구매(계약) 금액 합계 — 취소 건 제외. */
  purchaseAmount: number
  /** 받은 금액 — 계약 건에서 받은 돈 + 납부 기록. */
  receivedAmount: number
  /** 잔금 = purchaseAmount - receivedAmount. */
  balanceAmount: number
  /** 장기 할부 이자 합계 — 구매 금액과 별개. */
  interestAmount: number
  /** 월별 구매 금액('YYYY-MM' → 금액, 결제일 기준·취소 제외). 예전에 저장된
   * 고객 문서에는 없다. */
  purchaseAmountByMonth?: Record<string, number>
  /** 확인이 필요한 결제 기록 수. */
  issueCount: number
  funnel: MondayCustomerFunnel
  assignees: string[]
  boardNames: string[]
  /** 상담이 들어온 보드마다 가장 최근 상담 접수일 — 최근 접수 순. 이 필드가
   * 생기기 전에 동기화된 고객에는 없다. */
  consultationBoards?: { boardName: string; latestAt: string | null }[]
}

/** 퍼널 통계용 파생값 — 고객 1명이 퍼널의 어디까지 갔는지. */
export interface MondayCustomerFunnel {
  /** 최초 인입일(YYYY-MM-DD). */
  firstContactAt: string | null
  /** 첫 구매(계약)일 — 취소 건 제외. 오프라인·온라인 중 이른 쪽. */
  firstPurchaseAt: string | null
  /** 첫 문의일 — 상담·방문체험·샘플 중 가장 이른 날(구매 제외). 문의 없이
   * 산 고객은 null, 예전에 저장된 고객 문서에는 없다. */
  firstInquiryAt?: string | null
  /** 오프라인(Monday 결제 보드) / 온라인(Cafe24) 각각의 첫 구매일. */
  firstOfflinePurchaseAt: string | null
  firstOnlinePurchaseAt: string | null
  /** 콜백 도달 단계(0~4) — 날짜가 적힌 가장 높은 단계. */
  callbackStage: number
  visitBooked: boolean
  visitCompleted: boolean
  /** 상담이 전부 "오기입"인 고객 — 통계의 모수에서 뺀다. */
  misentry: boolean
  /** 유입 경로 — 가장 이른 상담의 UTM source, 없으면 방문체험의 유입경로. */
  source: string | null
}

/** 목록에 쓰는 고객 1명 — 기록 배열 없이 요약만. */
export interface MondayCustomerListItem {
  /** 대표 번호(숫자만) — 고객의 id. */
  phone: string
  otherPhones: string[]
  /** 보드마다 다르게 적힌 이름 전부 — 많이 쓰인 순. */
  names: string[]
  emails: string[]
  summary: MondayCustomerSummary
  lastUpdatedAt: string | null
}

/** 모든 기록에 붙는 출처. */
interface MondayRecordSource {
  itemId: string
  boardId: string
  boardName: string
  name: string
  /** Monday에서 이 기록을 여는 주소. */
  url: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface MondayConsultation extends MondayRecordSource {
  product: string | null
  status: string | null
  assignee: string | null
  receivedAt: string | null
  closedAt: string | null
  probability: string | null
  notes: string | null
  /** 고객이 웹사이트 폼에 적은 문의 내용 — 그 컬럼이 있는 보드만. 이 필드가
   * 생기기 전에 동기화된 고객 문서에는 없다. */
  inquiryMessage?: string | null
  visitConfirmed: boolean
  quoteIssued: boolean
  callbackDates: string[]
  callbackStage: number
  paidAt: string | null
  notConvertedAt: string | null
  utmCampaign: string | null
  utmMedium: string | null
  utmSource: string | null
  fbc: string | null
  fbp: string | null
}

export interface MondayVisit extends MondayRecordSource {
  visitAt: string | null
  reservedDevice: string | null
  actualDevice: string | null
  status: string | null
  consultationStatus: string | null
  probability: string | null
  assignee: string | null
  source: string | null
  material: string | null
  notes: string | null
  memo: string | null
  quoteIssued: boolean
  callbackDates: string[]
  callbackStage: number
  paidAt: string | null
  notConvertedAt: string | null
}

/** 결제 건의 품목 줄 하나. product는 계약 금액을 이루는 줄(상품·할인),
 * deferred는 "계약금"/"분할납부" 줄, interest는 장기 할부 이자, cancelled는
 * 취소·반품된 품목(온라인 주문). product만 구매 금액에 들어간다. */
export interface MondayPurchaseLine {
  name: string
  product: string | null
  kind: 'product' | 'deferred' | 'interest' | 'cancelled'
  price: number | null
  quantity: number | null
  discount: number | null
  total: number
  memo: string | null
}

/** 구매 1건 = 계약 1건. 금액은 계약 기준 — 계약한 날 상품 금액 전체가 구매
 * 금액이고, 이후 나눠 낸 돈(MondayPayment)은 구매가 아니다. */
export interface MondayPurchase extends MondayRecordSource {
  /** offline은 Monday 오프라인 결제 보드, online은 Cafe24 온라인몰 주문. */
  origin: 'offline' | 'online'
  paidAt: string | null
  orders: string | null
  status: string | null
  channel: string | null
  method: string | null
  pickup: string | null
  businessType: string | null
  assignee: string | null
  memo: string | null
  lines: MondayPurchaseLine[]
  /** 구매(계약) 금액 — product 줄의 합. */
  amount: number
  interestAmount: number
  /** deferred 줄의 합(보통 0 이하) — 이 건에서 받은 돈은 amount + 이 값. */
  deferredAmount: number
  /** 결제 취소 건 — 구매 건수·금액에 들어가지 않는다. */
  cancelled: boolean
  pending: boolean
}

/** 납부 1건 — 이미 맺은 계약의 계약금·분할납부를 낸 기록. */
export interface MondayPayment extends MondayRecordSource {
  paidAt: string | null
  status: string | null
  method: string | null
  assignee: string | null
  memo: string | null
  lines: MondayPurchaseLine[]
  amount: number
  /** 납부할 때 깎아 준 금액(보통 0 이하) — 계약 금액에서 빠진다. 예전에
   * 저장된 고객 문서에는 없다. */
  adjustmentAmount?: number
  /** 잔금을 카드 장기 할부로 낼 때 붙은 이자. 예전 문서에는 없다. */
  interestAmount?: number
  cancelled: boolean
  pending: boolean
}

/** Monday에서 사람이 확인해야 하는 애매한 결제 기록. */
export interface MondayPaymentIssue {
  type:
    | 'payment-without-contract'
    | 'purchase-without-lines'
    | 'deferred-positive'
    | 'overpaid'
    // 같은 날 상담 신청이 2건 이상(오기입 제외) — 결제가 아니라 상담 기록
    // 문제지만 같은 목록으로 온다.
    | 'duplicate-consultation'
  message: string
  itemId: string
  boardName: string
  name: string
  url: string | null
  date: string | null
}

/** 확인 필요 목록의 한 줄 — 어느 고객의 기록인지와 함께. */
export interface MondayPaymentIssueItem extends MondayPaymentIssue {
  phone: string
  customerName: string | null
}

export interface MondaySurvey extends MondayRecordSource {
  createdAt: string | null
  rating: string | null
  device: string | null
  knownFrom: string | null
  importantFactor: string | null
  liked: string | null
  disliked: string | null
  assignee: string | null
}

export interface MondaySampleTest extends MondayRecordSource {
  requestedAt: string | null
  completedAt: string | null
  status: string | null
  device: string | null
  material: string | null
  address: string | null
  assignee: string | null
}

/** 출장 1건(기술지원팀 출장업무 보드) — 설치·점검 방문. */
export interface MondayFieldService extends MondayRecordSource {
  /** 보드의 그룹(신규 출장 건 → 일정 조율 → 일정 확정 → 완료). */
  stage: string | null
  status: string | null
  type: string | null
  receivedAt: string | null
  visitAt: string | null
  region: string | null
  address: string | null
  assignee: string | null
  notes: string | null
  /** 설치 품목. */
  items: Array<{ name: string; quantity: number | null; note: string | null }>
}

/** AS 1건(기술지원팀 AS 보드) — 수리. */
export interface MondayRepair extends MondayRecordSource {
  stage: string | null
  status: string | null
  device: string | null
  serialNumber: string | null
  symptom: string | null
  result: string | null
  address: string | null
  assignee: string | null
  receivedAt: string | null
  completedAt: string | null
  /** 청구한 부품·공임. */
  parts: Array<{
    name: string
    part: string | null
    sku: string | null
    price: number | null
    quantity: number | null
    total: number
  }>
  amount: number
}

/** 기술 문의 1건(기술지원팀 아톡문의 보드). */
export interface MondayTechInquiry extends MondayRecordSource {
  stage: string | null
  status: string | null
  deviceSeries: string | null
  device: string | null
  type: string | null
  content: string | null
  resolution: string | null
  assignee: string | null
  receivedAt: string | null
}

/** 기타업무 1건(기술지원팀 기타업무 보드) — 상세내용에 번호가 적힌 건만. */
export interface MondayTechTask extends MondayRecordSource {
  stage: string | null
  status: string | null
  requester: string | null
  assignee: string | null
  requestedAt: string | null
  startedAt: string | null
  dueAt: string | null
  completedAt: string | null
  details: string | null
}

/** 고객 1명의 전체 기록 — 상세 모달을 열 때 따로 받아온다. */
export interface MondayCustomer extends MondayCustomerListItem {
  consultations: MondayConsultation[]
  visits: MondayVisit[]
  purchases: MondayPurchase[]
  payments: MondayPayment[]
  issues: MondayPaymentIssue[]
  surveys: MondaySurvey[]
  sampleTests: MondaySampleTest[]
  fieldServices: MondayFieldService[]
  repairs: MondayRepair[]
  techInquiries: MondayTechInquiry[]
  techTasks: MondayTechTask[]
  itemCount: number
  boardIds: string[]
}

/** 기술지원팀 보드 종류. */
export type MondayTechKind =
  'fieldService' | 'repair' | 'techInquiry' | 'techTask'

/** 기술 통계의 재료 1줄 — 기술지원팀 기록 하나(functions-xtool
 * monday/tech.ts의 buildTechFacts). 번호가 없어 고객에 묶이지 못한 기록도
 * 들어 있다. 날짜는 YYYY-MM-DD, 없으면 ''. */
export interface MondayTechFact {
  kind: MondayTechKind
  itemId: string
  boardName: string
  name: string
  url: string | null
  /** 둘 이상이면 각자의 실적으로 센다. */
  assignees: string[]
  stage: string | null
  status: string | null
  /** 아직 첫 단계(신규 출장 건·새로 인입된 건·신규 접수 문의·진행전). */
  isNew: boolean
  done: boolean
  /** 접수일(기타업무는 요청일). */
  receivedAt: string
  /** 끝난 날 — 출장은 방문일, AS·기타업무는 완료일. 비어 있으면 마지막
   * 수정일로 대신하고 doneAtGuessed가 켜진다(기술 문의는 늘). */
  doneAt: string
  doneAtGuessed: boolean
  visitAt: string
  device: string | null
  type: string | null
  region: string | null
  amount: number
  /** 유효한 번호가 있어 통합 고객에 묶였는지. */
  linked: boolean
}

/** 유효한 번호가 없어 통합에서 빠진 기록 — Monday에서 번호를 고쳐야 한다. */
export interface MondayMissingPhoneItem {
  id: string
  boardId: string
  boardName: string
  name: string
  /** 전화번호 칸에 적혀 있던 그대로의 값. */
  phoneRaw: string | null
  url: string | null
  updatedAt: string | null
}

/** 하루치 인입 건수 — 그날 상담 보드에 새로 접수된 기록 수(고객이 아니라
 * 기록 단위). 방문체험·샘플테스트·결제는 인입이 아니다. */
export interface MondayDailyInflow {
  /** YYYY-MM-DD (한국 시간) — 접수일. */
  date: string
  total: number
  /** 그중 "오기입" 건 — total에 이미 포함된 값. */
  misentry: number
  /** 보드 이름별 건수 — 합이 total. 인입이 없던 보드는 들어 있지 않다. */
  boards: Record<string, number>
}

/** 판매 통계의 한 줄 — 어느 날, 어느 채널에서, 어떤 제품이 몇 개 팔렸는지.
 * 취소된 결제·주문과 취소·반품된 품목은 들어 있지 않다. */
export interface MondayDailySale {
  /** YYYY-MM-DD. */
  date: string
  /** offline은 Monday 오프라인 결제 보드, online은 Cafe24 온라인몰. */
  origin: 'offline' | 'online'
  /** 제품명 — 오프라인은 하위 아이템 이름, 온라인은 상품명. */
  name: string
  quantity: number
  amount: number
}

/** 아직 끝나지 않은 상담·방문체험 기록 하나 — 통계 탭의 "방치 현황". dueAt이
 * 오늘보다 지났으면 방치다. */
export interface MondayFollowUp {
  /** callback은 상담 보드, visit은 방문체험 보드의 체험 전 기록, sales는
   * 방문체험 보드에서 체험을 마치고 결제·미전환을 아직 정하지 않은 기록(영업
   * 후속 — 영업통계). sales는 11/2 서버 배포 뒤 동기화부터 생긴다. */
  kind: 'callback' | 'visit' | 'sales'
  itemId: string
  boardName: string
  name: string
  url: string | null
  /** 주 담당자 — 담당자 칸의 첫 사람. */
  assignee: string | null
  status: string | null
  /** 방문체험의 체험 상태(일정 연기, 체험 취소, 방문 대기). */
  visitStatus: string | null
  /** Monday 보드의 그룹 이름. */
  group: string | null
  /** 보류 중인지(보류 상태이거나 "보류" 그룹) — 방치가 아니라 보류로 센다. */
  onHold: boolean
  /** 마지막 연락일. */
  lastTouchAt: string | null
  /** 다음 연락 기한 — 보류 종료일 > 상담 마감일 > 마지막 연락일 + 7일. */
  dueAt: string | null
}

/** 개인 KPI의 재료 — 서버(functions-xtool/src/monday/kpi.ts)가 기록마다 짧은
 * 배열로 뽑아 둔 것. 날짜는 YYYY-MM-DD(한국 시간), 없으면 ''. */
export interface MondayKpiFacts {
  /** 상담(오기입 제외): [주 담당자, 접수일, 방문체험 확정일, 결제일,
   * 신규 상담 유입(1/0), Monday item id, 고객명, 보드 id]. 뒤의 값들은 나중에
   * 생겨 예전 데이터엔 없을 수 있다. */
  consultations: [
    string,
    string,
    string,
    string,
    number?,
    string?,
    string?,
    string?,
  ][]
  /** 방문체험: [주 담당자, 방문일, 체험 완료(1/0), 결제일] */
  visits: [string, string, number, string][]
  /** 오프라인 결제: [담당자들(쉼표), 결제일, 구매 금액, 방문체험 담당자,
   *  item id, 고객명, 보드 id, 품목(쉼표), 재구매(1/0)] — 뒤의 다섯은
   *  영업통계가 쓰고, 예전 데이터엔 없다. */
  sales: [
    string,
    string,
    number,
    string,
    string?,
    string?,
    string?,
    string?,
    number?,
  ][]
  /** 상담·결제 줄의 보드 id → 이름·Monday 주소 앞부분(…/boards/{id}). 예전
   * 데이터엔 없다. */
  boards?: Record<string, { name: string; url: string | null }>
}

/** GA ClientId가 적힌 상담 기록 — functions-xtool/src/monday/ga-tracking.ts.
 * "오기입 추적" 탭이 gaClientId로 GA4 이벤트를 찾는다. */
export interface MondayGaConsultation {
  itemId: string
  boardId: string
  boardName: string
  name: string
  url: string | null
  createdAt: string | null
  updatedAt: string | null
  phoneRaw: string | null
  status: string | null
  misentry: boolean
  receivedAt: string | null
  /** GA4 user_pseudo_id 형식("숫자.숫자"). */
  gaClientId: string
}

/** GA4 이벤트 하나 — functions-xtool/src/ga4-bigquery.ts. */
export interface Ga4Event {
  clientId: string
  /** 이벤트 시각(ms). */
  at: number
  name: string
  pageLocation: string | null
  pageTitle: string | null
  sessionId: number | null
  source: string | null
  medium: string | null
  campaign: string | null
  /** 사용자 첫 유입 — 처음 어디서 왔는지. */
  firstSource: string | null
  firstMedium: string | null
  firstCampaign: string | null
  deviceCategory: string | null
  os: string | null
  browser: string | null
  country: string | null
  city: string | null
}

/** GA4 이벤트 수집(배치) 한 번의 결과 — functions-xtool/src/ga-sync.ts. */
export interface GaSyncResult {
  clientIds: number
  newClientIds: number
  writtenDocs: number
  storedEvents: number
  bytesProcessed: number
  /** 다시 읽은 최근 날짜 범위(YYYYMMDD). */
  refreshFrom: string
  refreshTo: string
}

export interface MondayGaTracking {
  consultations: MondayGaConsultation[]
  /** 배치가 모아 둔 이벤트(gaEvents). */
  events: Ga4Event[]
  syncedAt: number | null
  /** 마지막으로 GA4 이벤트를 수집한 시각 — 아직 없으면 null. */
  collectedAt: number | null
  lastResult: GaSyncResult | null
  /** 마지막 수집 뒤에 실패한 적이 있으면 그 이유. */
  lastError: string | null
  fetchedAt: number
}

/** Monday 첨부 파일 하나 — 주소는 한 시간쯤 뒤 만료된다(그래서 열 때마다 새로
 * 받는다). */
export interface MondayAsset {
  id: string
  name: string
  /** 소문자 확장자(jpg, mp4…). */
  extension: string | null
  size: number | null
  url: string | null
  thumbnail: string | null
}

export interface MondayUpdateReply {
  id: string
  author: string | null
  createdAt: string | null
  text: string
}

/** Monday 기록의 업데이트(이름 칸을 누르면 열리는 메모) 하나. */
export interface MondayUpdate extends MondayUpdateReply {
  assets: MondayAsset[]
  replies: MondayUpdateReply[]
}

/** 기록 하나의 메모·파일 — functions-xtool getMondayItemUpdates. */
export interface MondayItemUpdates {
  itemId: string
  name: string
  updates: MondayUpdate[]
  /** 파일 컬럼(증상 자료·기기 사진 등)에 올린 파일. */
  files: MondayAsset[]
}

// 리드 분석 탭의 한 줄과 응답(getMondayLeadFeed) — 서버 타입을 그대로 쓴다.
// 칸을 더할 때 서버(functions-xtool/src/monday/types.ts)만 고치면 화면도 따라온다.
// 매체(channel)는 utm_source를 광고 채널로 묶은 값이다(cmip ROAS 탭과 같은 규칙).
export type {
  MondayAttributionChannel as MondayLeadChannel,
  MondayLeadFeed,
  MondayLeadFeedRow,
} from '../../../../functions-xtool/src/monday/types'
