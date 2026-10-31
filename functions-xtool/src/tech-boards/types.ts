import {
  MondayFieldService,
  MondayRepair,
  MondayTechInquiry,
  MondayTechTask,
} from '../monday/types'

// 기술지원팀 보드 — tech 페이지(/xtool-tech)가 Firestore에서 직접(규칙으로 기술팀만)
// 읽고, 수정은 함수가 Monday에 대신 써 준다. Monday가 원본이고 우리 DB는
// 캐시(+ 수정 기록)다. 들어오는 변경은 Monday webhook과 정기 동기화로 받는다.

/** 보드 이름표 — 보드 이름은 바뀔 수 있어 코드에서는 이 값으로 부른다. */
export type TechBoardKey =
  | 'fieldService'
  | 'repair'
  | 'techInquiry'
  | 'techTask'
  | 'records'
  | 'asRequests'
  | 'parts'
  | 'rentals'
  | 'serials'

/** 업무 보드 기록 — 고객 통합과 같은 변환(monday/tech.ts)에 연락처를 더한 것.
 * phone은 숫자만(010…), 없으면 null. */
export type WithPhone<T> = T & { phone: string | null }

/** 공통 — Monday item 하나에서 온 기록. */
export interface TechRecordBase {
  itemId: string
  /** item 이름(보드의 첫 컬럼). */
  name: string
  /** 그룹 이름 — 보드마다 진행 단계로 쓴다. */
  stage: string | null
  url: string | null
  /** Monday 쪽 생성/수정 시각(ISO). */
  createdAt: string | null
  updatedAt: string | null
}

/** 자료정리 2026 — 기타업무와 같은 모양의 업무 보드. */
export interface TechDocTask extends TechRecordBase {
  status: string | null
  assignees: string[]
  requestedAt: string | null
  completedAt: string | null
  notionUrl: string | null
  details: string | null
}

/** AS 신청서 — 고객이 직접 작성하는 접수 양식. */
export interface TechAsRequest extends TechRecordBase {
  /** 접수일자 — 비어 있으면 item 생성일(한국 날짜). */
  receivedAt: string | null
  purchasedAt: string | null
  /** 온라인 / 오프라인 */
  purchaseChannel: string | null
  /** 수리 받을 기기(시리즈) */
  device: string | null
  /** 기종을 직접 적은 값 */
  model: string | null
  symptom: string | null
  address: string | null
  /** 적힌 그대로의 연락처 */
  phone: string | null
  /** 확인사항 체크 여부 */
  agreed: boolean
  attachmentCount: number
}

/** 부품 마스터 — 부품 목록·재고. */
export interface TechPart extends TechRecordBase {
  nameEn: string | null
  sku: string | null
  /** 분류(기종) — 여러 개면 쉼표로 이어진 그대로. */
  category: string | null
  /** 재고 수량 — 비어 있으면 null(0과 구분). 음수도 그대로 둔다. */
  stock: number | null
  /** 부품 비용(원) */
  cost: number | null
  /** 본사 A/S 가격(세전, USD) */
  priceUsd: number | null
  location: string | null
  usage: string | null
  notes: string | null
  videoUrl: string | null
  hasPhoto: boolean
}

/** 대여품 관리 — 대여 기기 현황. */
export interface TechRental extends TechRecordBase {
  status: string | null
  serialNumber: string | null
  assignees: string[]
  renter: string | null
  renterPhone: string | null
  rentedAt: string | null
  shipAt: string | null
  returnedAt: string | null
  hasPhoto: boolean
}

/** 엑스툴 SN 관리 — 기기 시리얼 대장. item 이름이 SN이다. */
export interface TechSerial extends TechRecordBase {
  serialNumber: string
  device: string | null
  receivedAt: string | null
  notes: string | null
  /** 연결된 기록의 이름들(Monday 연결 컬럼에 보이는 글자 그대로). */
  links: {
    fieldService: string[]
    repair: string[]
    rental: string[]
  }
  hasPhoto: boolean
}

export interface TechBoardRecords {
  fieldService: WithPhone<MondayFieldService>
  repair: WithPhone<MondayRepair>
  techInquiry: WithPhone<MondayTechInquiry>
  techTask: WithPhone<MondayTechTask>
  records: TechDocTask
  asRequests: TechAsRequest
  parts: TechPart
  rentals: TechRental
  serials: TechSerial
}

/** 보드 컬럼 — 화면의 편집 칸을 그리는 재료. */
export interface TechColumn {
  id: string
  title: string
  /** Monday 컬럼 타입(text, status, date, people …) */
  type: string
  /** tech 페이지에서 고칠 수 있는지 — 미러·연결·파일·버튼 등은 false. */
  writable: boolean
  /** 상태·드롭다운의 고를 수 있는 값(Monday 설정 순서) */
  options?: string[]
}

export interface TechGroup {
  id: string
  title: string
}

export interface TechSyncResult {
  ok: boolean
  /** 동기화를 마친 시각(ms) */
  at: number
  count: number
  /** 바뀌어서 다시 쓴 item 수(나머지는 그대로라 건너뜀) */
  written?: number
  deleted?: number
  error?: string
}

/** techBoardMeta/{key} — 보드 이름·컬럼·그룹·동기화 상태. */
export interface TechBoardMeta {
  key: TechBoardKey
  boardId: string
  name: string
  columns: TechColumn[]
  groups: TechGroup[]
  /** 마지막으로 전체 동기화에 성공한 시각(ms) */
  syncedAt: number | null
  lastSync: TechSyncResult | null
  /** 우리가 만든 Monday webhook — 다시 설정할 때 지우고 새로 만든다. */
  webhooks?: { ids: string[]; at: number; errors: string[] }
}

/** Monday에 적힌 값 그대로 — text는 화면용 글자(한국 시간), value는 원본 JSON. */
export interface TechCellValue {
  text: string
  value: string | null
}

/** techItems/{itemId} — Monday item 하나. */
export interface TechItemDoc<K extends TechBoardKey = TechBoardKey> {
  itemId: string
  boardKey: K
  boardId: string
  name: string
  groupId: string | null
  /** 화면이 쓰는 정리된 기록 */
  record: TechBoardRecords[K]
  /** 컬럼 id → 값 — 편집 칸의 처음 값 */
  values: Record<string, TechCellValue>
  createdAt: string | null
  updatedAt: string | null
  /** 우리가 이 문서를 마지막으로 쓴 시각(ms) */
  syncedAt: number
  /** 내용이 바뀌었는지 가리는 값 — 같으면 다시 쓰지 않는다. */
  hash: string
}

/** techMeta/mondayUsers — 담당자 칸에 고를 수 있는 Monday 사용자. */
export interface TechMondayUser {
  id: string
  name: string
  email: string
  enabled: boolean
}

/** 화면이 보내는 칸 값 — 컬럼 타입마다 모양이 다르다(빈 값은 지우기). */
export type TechEditValue =
  | string
  | string[]
  | boolean
  | { date: string; time?: string | null }
  | { url: string; text?: string }
  | null

export interface TechEditInput {
  boardKey: TechBoardKey
  /** 수정할 item — 새로 만들 때는 없다. */
  itemId?: string
  name?: string
  groupId?: string
  /** 컬럼 id → 새 값 */
  columns?: Record<string, TechEditValue>
}

export interface TechChange {
  field: string
  title: string
  before: string | null
  after: string | null
}

/** techEditLogs/{auto} — 누가 무엇을 바꿨는지(Monday 활동 로그에는 API 키 주인만
 * 남아서, 실제로 바꾼 사람은 여기에만 남는다). */
export interface TechEditLog {
  at: number
  action: 'update' | 'create'
  boardKey: TechBoardKey
  boardName: string
  itemId: string | null
  itemName: string
  by: { email: string; name: string; uid: string }
  changes: TechChange[]
  ok: boolean
  error?: string
}
