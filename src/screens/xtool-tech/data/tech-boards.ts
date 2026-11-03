// 기술지원팀 Monday 보드 — Firestore 캐시(techItems·techBoardMeta)를 규칙으로 직접 읽는다
// (기술팀만). 수정은 functions-xtool의 techUpdateItem·techCreateItem이 Monday에 대신 쓴다.
// 서버 쪽 정의: functions-xtool/src/tech-boards/types.ts, monday/types.ts(MondayFieldService 등).

import { httpsCallable } from 'firebase/functions'
import { xtoolFirebase } from '@/xtool-auth/firebase'

export type TechBoardKey =
  | 'fieldService'
  | 'repair'
  | 'records'
  | 'techInquiry'
  | 'techTask'
  | 'asRequests'
  | 'parts'
  | 'rentals'
  | 'serials'

interface RecordBase {
  itemId: string
  /** item 이름 — 업무 보드는 고객 이름(번호를 뗀), 자료정리·기타업무는 업무 이름. */
  name: string
  /** Monday 그룹 이름 — 진행 단계. */
  stage: string | null
  status: string | null
  url: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 출장업무 */
export interface FieldServiceRecord extends RecordBase {
  type: string | null
  receivedAt: string | null
  visitAt: string | null
  /** 방문 시각(14:00) — Monday 날짜 칸에 시간까지 적은 건만. */
  visitTime: string | null
  region: string | null
  address: string | null
  assignee: string | null
  notes: string | null
  /** 설치 품목(하위 아이템) */
  items: { name: string; quantity: number | null; note: string | null }[]
  phone: string | null
}

/** AS */
export interface RepairRecord extends RecordBase {
  device: string | null
  serialNumber: string | null
  symptom: string | null
  result: string | null
  address: string | null
  assignee: string | null
  receivedAt: string | null
  completedAt: string | null
  /** 청구 부품·공임(하위 아이템) */
  parts: {
    name: string
    part: string | null
    sku: string | null
    price: number | null
    quantity: number | null
    total: number
  }[]
  amount: number
  phone: string | null
}

/** 아톡문의 */
export interface InquiryRecord extends RecordBase {
  deviceSeries: string | null
  device: string | null
  type: string | null
  content: string | null
  resolution: string | null
  assignee: string | null
  receivedAt: string | null
  phone: string | null
}

/** 기타업무 */
export interface TaskRecord extends RecordBase {
  requester: string | null
  assignee: string | null
  requestedAt: string | null
  startedAt: string | null
  dueAt: string | null
  completedAt: string | null
  details: string | null
}

/** 자료정리 */
export interface DocTaskRecord extends RecordBase {
  assignees: string[]
  requestedAt: string | null
  completedAt: string | null
  notionUrl: string | null
  details: string | null
}

/** AS 신청서 — 고객이 직접 작성하는 접수 양식 */
export interface AsRequestRecord extends RecordBase {
  receivedAt: string | null
  purchasedAt: string | null
  purchaseChannel: string | null
  device: string | null
  model: string | null
  symptom: string | null
  address: string | null
  phone: string | null
  agreed: boolean
  attachmentCount: number
}

/** 대여품 관리 */
export interface RentalRecord extends RecordBase {
  serialNumber: string | null
  assignees: string[]
  renter: string | null
  renterPhone: string | null
  rentedAt: string | null
  shipAt: string | null
  returnedAt: string | null
  hasPhoto: boolean
}

/** 엑스툴 SN 관리 — item 이름이 SN */
export interface SerialRecord extends RecordBase {
  serialNumber: string
  device: string | null
  receivedAt: string | null
  notes: string | null
  links: { fieldService: string[]; repair: string[]; rental: string[] }
  hasPhoto: boolean
}

/** 부품 마스터 — 관리 메뉴, AS 청구 부품 고르기에도 쓴다. */
export interface PartRecord extends RecordBase {
  nameEn: string | null
  sku: string | null
  category: string | null
  stock: number | null
  cost: number | null
  priceUsd: number | null
  location: string | null
  usage: string | null
  notes: string | null
  videoUrl: string | null
  hasPhoto: boolean
}

export interface TechBoardRecordMap {
  fieldService: FieldServiceRecord
  repair: RepairRecord
  records: DocTaskRecord
  techInquiry: InquiryRecord
  techTask: TaskRecord
  asRequests: AsRequestRecord
  parts: PartRecord
  rentals: RentalRecord
  serials: SerialRecord
}

export interface TechSyncResult {
  ok: boolean
  at: number
  count: number
  written?: number
  deleted?: number
  error?: string
}

/** 보드 화면이 그리는 재료 — meta + item들의 정리된 기록. */
export interface TechBoardDoc<K extends TechBoardKey = TechBoardKey> {
  key: K
  boardId: string
  /** Monday 보드 이름(마지막 동기화 때) */
  name: string
  records: TechBoardRecordMap[K][]
  /** 마지막으로 전체 동기화에 성공한 시각(ms) */
  syncedAt: number | null
  lastSync: TechSyncResult | null
}

/** 보드 컬럼 — 편집 칸을 그리는 재료. */
export interface TechColumn {
  id: string
  title: string
  /** Monday 컬럼 타입(text, status, date, people …) */
  type: string
  writable: boolean
  /** 상태·드롭다운의 고를 수 있는 값 */
  options?: string[]
  /** 연결 칸이 가리키는 우리 보드(부품 마스터 등) */
  linkedBoardKey?: TechBoardKey
}

export interface TechGroup {
  id: string
  title: string
}

/** techBoardMeta/{key} */
export interface TechBoardMeta {
  key: string
  boardId: string
  name: string
  columns: TechColumn[]
  groups: TechGroup[]
  syncedAt: number | null
  lastSync: TechSyncResult | null
  webhooks?: { ids: string[]; at: number; errors: string[] }
  /** 하위 아이템 보드(출장 설치 품목·AS 청구 부품) */
  subitems?: { boardId: string; columns: TechColumn[] }
}

/** 하위 아이템 한 줄 */
export interface TechSubitemDoc {
  id: string
  name: string
  values: Record<string, TechCellValue>
}

/** Monday에 적힌 값 그대로 — text는 화면용 글자(한국 시간), value는 원본 JSON(시간은 UTC). */
export interface TechCellValue {
  text: string
  value: string | null
}

/** techItems/{itemId} */
export interface TechItemDoc<K extends TechBoardKey = TechBoardKey> {
  itemId: string
  boardKey: K
  boardId: string
  name: string
  groupId: string | null
  record: TechBoardRecordMap[K]
  values: Record<string, TechCellValue>
  /** 하위 아이템 — 하위 아이템이 있는 보드만(옛 캐시에는 없을 수 있다) */
  subitems?: TechSubitemDoc[]
  /** 업데이트(Monday 댓글) 수 — 세는 보드(출장)만 */
  updateCount?: number
  createdAt: string | null
  updatedAt: string | null
  syncedAt: number
}

/** techMeta/mondayUsers — 담당자 칸에 고를 수 있는 사람 */
export interface TechMondayUser {
  id: string
  name: string
  email: string
  enabled: boolean
}

/** 함수로 보내는 칸 값 — 컬럼 타입마다 모양이 다르다(빈 값은 지우기). */
export type TechEditValue =
  | string
  | string[]
  | boolean
  | { date: string; time?: string | null }
  | { url: string; text?: string }
  | { lat: string; lng: string; address: string }
  | null

export interface TechSubitemEdit {
  id?: string
  name?: string
  columns?: Record<string, TechEditValue>
}

export interface TechEditInput {
  boardKey: TechBoardKey
  itemId?: string
  name?: string
  groupId?: string
  columns?: Record<string, TechEditValue>
  /** 하위 아이템 추가·수정·삭제 */
  subitems?: { create?: TechSubitemEdit[]; update?: TechSubitemEdit[]; remove?: string[] }
}

/** item 고치기 — Monday에 쓰고 캐시를 맞춘다(화면은 실시간 구독으로 따라온다). */
export const updateTechItem = (input: TechEditInput) =>
  httpsCallable<TechEditInput, { itemId: string | null }>(xtoolFirebase().functions, 'techUpdateItem')(input)

export interface AddressResult {
  label: string
  address: string
  jibun: string | null
  lat: string
  lng: string
}

/** 주소 검색(카카오) — Monday 주소 칸은 좌표가 있어야 써진다. */
export const searchAddress = async (query: string) =>
  (
    await httpsCallable<{ query: string }, { results: AddressResult[] }>(
      xtoolFirebase().functions,
      'techSearchAddress',
    )({ query })
  ).data.results

/** 새 item 만들기 */
export const createTechItem = (input: TechEditInput) =>
  httpsCallable<TechEditInput, { itemId: string | null }>(xtoolFirebase().functions, 'techCreateItem')(input)

/** 기술지원팀 보드 — 순서가 곧 사이드바 메뉴 순서(개요 바로 아래). slug는 주소(/xtool-tech/boards/<slug>). */
export const BOARD_TABS: readonly {
  slug: string
  key: TechBoardKey
  label: string
  /** 사이드바 묶음 — work: "메뉴"(개요 아래 업무 보드) · manage: "관리"(대장·재고) */
  section: 'work' | 'manage'
}[] = [
  { slug: 'field-service', key: 'fieldService', label: '출장업무', section: 'work' },
  { slug: 'repair', key: 'repair', label: 'AS', section: 'work' },
  { slug: 'records', key: 'records', label: '자료정리', section: 'work' },
  { slug: 'inquiry', key: 'techInquiry', label: '아톡문의', section: 'work' },
  { slug: 'tasks', key: 'techTask', label: '기타업무', section: 'work' },
  { slug: 'as-requests', key: 'asRequests', label: 'AS 신청서', section: 'manage' },
  { slug: 'parts', key: 'parts', label: '부품 마스터', section: 'manage' },
  { slug: 'rentals', key: 'rentals', label: '대여품 관리', section: 'manage' },
  { slug: 'serials', key: 'serials', label: 'SN 관리', section: 'manage' },
]

// Monday 날짜 칸은 시간까지 적으면 "2026-11-02 14:00"으로 온다(보드에 사람이 적은 한국 시각).
// 화면은 날짜(YYYY-MM-DD)끼리 비교하므로 받을 때 날짜만 남긴다 — 출장 방문 시각만 따로 둔다.
const DATE_WITH_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/
const DATE_FIELDS = [
  'receivedAt',
  'visitAt',
  'completedAt',
  'requestedAt',
  'startedAt',
  'dueAt',
  'purchasedAt',
  'rentedAt',
  'shipAt',
  'returnedAt',
] as const

export function normalizeRecord<T>(record: T): T {
  const next: Record<string, unknown> = { ...(record as Record<string, unknown>) }
  for (const field of DATE_FIELDS) {
    const value = next[field]
    if (typeof value !== 'string') continue
    const match = DATE_WITH_TIME.exec(value)
    next[field] = match ? match[1] : value.slice(0, 10)
    if (field === 'visitAt') next.visitTime = match ? match[2] : null
  }
  return next as T
}
