import { addDays, byDateDesc, daysBetween, isoToKoreaDate, shortDate } from './dates'
import { BOARD_TABS, type TechBoardKey, type TechBoardRecordMap } from './tech-boards'
import { isDone, splitNames } from './tech-stage'

// 담당 업무 — 담당자 칸이 있는 보드 다섯 개에서 그 사람이 담당인 건을 모은다(개요 카드·내 업무 화면).
// 순서: 진행 중 먼저 — 지났거나 3일 안에 다가오는 날짜(출장 방문일·기타업무 마감일)가 있는 건
// 먼저(날짜순), 그다음 나머지를 오래된 순(접수·요청일). 완료는 그 뒤에 최근 끝난 순.

export type MyWorkBoard = 'fieldService' | 'repair' | 'techInquiry' | 'techTask' | 'rentals'
export const MY_WORK_BOARDS: readonly MyWorkBoard[] = ['fieldService', 'repair', 'techInquiry', 'techTask', 'rentals']

// 이 날 수 안으로 다가오면 "급한 건"으로 위에 올린다.
const SOON_DAYS = 3

export interface MyWorkItem {
  boardKey: MyWorkBoard
  slug: string
  boardLabel: string
  itemId: string
  name: string
  stage: string | null
  status: string | null
  /** 정해진 날 — 출장 방문일, 기타업무 마감일 */
  target: { label: string; date: string; time?: string | null } | null
  /** 시작한 날 — 접수·요청일 */
  since: { label: string; date: string } | null
  /** target이 지났거나 SOON_DAYS 안(진행 중인 건만) */
  urgent: boolean
  done: boolean
  /** 끝난 날 — 완료일·회수일, 없으면 마지막 수정일 */
  doneAt: string | null
}

export type MyWorkSources = { [K in MyWorkBoard]?: TechBoardRecordMap[K][] | null }
type Sources = MyWorkSources

const tabOf = (key: TechBoardKey) => BOARD_TABS.find((t) => t.key === key)!

type Base = { itemId: string; name: string; stage: string | null; status: string | null; updatedAt: string | null }

/** names 중 한 사람이라도 담당인 건 — includeDone이 아니면 진행 중인 것만 */
export function buildMyWork(
  sources: Sources,
  names: ReadonlySet<string>,
  today: string,
  { includeDone = false }: { includeDone?: boolean } = {},
): MyWorkItem[] {
  const take = (r: Base, assignees: string[]) => (includeDone || !isDone(r)) && assignees.some((n) => names.has(n))
  const items: MyWorkItem[] = []
  const push = (
    key: MyWorkBoard,
    r: Base,
    target: MyWorkItem['target'],
    since: MyWorkItem['since'],
    completedAt: string | null = null,
  ) => {
    const tab = tabOf(key)
    const done = isDone(r)
    items.push({
      boardKey: key,
      slug: tab.slug,
      boardLabel: tab.label,
      itemId: r.itemId,
      name: r.name,
      stage: r.stage,
      status: r.status,
      target,
      since,
      urgent: !done && !!target && target.date <= addDays(today, SOON_DAYS),
      done,
      doneAt: done ? (completedAt ?? isoToKoreaDate(r.updatedAt)) : null,
    })
  }
  for (const r of sources.fieldService ?? []) {
    if (!take(r, splitNames(r.assignee))) continue
    push('fieldService', r, r.visitAt ? { label: '방문', date: r.visitAt, time: r.visitTime } : null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null)
  }
  for (const r of sources.repair ?? []) {
    if (!take(r, splitNames(r.assignee))) continue
    push('repair', r, null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null, r.completedAt)
  }
  for (const r of sources.techInquiry ?? []) {
    if (!take(r, splitNames(r.assignee))) continue
    push('techInquiry', r, null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null)
  }
  for (const r of sources.techTask ?? []) {
    if (!take(r, splitNames(r.assignee))) continue
    push('techTask', r, r.dueAt ? { label: '마감', date: r.dueAt } : null, r.requestedAt ? { label: '요청', date: r.requestedAt } : null, r.completedAt)
  }
  for (const r of sources.rentals ?? []) {
    if (!take(r, r.assignees)) continue
    push('rentals', r, null, r.rentedAt ? { label: '대여', date: r.rentedAt } : null, r.returnedAt)
  }
  return items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return byDateDesc(a.doneAt, b.doneAt)
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
    if (a.urgent && b.urgent) return a.target!.date.localeCompare(b.target!.date)
    const as = a.since?.date ?? '9999'
    const bs = b.since?.date ?? '9999'
    return as.localeCompare(bs)
  })
}

/** 오른쪽에 보일 한 마디 — "내일 방문", "3일 지남", "12일째" */
export function urgencyText(item: MyWorkItem, today: string): { text: string; tone: 'alert' | 'soon' | 'plain' } {
  if (item.done) return { text: item.doneAt ? `${shortDate(item.doneAt, today)} 완료` : '완료', tone: 'plain' }
  if (item.target) {
    const diff = daysBetween(today, item.target.date)
    if (diff < 0) return { text: `${item.target.label} ${-diff}일 지남`, tone: 'alert' }
    if (diff === 0) return { text: `오늘 ${item.target.label}`, tone: 'soon' }
    if (diff <= SOON_DAYS) return { text: `${diff === 1 ? '내일' : `${diff}일 후`} ${item.target.label}`, tone: 'soon' }
  }
  if (item.since) return { text: `${daysBetween(item.since.date, today)}일째`, tone: 'plain' }
  return { text: '', tone: 'plain' }
}

// 이 날 수 안에 담당자로 나온 사람만 직원 목록에 올린다(팀 현황 RECENT_DAYS와 같은 기준).
const PEOPLE_RECENT_DAYS = 90
// 담당자 칸에 남는 이름 중 사람이 아닌 것
const NOT_A_PERSON = /^삭제된 팀원$/

export interface WorkPerson {
  name: string
  /** 진행 중 담당 건수 */
  open: number
}

/**
 * 담당 업무를 볼 수 있는 직원 — 여섯 보드에 진행 중이거나 최근 90일 안에 담당자로 나온 사람
 * (구성원 명단은 규칙상 관리자만 읽어서 보드에서 찾는다). 진행 중이 많은 순, 같으면 이름순.
 */
export function buildWorkPeople(sources: Sources, today: string): WorkPerson[] {
  const since = addDays(today, -PEOPLE_RECENT_DAYS)
  const people = new Map<string, WorkPerson>()
  const visit = (r: Base & { createdAt: string | null }, assignees: string[]) => {
    const open = !isDone(r)
    if (!open && (r.updatedAt ?? r.createdAt ?? '').slice(0, 10) < since) return
    for (const name of assignees) {
      if (NOT_A_PERSON.test(name)) continue
      const p = people.get(name) ?? { name, open: 0 }
      if (open) p.open += 1
      people.set(name, p)
    }
  }
  for (const r of sources.fieldService ?? []) visit(r, splitNames(r.assignee))
  for (const r of sources.repair ?? []) visit(r, splitNames(r.assignee))
  for (const r of sources.techInquiry ?? []) visit(r, splitNames(r.assignee))
  for (const r of sources.techTask ?? []) visit(r, splitNames(r.assignee))
  for (const r of sources.rentals ?? []) visit(r, r.assignees)
  return [...people.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ko'))
}
