// 기술지원팀 전용 보드(고객 통합과 무관) — tech 페이지(/xtool-tech)만 읽는다.

/** 보드 이름표 — 보드 이름은 바뀔 수 있어 코드에서는 이 값으로 부른다. */
export type TechBoardKey =
  | 'records'
  | 'asRequests'
  | 'parts'
  | 'rentals'
  | 'serials'

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
  records: TechDocTask[]
  asRequests: TechAsRequest[]
  parts: TechPart[]
  rentals: TechRental[]
  serials: TechSerial[]
}

export interface TechBoardSyncResult {
  ok: boolean
  /** 동기화를 마친 시각(ms) */
  at: number
  count: number
  error?: string
}

/** techBoards/{key} 문서 하나 — 보드 하나의 기록 전부. */
export interface TechBoardDoc<K extends TechBoardKey = TechBoardKey> {
  key: K
  boardId: string
  /** Monday 보드 이름(마지막 동기화 때) */
  name: string
  records: TechBoardRecords[K]
  /** 마지막으로 기록을 저장한 시각(ms) — 실패한 동기화는 바꾸지 않는다. */
  syncedAt: number | null
  lastSync: TechBoardSyncResult | null
}
