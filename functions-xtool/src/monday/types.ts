/** 동기화 대상으로 등록한 Monday 보드 1개 — mondayBoards/{boardId}.
 * 어떤 보드를 가져올지는 코드가 아니라 이 컬렉션이 정한다(등록/해제는
 * registerMondayBoard / removeMondayBoard). */
export interface MondayBoard {
  /** Monday 보드 id — 문서 id와 같다. */
  id: string
  /** 보드 이름 — 동기화할 때마다 Monday 값으로 갱신한다. */
  name: string
  /** 보드의 컬럼 정의 — 동기화할 때마다 Monday 값으로 갱신한다. */
  columns: MondayColumn[]
  /** 이 보드가 담는 기록의 종류 — 동기화할 때마다 컬럼 제목으로 추정해
   * 갱신한다. 통합 고객의 어느 목록(상담/방문체험/구매…)에 들어갈지를 정한다. */
  kind: MondayBoardKind
  /** 휴대폰번호가 들어 있는 컬럼 id. 등록할 때 직접 지정하면 그 값을 그대로
   * 쓰고, 비워두면(null) 동기화 때마다 컬럼 타입/제목으로 추정한다
   * (helper.ts의 detectPhoneColumnId). */
  phoneColumnId: string | null
  /** 이번 동기화에서 실제로 쓴 휴대폰 컬럼 id — 추정 결과를 확인하는 용도.
   * 못 찾았으면 null이고, 그 보드의 item은 전부 phone이 null로 저장된다. */
  resolvedPhoneColumnId: string | null
  registeredAt: number
  /** 마지막 동기화 결과 — 한 번도 안 돌았으면 null. */
  lastSync: MondayBoardSyncResult | null
}

export interface MondayColumn {
  id: string
  title: string
  /** Monday 컬럼 타입 — 'phone', 'text', 'status', 'date', 'mirror' 등. */
  type: string
}

/** Monday item(고객 1건) — mondayItems/{itemId}. 보드별 하위 컬렉션이 아니라
 * 한 컬렉션에 평탄하게 둔다: 나중에 여러 보드에 흩어진 같은 고객을 phone으로
 * 묶어야 해서, 보드를 가로지르는 조회가 기본이기 때문이다. */
export interface MondayItem {
  /** Monday item id — 문서 id와 같다. */
  id: string
  boardId: string
  boardName: string
  /** item 이름(보드의 첫 컬럼) — 보통 고객명. */
  name: string
  groupId: string | null
  groupTitle: string | null
  /** Monday에서 이 item을 여는 주소 — 휴대폰번호가 없는 고객을 Monday에서
   * 바로 고칠 수 있게 저장해 둔다. */
  url: string | null
  /** 중복 고객 판단 기준(대표 번호) — phones의 첫 번째 값. 숫자만 남기고 국내
   * 표기(0으로 시작)로 맞춘 값이며, 휴대폰 컬럼을 못 찾았거나 값이 비었거나
   * 번호로 볼 수 없으면 null이다 — phone == null 인 문서가 "Monday에서 고쳐야
   * 할 고객" 목록이다. */
  phone: string | null
  /** 휴대폰 컬럼에 적힌 번호 전부(적힌 순서, 정규화) — 한 칸에 번호를 두 개
   * 적어둔 고객이 있어서 배열로도 둔다. 다른 보드에서는 두 번째 번호로만
   * 등록돼 있을 수 있으므로, 통합할 때는 이 배열로 찾는다(array-contains). */
  phones: string[]
  /** 휴대폰 컬럼에 적혀 있던 그대로의 값 — 왜 phone이 null인지 확인하는 용도.
   * 휴대폰 컬럼이 item 이름인 보드에서는 이름 칸의 값이다. */
  phoneRaw: string | null
  /** 컬럼 id → 값. 보드마다 컬럼이 달라서 가공하지 않고 그대로 담는다. */
  columns: Record<string, MondayItemColumn>
  /** Monday 쪽 생성/수정 시각(ISO 문자열). */
  createdAt: string | null
  updatedAt: string | null
  /** 이 문서를 마지막으로 쓴 동기화 시각(ms). */
  syncedAt: number
}

export interface MondayItemColumn {
  title: string
  type: string
  /** 화면에 보이는 값 — 수식/미러/연결 컬럼은 계산된 값(display_value). */
  text: string
}

export interface MondayBoardSyncResult {
  ok: boolean
  /** 동기화를 마친(또는 실패한) 시각(ms). */
  at: number
  /** Monday에서 받아온 item 수 = 저장한 문서 수. */
  itemCount: number
  /** Monday에서 사라져 우리 DB에서도 지운 문서 수. */
  deletedCount: number
  /** phone이 null로 저장된 item 수. */
  missingPhoneCount: number
  /** 실패했을 때만 — 오류 메시지. */
  error?: string
}

export interface MondaySyncSummary {
  boards: Array<{ boardId: string; name: string } & MondayBoardSyncResult>
  okCount: number
  failedCount: number
  /** 동기화 뒤 통합 고객을 다시 만든 결과 — 그 단계가 실패했으면 null(item은
   * 이미 저장됐고, rebuildMondayCustomers로 다시 돌릴 수 있다). */
  customers: MondayCustomerRebuildResult | null
}

/** previewBoard의 결과 — 저장하지 않고 보드 하나를 읽어본 요약. */
export interface MondayBoardPreview {
  boardId: string
  name: string
  itemCount: number
  /** 컬럼별로 값이 채워진 item 수 — 0이면 그 컬럼 타입의 값이 안 내려오고
   * 있다는 신호다. */
  columns: Array<MondayColumn & { filledCount: number }>
  phone: {
    /** 실제로 쓴 휴대폰 컬럼 id — 못 찾았으면 null. */
    columnId: string | null
    missingCount: number
    /** 이 보드 안에서 2건 이상 겹치는 번호의 수. */
    duplicatedPhoneCount: number
    missingSamples: Array<Pick<MondayItem, 'id' | 'name' | 'phoneRaw' | 'url'>>
  }
  /** 저장될 문서 예시. */
  samples: MondayItem[]
}

/** 보드가 어떤 종류의 기록을 담는지 — 통합 고객(MondayCustomer)의 어느 목록에
 * 들어갈지를 정한다. 보드의 컬럼 제목으로 추정한다(customers.ts의
 * detectBoardKind). */
export type MondayBoardKind =
  | 'consultation' // 상담 보드(기기별 B2B 보드, 기타 온라인/오프라인)
  | 'visit' // 방문체험 보드
  | 'purchase' // 오프라인 결제 보드
  | 'survey' // 방문체험 후 만족도 조사
  | 'sampleTest' // 샘플테스트
  | 'other'

/** 통합 고객 1명 — mondayCustomers/{phone}. 여러 보드에 흩어진 같은 번호의
 * item을 하나로 묶은 것이며, 동기화가 끝날 때마다 mondayItems 전체에서 다시
 * 만든다(직접 고치지 않는다 — 원본은 Monday다). 유효한 번호가 없는 item은
 * 여기에 들어오지 않는다. */
export interface MondayCustomer {
  /** 대표 번호 — 문서 id와 같다. */
  phone: string
  /** 이 고객의 item들에 함께 적혀 있던 다른 번호(유선, 두 번째 휴대폰 등). */
  otherPhones: string[]
  /** 보드마다 다르게 적힌 이름을 전부 — 많이 쓰인 순. */
  names: string[]
  emails: string[]
  consultations: MondayConsultation[]
  visits: MondayVisit[]
  purchases: MondayPurchase[]
  surveys: MondaySurvey[]
  sampleTests: MondaySampleTest[]
  /** 이 고객이 등장한 item 수(위 목록들의 합 + 종류를 모르는 보드의 item). */
  itemCount: number
  /** 이 고객이 등장한 보드 id들. */
  boardIds: string[]
  /** 묶인 item들 중 Monday에서 가장 최근에 수정된 시각(ISO). */
  lastUpdatedAt: string | null
  /** 내용이 바뀌었는지 가리는 지문 — 같으면 다시 쓰지 않는다. */
  hash: string
  syncedAt: number
}

/** 모든 기록에 공통으로 붙는 출처 — 원본(mondayItems/{itemId})과 Monday 화면
 * 으로 되돌아갈 수 있게 한다. */
interface MondayRecordSource {
  itemId: string
  boardId: string
  boardName: string
  /** 그 item에 적힌 이름. */
  name: string
  url: string | null
  updatedAt: string | null
}

/** 상담 1건. 날짜는 Monday가 준 그대로(YYYY-MM-DD)이고, 값이 없으면 null. */
export interface MondayConsultation extends MondayRecordSource {
  /** 관심 기기 — 그 컬럼이 있는 보드(기타 오프라인)만. 기기별 보드는
   * boardName이 곧 기기다. */
  product: string | null
  status: string | null
  assignee: string | null
  receivedAt: string | null
  closedAt: string | null
  probability: string | null
  notes: string | null
  visitConfirmed: boolean
  quoteIssued: boolean
  /** 콜백 1~4단계 진행일 — 진행한 단계까지만, 단계 순서대로. */
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
  /** 체험 상태(방문 완료, 노쇼 등). */
  status: string | null
  /** 상담 진행 상태. */
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
  /** 주문 목록(하위 아이템 이름들을 이어 붙인 값). */
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

/** rebuildCustomers의 결과. */
export interface MondayCustomerRebuildResult {
  /** 통합 고객 수. */
  customerCount: number
  /** 그중 이번에 실제로 쓴(새로 생겼거나 내용이 바뀐) 문서 수. */
  writtenCount: number
  /** 더는 해당 item이 없어 지운 고객 문서 수. */
  deletedCount: number
  /** 유효한 번호가 없어 통합에서 빠진 item 수. */
  excludedItemCount: number
}
