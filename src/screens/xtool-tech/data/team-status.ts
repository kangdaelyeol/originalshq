import { addDays } from '../lib/dates'
import type { DocTaskRecord, FieldServiceRecord, InquiryRecord, RepairRecord, TaskRecord } from './tech-boards'
import { kingFacts, kingPeriod, KINGS } from './tech-kings'
import { isDone, splitNames } from './tech-stage'

// 팀 현황 — /admin/xtool에서 기술팀으로 등록한 사람(roster, 이름)만 보인다. 명단을 아직 못 읽었으면(null)
// 기술팀 보드에 최근 RECENT_DAYS일 동안 담당자로 나온 사람으로 대신한다. 사람마다 진행 중(보드별)·오늘 방문·
// 이번 주 처리(세 왕 합계).

export const RECENT_DAYS = 90
// 담당자 칸에 남는 이름 중 사람이 아닌 것
const NOT_A_PERSON = /^삭제된 팀원$/

export type WorkBoard = 'fieldService' | 'repair' | 'techInquiry' | 'techTask' | 'records'

export interface TeamMemberStatus {
  name: string
  open: Record<WorkBoard, number>
  openTotal: number
  visitsToday: number
  doneThisWeek: number
}

export interface TeamSources {
  fieldService: FieldServiceRecord[] | null
  repair: RepairRecord[] | null
  techInquiry: InquiryRecord[] | null
  techTask: TaskRecord[] | null
  records: DocTaskRecord[] | null
}

const EMPTY_OPEN = (): Record<WorkBoard, number> => ({ fieldService: 0, repair: 0, techInquiry: 0, techTask: 0, records: 0 })

export function buildTeamStatus(s: TeamSources, today: string, roster: readonly string[] | null = null): TeamMemberStatus[] {
  const since = addDays(today, -RECENT_DAYS)
  const people = new Map<string, TeamMemberStatus>()
  const person = (name: string) => {
    let p = people.get(name)
    if (!p) {
      p = { name, open: EMPTY_OPEN(), openTotal: 0, visitsToday: 0, doneThisWeek: 0 }
      people.set(name, p)
    }
    return p
  }
  // 기술팀은 맡은 일이 없어도 0건으로 보인다
  for (const name of roster ?? []) person(name)
  const visit = (
    board: WorkBoard,
    r: { stage: string | null; status: string | null; updatedAt: string | null; createdAt: string | null },
    assignees: string[],
  ) => {
    const open = !isDone(r)
    const recent = (r.updatedAt ?? r.createdAt ?? '').slice(0, 10) >= since
    if (!open && !recent) return
    for (const name of assignees) {
      if (NOT_A_PERSON.test(name)) continue
      const p = person(name)
      if (open) {
        p.open[board] += 1
        p.openTotal += 1
      }
    }
  }
  for (const r of s.fieldService ?? []) {
    const assignees = splitNames(r.assignee)
    visit('fieldService', r, assignees)
    if (!isDone(r) && r.visitAt === today) for (const n of assignees) if (!NOT_A_PERSON.test(n)) person(n).visitsToday += 1
  }
  for (const r of s.repair ?? []) visit('repair', r, splitNames(r.assignee))
  for (const r of s.techInquiry ?? []) visit('techInquiry', r, splitNames(r.assignee))
  for (const r of s.techTask ?? []) visit('techTask', r, splitNames(r.assignee))
  for (const r of s.records ?? []) visit('records', r, r.assignees)

  // 이번 주 처리 — 기술팀 왕 세 개(AS왕·수리왕·아톡처리왕)를 합친 것
  const week = kingPeriod('week', today)
  for (const def of KINGS) {
    for (const fact of kingFacts(def.id, s) ?? []) {
      if (fact.date < week.start || fact.date > week.end) continue
      for (const n of fact.assignees) if (!NOT_A_PERSON.test(n)) person(n).doneThisWeek += 1
    }
  }

  const team = roster ? new Set(roster) : null
  return [...people.values()].filter((p) => !team || team.has(p.name)).sort(
    (a, b) => b.openTotal - a.openTotal || b.doneThisWeek - a.doneThisWeek || a.name.localeCompare(b.name, 'ko'),
  )
}
