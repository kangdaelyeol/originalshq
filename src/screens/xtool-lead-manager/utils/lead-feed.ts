// 리드 분석 탭(신규 인입 피드) — 기간 범위, 검색, 상태, 같은 번호끼리 묶기와
// 정렬, 표에 쓰는 값. 날짜는 전부 한국 날짜(YYYY-MM-DD)다.

import type {
  MondayCustomerListItem,
  MondayLeadChannel,
  MondayLeadFeedRow,
} from '../entity'
import type { SortDirection } from '../types'
import { DAY_MS, daysBetween, formatKoreaTime, koreaDate } from './calc'

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

/** 한 쪽에 보일 줄(묶음) 수 — 전체를 고르면 줄이 수천이라 나눠 그린다. */
export const LEAD_FEED_PAGE_SIZES = [30, 50, 100] as const
export type LeadFeedPageSize = (typeof LEAD_FEED_PAGE_SIZES)[number]

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
export const leadDate = (row: MondayLeadFeedRow): string | null => {
  // 만든 시각을 못 읽으면(잘못된 값) 접수일로 — koreaDate는 잘못된 값에 오류를 던진다.
  const created = row.createdAt ? Date.parse(row.createdAt) : NaN
  return Number.isNaN(created)
    ? (row.receivedAt?.slice(0, 10) ?? null)
    : koreaDate(created)
}

/** 인입 시각 "11/6 14:03" — 만든 시각이 없으면 접수일. */
export const formatLeadTime = (row: MondayLeadFeedRow): string => {
  const created = row.createdAt ? Date.parse(row.createdAt) : NaN
  return Number.isNaN(created)
    ? (row.receivedAt ?? '-')
    : formatKoreaTime(created)
}

/** 첫 콜까지 걸린 일수 — 콜백 진행일 중 가장 이른 날 − 인입 날짜. 콜백 칸은
 * 날짜만 있어 일 단위다. 콜백을 아직 안 했으면 null. */
export const firstCallDays = (row: MondayLeadFeedRow): number | null => {
  const date = leadDate(row)
  if (!date || row.callbackDates.length === 0) return null
  const first = row.callbackDates.map((each) => each.slice(0, 10)).sort()[0]
  const days = daysBetween(date, first)
  // 날짜 칸에 날짜가 아닌 글이 적혀 있으면 계산하지 않는다.
  return Number.isNaN(days) ? null : Math.max(0, days)
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

/** 키별 리드 수 — 보드·매체 버튼과 상태 드롭다운의 건수. */
export const countLeadsBy = (
  rows: readonly MondayLeadFeedRow[],
  keyOf: (row: MondayLeadFeedRow) => string,
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = keyOf(row)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/** 매체 거르기의 "전체". */
export const ALL_CHANNELS = 'all'

/** 보드 거르기의 "전체". */
export const ALL_BOARDS = 'all'

/** 소재 거르기(소재별 보기)의 "전체" — 소재 묶음 키는 '매체:utm_campaign'이라
 * 겹치지 않는다. */
export const ALL_CREATIVES = 'all'

/** 매체 버튼 — 순서와 이름(cmip ROAS 탭과 같은 이름). */
export const LEAD_CHANNEL_LABEL: Record<MondayLeadChannel, string> = {
  meta: 'Meta',
  google: 'Google',
  naver: 'Naver',
  openai: 'OpenAI',
  daangn: '당근',
  other: '기타 UTM',
  unknown: 'UTM 없음',
}

/** 매체 버튼에 마우스를 올리면 보이는 설명 — 광고 매체가 아닌 두 칸만. */
export const LEAD_CHANNEL_TITLE: Partial<Record<MondayLeadChannel, string>> = {
  other: 'UTM은 있지만 광고 매체가 아닌 곳(chatgpt.com 자연 유입·threads 등)',
  unknown: 'UTM 없이 들어온 리드(전화·매장 문의 등)',
}

/** 상태·보드·매체 거르기 — 저마다 고른 키, 또는 "전체"(ALL_STATUSES·
 * ALL_BOARDS·ALL_CHANNELS). */
export interface LeadFilters {
  status: string
  boardId: string
  channel: string
}

/** 상태·보드·매체로 거른 리드와 거르기 버튼마다의 건수. 위에서 아래로 좁혀
 * 간다(기간·검색 → 상태 → 보드 → 매체). 건수는 저마다 위쪽 선택만 반영한다:
 * 상태 건수는 기간·검색 안에서(보드·매체를 골라도 그대로), 보드 건수는 고른
 * 상태 안에서(매체를 골라도 그대로), 매체 건수는 고른 상태·보드 안에서 센다.
 * base는 기간·검색까지 건 리드. */
export const leadFacets = (
  base: readonly MondayLeadFeedRow[],
  filters: LeadFilters,
) => {
  const forBoards = base.filter(
    (row) =>
      filters.status === ALL_STATUSES || leadStatusKey(row) === filters.status,
  )
  const forChannels = forBoards.filter(
    (row) => filters.boardId === ALL_BOARDS || row.boardId === filters.boardId,
  )
  return {
    statusCounts: countLeadsBy(base, leadStatusKey),
    statusTotal: base.length,
    boardCounts: countLeadsBy(forBoards, (row) => row.boardId),
    boardTotal: forBoards.length,
    channelCounts: countLeadsBy(forChannels, (row) => row.channel),
    channelTotal: forChannels.length,
    leads: forChannels.filter(
      (row) =>
        filters.channel === ALL_CHANNELS || row.channel === filters.channel,
    ),
  }
}

/** 같은 번호의 리드 묶음 — head가 가장 최근 리드, rest는 그 앞의 리드(최근
 * 것부터). */
export interface LeadGroup {
  kind: 'customer'
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
    else groups.set(key, { kind: 'customer', key, head: row, rest: [] })
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

/** 고객 상세 왼쪽 목록 — 표에 보이는 리드 순서대로(고객별이면 묶음의 맨 앞
 * 리드, 소재별이면 소재 묶음 안의 리드 순), 번호가 있어 고객 목록에서 찾은
 * 고객만, 한 번씩. */
export const customersInOrder = (
  rows: readonly MondayLeadFeedRow[],
  customers: readonly MondayCustomerListItem[],
): MondayCustomerListItem[] => {
  const byPhone = new Map(
    customers.map((customer) => [customer.phone, customer]),
  )
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const customer = row.phone ? byPhone.get(row.phone) : undefined
    if (!customer || seen.has(customer.phone)) return []
    seen.add(customer.phone)
    return [customer]
  })
}

/** 표를 무엇으로 묶을지 — 같은 번호(고객), 같은 소재(utm_campaign). */
export type LeadGroupBy = 'customer' | 'creative'

export const LEAD_GROUP_BYS: readonly LeadGroupBy[] = ['customer', 'creative']

export const LEAD_GROUP_BY_LABEL: Record<LeadGroupBy, string> = {
  customer: '고객별',
  creative: '소재별',
}

/** 같은 소재로 들어온 리드 묶음 — Meta는 utm_campaign이 광고(소재) 이름이고,
 * 다른 매체는 캠페인 이름이다(소재명 utm_content를 받기 전까지). */
export interface CreativeGroup {
  kind: 'creative'
  key: string
  channel: MondayLeadChannel
  /** utm_campaign — 없으면 null. */
  campaign: string | null
  /** 묶음 안의 리드 — 인입 시각 순(정렬 방향을 따른다). */
  leads: MondayLeadFeedRow[]
  /** 소재 하나를 골라 그 리드를 쪽으로 나눠 볼 때 이 쪽의 리드 — 있으면 표는
   * '더 보기' 없이 이것만 그린다(머리 줄 건수는 leads 전체). */
  pageLeads?: MondayLeadFeedRow[]
}

/** 리드를 매체·utm_campaign으로 묶는다 — 리드가 많은 묶음부터(같으면 최근
 * 리드가 있는 묶음부터), UTM 없는 묶음은 맨 뒤. 묶음 안은 인입 시각 순. */
export const groupByCreative = (
  rows: readonly MondayLeadFeedRow[],
  direction: SortDirection,
): CreativeGroup[] => {
  const groups = new Map<string, CreativeGroup>()
  for (const row of rows) {
    const campaign = row.utmCampaign?.trim() || null
    const key = `${row.channel}:${campaign ?? ''}`
    const group = groups.get(key)
    if (group) group.leads.push(row)
    else
      groups.set(key, {
        kind: 'creative',
        key,
        channel: row.channel,
        campaign,
        leads: [row],
      })
  }
  const latest = (group: CreativeGroup) =>
    group.leads.reduce((max, row) => {
      const at = row.createdAt ?? ''
      return at > max ? at : max
    }, '')
  const sign = direction === 'desc' ? -1 : 1
  return [...groups.values()]
    .map((group) => ({
      ...group,
      leads: [...group.leads].sort(
        (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') * sign,
      ),
    }))
    .sort(
      (a, b) =>
        // UTM 없이 들어온 리드는 소재가 아니라 맨 뒤로.
        Number(a.channel === 'unknown') - Number(b.channel === 'unknown') ||
        b.leads.length - a.leads.length ||
        latest(b).localeCompare(latest(a)),
    )
}

/** 문의 원문·상담 메모에서 눈여겨볼 말 — 소재 품질이나 렌탈 오해 같은 신호.
 * 두 글 모두 글 속에서 색으로 칠한다. */
export const LEAD_KEYWORDS: readonly { label: string; pattern: RegExp }[] = [
  { label: '렌탈', pattern: /렌탈|렌트|대여|임대/ },
  { label: '할부', pattern: /할부|분할/ },
  { label: '가격', pattern: /가격|금액|비용|얼마|단가/ },
  { label: '원거리', pattern: /원거리|먼\s?거리|거리가\s?멀|지방/ },
  {
    label: '학교·기관',
    pattern: /학교|대학|기관|교육청|관공서|공공|도서관|구청|시청/,
  },
  { label: '견적', pattern: /견적/ },
]

// 키워드 전부를 한 번에 찾는 식 — 말마다 (?:)로 감싸 '|'가 서로 섞이지 않게.
const KEYWORD_PATTERN = new RegExp(
  LEAD_KEYWORDS.map((keyword) => `(?:${keyword.pattern.source})`).join('|'),
  'g',
)

/** 글 조각 — 키워드인지와 그 글. */
export interface KeywordPart {
  text: string
  keyword: boolean
}

/** 글을 키워드와 나머지 조각으로 나눈다 — 순서대로 이어 붙이면 원래 글이다.
 * 찾은 위치로 자르므로 말 목록에 괄호(묶음)가 있어도 조각이 어긋나지 않는다. */
export const splitKeywords = (text: string): KeywordPart[] => {
  const parts: KeywordPart[] = []
  let at = 0
  for (const match of text.matchAll(KEYWORD_PATTERN)) {
    if (match[0] === '') continue
    if (match.index > at) {
      parts.push({ text: text.slice(at, match.index), keyword: false })
    }
    parts.push({ text: match[0], keyword: true })
    at = match.index + match[0].length
  }
  if (at < text.length) parts.push({ text: text.slice(at), keyword: false })
  return parts
}
