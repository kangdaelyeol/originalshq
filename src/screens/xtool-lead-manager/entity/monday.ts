// Monday CRM 통합 고객 — functions-xtool/src/monday/types.ts와 같은 모양이다.
// 원본은 Monday라서 이 화면에서는 읽기만 한다(고칠 것은 Monday에서 고친다).

export interface MondayCustomerSummary {
  consultationCount: number
  visitCount: number
  purchaseCount: number
  surveyCount: number
  sampleTestCount: number
  latestConsultationStatus: string | null
  latestConsultationAt: string | null
  latestVisitAt: string | null
  latestPurchaseAt: string | null
  /** 납부 기록(계약금·분할납부) 건수 — 구매가 아니다. */
  paymentCount: number
  /** 구매(계약) 금액 합계 — 취소 건 제외. */
  purchaseAmount: number
  /** 받은 금액 — 계약 건에서 받은 돈 + 납부 기록. */
  receivedAmount: number
  /** 잔금 = purchaseAmount - receivedAmount. */
  balanceAmount: number
  /** 장기 할부 이자 합계 — 구매 금액과 별개. */
  interestAmount: number
  /** 확인이 필요한 결제 기록 수. */
  issueCount: number
  funnel: MondayCustomerFunnel
  assignees: string[]
  boardNames: string[]
}

/** 퍼널 통계용 파생값 — 고객 1명이 퍼널의 어디까지 갔는지. */
export interface MondayCustomerFunnel {
  /** 최초 인입일(YYYY-MM-DD). */
  firstContactAt: string | null
  /** 첫 구매(계약)일 — 취소 건 제외. */
  firstPurchaseAt: string | null
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
 * deferred는 "계약금"/"분할납부" 줄, interest는 장기 할부 이자. */
export interface MondayPurchaseLine {
  name: string
  product: string | null
  kind: 'product' | 'deferred' | 'interest'
  price: number | null
  quantity: number | null
  discount: number | null
  total: number
  memo: string | null
}

/** 구매 1건 = 계약 1건. 금액은 계약 기준 — 계약한 날 상품 금액 전체가 구매
 * 금액이고, 이후 나눠 낸 돈(MondayPayment)은 구매가 아니다. */
export interface MondayPurchase extends MondayRecordSource {
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

/** 고객 1명의 전체 기록 — 상세 모달을 열 때 따로 받아온다. */
export interface MondayCustomer extends MondayCustomerListItem {
  consultations: MondayConsultation[]
  visits: MondayVisit[]
  purchases: MondayPurchase[]
  payments: MondayPayment[]
  issues: MondayPaymentIssue[]
  surveys: MondaySurvey[]
  sampleTests: MondaySampleTest[]
  itemCount: number
  boardIds: string[]
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
