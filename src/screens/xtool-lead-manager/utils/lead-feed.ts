// 리드 분석 탭(신규 인입 피드) — 기간 범위, 검색, 상태, 같은 번호끼리 묶기와
// 정렬, 표에 쓰는 값. 날짜는 전부 한국 날짜(YYYY-MM-DD)다.

import type { MondayCustomerListItem, MondayLeadFeedRow } from '../entity'
import type { SortDirection } from '../types'
import { DAY_MS, daysBetween, koreaDate, koreaIso } from './calc'

export type LeadFeedPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month'

export const LEAD_FEED_PERIODS: readonly LeadFeedPeriod[] = [
  'all',
  'today',
  'yesterday',
  'week',
  'month',
]

export const LEAD_FEED_PERIOD_LABEL: Record<LeadFeedPeriod, string> = {
  all: '전체',
  today: '오늘',
  yesterday: '어제',
  week: '이번 주',
  month: '지난 30일',
}

/** 한 번에 받아 두는 기간(일) — 전체를 빼고 가장 긴 보기(지난 30일)만큼 받고,
 * 보기를 바꿀 때는 다시 받지 않고 거르기만 한다(전체는 따로 한 번 받는다). */
const LEAD_FEED_DAYS = 30

const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)

/** 받아 올 첫날 — 오늘을 포함해 30일. */
export const leadFeedFrom = (today: string): string =>
  shiftDate(today, -(LEAD_FEED_DAYS - 1))

/** 보기의 날짜 범위 [첫날, 끝날] — 전체는 null(날짜로 거르지 않는다). 이번
 * 주는 월요일부터 오늘까지. */
export const leadFeedRange = (
  period: LeadFeedPeriod,
  today: string,
): [string, string] | null => {
  switch (period) {
    case 'all':
      return null
    case 'today':
      return [today, today]
    case 'yesterday': {
      const yesterday = shiftDate(today, -1)
      return [yesterday, yesterday]
    }
    case 'week': {
      const fromMonday = (new Date(Date.parse(today)).getUTCDay() + 6) % 7
      return [shiftDate(today, -fromMonday), today]
    }
    case 'month':
      return [leadFeedFrom(today), today]
  }
}

/** 리드의 인입 날짜 — Monday에 만들어진 시각, 없으면 접수일. */
export const leadDate = (row: MondayLeadFeedRow): string | null =>
  row.createdAt
    ? koreaDate(Date.parse(row.createdAt))
    : (row.receivedAt?.slice(0, 10) ?? null)

/** 인입 시각 "11/6 14:03" — 만든 시각이 없으면 접수일. */
export const formatLeadTime = (row: MondayLeadFeedRow): string => {
  if (!row.createdAt) return row.receivedAt ?? '-'
  const iso = koreaIso(Date.parse(row.createdAt))
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} ${iso.slice(11, 16)}`
}

/** 첫 콜까지 걸린 일수 — 콜백 진행일 중 가장 이른 날 − 인입 날짜. 콜백 칸은
 * 날짜만 있어 일 단위다. 콜백을 아직 안 했으면 null. */
export const firstCallDays = (row: MondayLeadFeedRow): number | null => {
  const date = leadDate(row)
  if (!date || row.callbackDates.length === 0) return null
  const first = row.callbackDates.map((each) => each.slice(0, 10)).sort()[0]
  return Math.max(0, daysBetween(date, first))
}

export const isMisentry = (row: MondayLeadFeedRow): boolean =>
  row.status === '오기입'

/** 기간 안의 리드(range가 null이면 전부) — 보드를 주면 그 보드만. */
export const filterLeads = (
  rows: readonly MondayLeadFeedRow[],
  range: [string, string] | null,
  boardId: string | null,
): MondayLeadFeedRow[] =>
  rows.filter((row) => {
    if (boardId !== null && row.boardId !== boardId) return false
    if (range === null) return true
    const date = leadDate(row)
    return date !== null && date >= range[0] && date <= range[1]
  })

/** 이름·연락처 검색 — 낱말마다 이름에 들어 있거나, 숫자만 떼어 번호(고객
 * 번호·적힌 번호)에 들어 있으면 맞다(Monday 고객 탭 검색과 같은 방식). */
export const searchLeads = (
  rows: readonly MondayLeadFeedRow[],
  search: string,
): readonly MondayLeadFeedRow[] => {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return rows
  return rows.filter((row) => {
    const name = row.name.toLowerCase()
    const phones = `${row.phone ?? ''} ${(row.phoneRaw ?? '').replace(/\D/g, '')}`
    return words.every((word) => {
      const digits = word.replace(/\D/g, '')
      return name.includes(word) || (digits !== '' && phones.includes(digits))
    })
  })
}

/** 상태 거르기의 "전체" — 상태 값(Monday 글자)과 겹치지 않는 키. */
export const ALL_STATUSES = '__all__'

/** 리드의 상태 키 — 상담 진행 상태 그대로, 비었으면 ''. */
export const leadStatusKey = (row: MondayLeadFeedRow): string =>
  row.status ?? ''

// 상태 드롭다운의 순서 — 진행 순서대로, 목록에 없는 상태는 그 뒤, 빈 상태는 맨 뒤.
const STATUS_ORDER = [
  /신규/,
  /콜백\s*1/,
  /콜백\s*2/,
  /콜백\s*3/,
  /콜백\s*4/,
  /보류/,
  /결제/,
  /미전환/,
  /오기입/,
]

const statusRank = (status: string): number => {
  if (status === '') return STATUS_ORDER.length + 1
  const index = STATUS_ORDER.findIndex((pattern) => pattern.test(status))
  return index === -1 ? STATUS_ORDER.length : index
}

/** 받은 리드에 나온 상태 전부 — 드롭다운 항목(신규 → 콜백 1~4단계 → 보류 →
 * 결제 → 미전환 → 오기입 → 그 밖 → 상태 없음). 상태 이름은 Monday 그대로라
 * 보드에 새 상태가 생겨도 따로 고칠 것이 없다. */
export const leadStatuses = (rows: readonly MondayLeadFeedRow[]): string[] =>
  [...new Set(rows.map(leadStatusKey))].sort(
    (a, b) => statusRank(a) - statusRank(b) || a.localeCompare(b, 'ko'),
  )

/** 상태별 리드 수 — 드롭다운 항목에 붙인다. */
export const countByStatus = (
  rows: readonly MondayLeadFeedRow[],
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = leadStatusKey(row)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/** 보드별 리드 수 — 보드 거르기 버튼에 붙인다. */
export const countByBoard = (
  rows: readonly MondayLeadFeedRow[],
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.boardId] = (counts[row.boardId] ?? 0) + 1
  return counts
}

/** 같은 번호의 리드 묶음 — head가 가장 최근 리드, rest는 그 앞의 리드(최근
 * 것부터). */
export interface LeadGroup {
  key: string
  head: MondayLeadFeedRow
  rest: MondayLeadFeedRow[]
}

/** 같은 번호의 리드를 한 묶음으로 — rows는 최근 것부터 와야 하고, 묶음도 가장
 * 최근 리드 순이다. 번호를 못 읽은 리드는 혼자 한 묶음이다. */
export const groupLeads = (rows: readonly MondayLeadFeedRow[]): LeadGroup[] => {
  const groups = new Map<string, LeadGroup>()
  for (const row of rows) {
    const key = row.phone ?? `item:${row.itemId}`
    const group = groups.get(key)
    if (group) group.rest.push(row)
    else groups.set(key, { key, head: row, rest: [] })
  }
  return [...groups.values()]
}

/** 묶음을 인입 시각(맨 앞 줄 = 가장 최근 리드)으로 — desc는 최근 것부터.
 * 펼친 줄(rest)은 방향과 상관없이 맨 앞 줄에서 거슬러 올라가는 순서다. */
export const sortLeadGroups = (
  groups: readonly LeadGroup[],
  direction: SortDirection,
): LeadGroup[] => {
  const sign = direction === 'desc' ? -1 : 1
  return [...groups].sort(
    (a, b) =>
      (a.head.createdAt ?? '').localeCompare(b.head.createdAt ?? '') * sign,
  )
}

/** 고객 상세 왼쪽 목록 — 지금 표의 묶음 순서대로, 번호가 있어 고객 목록에서
 * 찾은 묶음만. */
export const leadGroupCustomers = (
  groups: readonly LeadGroup[],
  customers: readonly MondayCustomerListItem[],
): MondayCustomerListItem[] => {
  const byPhone = new Map(
    customers.map((customer) => [customer.phone, customer]),
  )
  return groups.flatMap((group) => {
    const customer = group.head.phone
      ? byPhone.get(group.head.phone)
      : undefined
    return customer ? [customer] : []
  })
}
