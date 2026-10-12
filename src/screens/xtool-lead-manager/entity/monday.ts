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
  assignees: string[]
  boardNames: string[]
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
  paidAt: string | null
  notConvertedAt: string | null
}

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
