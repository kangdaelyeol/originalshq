import { addDays, daysBetween } from '../lib/dates'
import type {
  AsRequestRecord,
  FieldServiceRecord,
  InquiryRecord,
  PartRecord,
  RentalRecord,
  RepairRecord,
  TaskRecord,
} from './tech-boards'
import { isBlocked, isDone } from './tech-stage'

// 챙겨야 할 것 — 보드마다 손이 필요한 건을 세어 한 줄 요약으로. 숫자가 0이면 흐리게 둔다.

/** AS가 이 날 수 넘게 진행 중이면 "오래됨"(AS 목록의 빨간 경과일과 같은 기준) */
export const STALE_REPAIR_DAYS = 14
/** 대여가 이 날 수 넘게 나가 있으면 "오래됨" */
export const LONG_RENTAL_DAYS = 30
/** 신청서가 이 날 수 안에 들어왔으면 "새 신청" */
export const NEW_REQUEST_DAYS = 3

export type AttentionId = 'overdueVisit' | 'staleRepair' | 'waitingInquiry' | 'blockedTask' | 'longRental' | 'outOfStock' | 'newRequest'

export interface AttentionTile {
  id: AttentionId
  label: string
  caption: string
  slug: string
  count: number
  /** 마우스를 올리면 보일 이름 몇 개 */
  examples: string[]
  /** 0이 아니면 빨강(급함) / 노랑(챙김) / 파랑(알림) */
  tone: 'crit' | 'warn' | 'info'
}

export interface AttentionSources {
  fieldService: FieldServiceRecord[] | null
  repair: RepairRecord[] | null
  techInquiry: InquiryRecord[] | null
  techTask: TaskRecord[] | null
  rentals: RentalRecord[] | null
  parts: PartRecord[] | null
  asRequests: AsRequestRecord[] | null
}

const names = (records: { name: string }[]) => records.slice(0, 5).map((r) => r.name || '(이름 없음)')

export function buildAttention(s: AttentionSources, today: string): AttentionTile[] {
  const overdueVisit = (s.fieldService ?? []).filter((r) => !isDone(r) && r.visitAt && r.visitAt < today)
  const staleRepair = (s.repair ?? []).filter(
    (r) => !isDone(r) && r.receivedAt && daysBetween(r.receivedAt, today) >= STALE_REPAIR_DAYS,
  )
  const waitingInquiry = (s.techInquiry ?? []).filter((r) => !isDone(r) && /신규|1차/.test(r.stage ?? ''))
  const blockedTask = (s.techTask ?? []).filter((r) => !isDone(r) && isBlocked(r))
  const longRental = (s.rentals ?? []).filter(
    (r) => /대여\s*중/.test(`${r.status ?? ''} ${r.stage ?? ''}`) && r.rentedAt && daysBetween(r.rentedAt, today) >= LONG_RENTAL_DAYS,
  )
  const outOfStock = (s.parts ?? []).filter((r) => r.stock !== null && r.stock <= 0)
  const newRequest = (s.asRequests ?? []).filter((r) => r.receivedAt && r.receivedAt >= addDays(today, -(NEW_REQUEST_DAYS - 1)))

  return [
    { id: 'overdueVisit', label: '지난 출장 일정', caption: '방문일이 지났는데 안 끝남', slug: 'field-service', count: overdueVisit.length, examples: names(overdueVisit), tone: 'crit' },
    { id: 'staleRepair', label: '오래된 AS', caption: `접수 ${STALE_REPAIR_DAYS}일 넘게 진행 중`, slug: 'repair', count: staleRepair.length, examples: names(staleRepair), tone: 'crit' },
    { id: 'waitingInquiry', label: '응대 대기 아톡', caption: '신규 접수·1차 안내', slug: 'inquiry', count: waitingInquiry.length, examples: names(waitingInquiry), tone: 'warn' },
    { id: 'blockedTask', label: '막힌 업무', caption: '기타업무 "막힘"', slug: 'tasks', count: blockedTask.length, examples: names(blockedTask), tone: 'warn' },
    { id: 'longRental', label: '오래 나간 대여품', caption: `대여 ${LONG_RENTAL_DAYS}일 넘음`, slug: 'rentals', count: longRental.length, examples: names(longRental), tone: 'warn' },
    { id: 'outOfStock', label: '재고 없는 부품', caption: '재고 0 이하', slug: 'parts', count: outOfStock.length, examples: names(outOfStock), tone: 'warn' },
    { id: 'newRequest', label: '새 AS 신청', caption: `최근 ${NEW_REQUEST_DAYS}일 접수`, slug: 'as-requests', count: newRequest.length, examples: names(newRequest), tone: 'info' },
  ]
}
