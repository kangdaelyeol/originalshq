import { addDays, daysBetween } from '../lib/dates'
import { BOARD_TABS, type TechBoardKey, type TechBoardRecordMap } from './tech-boards'
import { isDone, splitNames } from './tech-stage'

// 나의 진행 중 업무 — 내가 담당인 진행 중(완료 아님) 건을 업무 보드 다섯 개에서 모은다.
// 순서: 지났거나 3일 안에 다가오는 날짜(출장 방문일·기타업무 마감일)가 있는 건 먼저(날짜순),
// 그다음 나머지를 오래된 순(접수·요청일).

export type MyWorkBoard = 'fieldService' | 'repair' | 'techInquiry' | 'techTask' | 'records'
export const MY_WORK_BOARDS: readonly MyWorkBoard[] = ['fieldService', 'repair', 'techInquiry', 'techTask', 'records']

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
  /** target이 지났거나 SOON_DAYS 안 */
  urgent: boolean
}

type Sources = { [K in MyWorkBoard]?: TechBoardRecordMap[K][] | null }

const tabOf = (key: TechBoardKey) => BOARD_TABS.find((t) => t.key === key)!

export function buildMyWork(sources: Sources, names: ReadonlySet<string>, today: string): MyWorkItem[] {
  const mine = (assignees: string[]) => assignees.some((n) => names.has(n))
  const items: MyWorkItem[] = []
  const push = (
    key: MyWorkBoard,
    r: { itemId: string; name: string; stage: string | null; status: string | null },
    target: MyWorkItem['target'],
    since: MyWorkItem['since'],
  ) => {
    const tab = tabOf(key)
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
      urgent: !!target && target.date <= addDays(today, SOON_DAYS),
    })
  }
  for (const r of sources.fieldService ?? []) {
    if (isDone(r) || !mine(splitNames(r.assignee))) continue
    push('fieldService', r, r.visitAt ? { label: '방문', date: r.visitAt, time: r.visitTime } : null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null)
  }
  for (const r of sources.repair ?? []) {
    if (isDone(r) || !mine(splitNames(r.assignee))) continue
    push('repair', r, null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null)
  }
  for (const r of sources.techInquiry ?? []) {
    if (isDone(r) || !mine(splitNames(r.assignee))) continue
    push('techInquiry', r, null, r.receivedAt ? { label: '접수', date: r.receivedAt } : null)
  }
  for (const r of sources.techTask ?? []) {
    if (isDone(r) || !mine(splitNames(r.assignee))) continue
    push('techTask', r, r.dueAt ? { label: '마감', date: r.dueAt } : null, r.requestedAt ? { label: '요청', date: r.requestedAt } : null)
  }
  for (const r of sources.records ?? []) {
    if (isDone(r) || !mine(r.assignees)) continue
    push('records', r, null, r.requestedAt ? { label: '요청', date: r.requestedAt } : null)
  }
  return items.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
    if (a.urgent && b.urgent) return a.target!.date.localeCompare(b.target!.date)
    const as = a.since?.date ?? '9999'
    const bs = b.since?.date ?? '9999'
    return as.localeCompare(bs)
  })
}

/** 오른쪽에 보일 한 마디 — "내일 방문", "3일 지남", "12일째" */
export function urgencyText(item: MyWorkItem, today: string): { text: string; tone: 'alert' | 'soon' | 'plain' } {
  if (item.target) {
    const diff = daysBetween(today, item.target.date)
    if (diff < 0) return { text: `${item.target.label} ${-diff}일 지남`, tone: 'alert' }
    if (diff === 0) return { text: `오늘 ${item.target.label}`, tone: 'soon' }
    if (diff <= SOON_DAYS) return { text: `${diff === 1 ? '내일' : `${diff}일 후`} ${item.target.label}`, tone: 'soon' }
  }
  if (item.since) return { text: `${daysBetween(item.since.date, today)}일째`, tone: 'plain' }
  return { text: '', tone: 'plain' }
}
