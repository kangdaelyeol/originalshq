import { addDays } from '../lib/dates'
import { BOARD_TABS, type FieldServiceRecord, type RentalRecord, type TaskRecord, type TechBoardKey } from './tech-boards'
import { isDone, splitNames } from './tech-stage'

// 오늘·이번 주 일정 — 진행 중인 건의 정해진 날을 오늘부터 DAYS일 동안 날짜별로 묶는다.
//   · 출장 방문(방문 일정, 시각 포함) · 기타업무 마감(마감일) · 대여품 발송 예정(발송 예정일)
// 날짜가 지났는데 아직 안 끝난 건은 "지난 일정"으로 따로.

export const SCHEDULE_DAYS = 7

export interface ScheduleEvent {
  key: string
  boardKey: TechBoardKey
  slug: string
  boardLabel: string
  itemId: string
  /** 방문 · 마감 · 발송 */
  kind: string
  title: string
  date: string
  time: string | null
  meta: string
  assignees: string[]
}

export interface Schedule {
  overdue: ScheduleEvent[]
  days: { date: string; events: ScheduleEvent[] }[]
}

export interface ScheduleSources {
  fieldService: FieldServiceRecord[] | null
  techTask: TaskRecord[] | null
  rentals: RentalRecord[] | null
}

const tabOf = (key: TechBoardKey) => BOARD_TABS.find((t) => t.key === key)!

/** names가 있으면 그 사람이 담당인 일정만 */
export function buildSchedule(sources: ScheduleSources, today: string, names: ReadonlySet<string> | null): Schedule {
  const events: ScheduleEvent[] = []
  const add = (key: TechBoardKey, e: Omit<ScheduleEvent, 'key' | 'boardKey' | 'slug' | 'boardLabel'>) => {
    if (names && !e.assignees.some((n) => names.has(n))) return
    const tab = tabOf(key)
    events.push({ ...e, key: `${key}:${e.itemId}:${e.kind}`, boardKey: key, slug: tab.slug, boardLabel: tab.label })
  }
  for (const r of sources.fieldService ?? []) {
    if (isDone(r) || !r.visitAt) continue
    const assignees = splitNames(r.assignee)
    add('fieldService', {
      itemId: r.itemId,
      kind: '방문',
      title: r.name,
      date: r.visitAt,
      time: r.visitTime,
      meta: [r.region, r.type, assignees.join(', ')].filter(Boolean).join(' · '),
      assignees,
    })
  }
  for (const r of sources.techTask ?? []) {
    if (isDone(r) || !r.dueAt) continue
    const assignees = splitNames(r.assignee)
    add('techTask', { itemId: r.itemId, kind: '마감', title: r.name, date: r.dueAt, time: null, meta: assignees.join(', ') || '담당자 없음', assignees })
  }
  for (const r of sources.rentals ?? []) {
    if (!r.shipAt || r.shipAt < today) continue // 발송 예정은 지난 것까지 챙기지 않는다(상태 칸이 따로 있다)
    add('rentals', {
      itemId: r.itemId,
      kind: '발송',
      title: r.name,
      date: r.shipAt,
      time: null,
      meta: [r.renter, r.serialNumber].filter(Boolean).join(' · '),
      assignees: r.assignees,
    })
  }

  const byTime = (a: ScheduleEvent, b: ScheduleEvent) =>
    a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title, 'ko')
  const overdue = events.filter((e) => e.date < today).sort(byTime)
  const days = Array.from({ length: SCHEDULE_DAYS }, (_, i) => {
    const date = addDays(today, i)
    return { date, events: events.filter((e) => e.date === date).sort(byTime) }
  })
  return { overdue, days }
}
