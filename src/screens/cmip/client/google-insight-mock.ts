/**
 * 구글 인사이트 API 목업 — 토큰 발급이 끝나기 전까지, getAllInsights와 동일한 모양
 * (MetaInsightSummary)의 테스트 데이터를 프론트에서 만들어 대신 쓴다. Functions 쪽은
 * 건드리지 않는다 — 나중에 실제 연동이 끝나면 이 파일 호출부만 진짜 API로 바꾸면 된다.
 */
import { addDays, dateRange, formatMD, fromISO } from '../utils'
import type { ISODate } from '../types'
import type {
  DateSummary,
  DayOfWeekSummary,
  MetaInsightSummary,
  MetricsSummary,
  WeekSummary,
} from './insight-client'

// "구글 광고 연동" 시점을 흉내낸 목업 데이터 보유 범위 — 이 밖의 날짜는 데이터가 없다.
const MOCK_MIN_DATE: ISODate = '2026-08-13'
const MOCK_MAX_DATE: ISODate = '2026-09-11'

const WEEKDAY_LABELS_MON_FIRST = ['월', '화', '수', '목', '금', '토', '일']

/** 날짜 문자열을 시드로 매번 같은 값을 내는 간단한 PRNG(mulberry32) — 같은 기간을
 * 다시 조회해도 값이 안 흔들리게 한다. */
function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const range = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min)

/** 하루치 지표를 만든다 — impressions/ctr/cpc/cvr을 먼저 정하고 나머지(clicks/
 * spend/conversions/cpa/cpm)를 그로부터 계산해 서로 어긋나지 않게 한다. */
function mockDailyMetrics(date: ISODate): MetricsSummary {
  const rand = seededRandom(`google:${date}`)
  const impressions = Math.round(range(rand, 6000, 22000))
  const ctr = range(rand, 1.2, 4.5)
  const clicks = Math.round((impressions * ctr) / 100)
  const cpc = range(rand, 180, 520)
  const spend = Math.round(clicks * cpc)
  const cvr = range(rand, 2.5, 9)
  const conversions = Math.round((clicks * cvr) / 100)
  return {
    impressions,
    clicks,
    spend,
    conversions,
    ctr,
    cpc,
    cpa: conversions > 0 ? spend / conversions : 0,
    cvr,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: range(rand, 1.05, 2.8),
  }
}

/** 원본 카운트(impressions/clicks/spend/conversions)를 합산하고, 비율 지표는 그
 * 합계에서 다시 계산한다 — 비율의 평균이 아니라 합계 기준 비율이어야 맞다. */
function aggregateMetrics(rows: readonly MetricsSummary[]): MetricsSummary {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const spend = rows.reduce((s, r) => s + r.spend, 0)
  const conversions = rows.reduce((s, r) => s + r.conversions, 0)
  const frequency =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + r.frequency, 0) / rows.length
  return {
    impressions,
    clicks,
    spend,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency,
  }
}

/** 해당 날짜가 속한 주의 월요일. */
function mondayOf(date: ISODate): ISODate {
  const dow = fromISO(date).getUTCDay() // 0=일 ~ 6=토
  const offset = dow === 0 ? -6 : 1 - dow
  return addDays(date, offset)
}

/**
 * getAllInsights와 같은 모양(MetaInsightSummary)의 구글 인사이트 목업.
 * 조회 범위와 목업 보유 범위(MOCK_MIN_DATE~MOCK_MAX_DATE)가 겹치는 구간만
 * 데이터를 만든다 — 실제 API도 연동 시작일 이전은 데이터가 없을 것이기 때문.
 */
export async function getGoogleInsightsMock(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const from = dateStart < MOCK_MIN_DATE ? MOCK_MIN_DATE : dateStart
  const to = dateEnd > MOCK_MAX_DATE ? MOCK_MAX_DATE : dateEnd

  if (from > to) {
    return {
      total: aggregateMetrics([]),
      byDate: [],
      byDayOfWeek: [],
      byGroupedWeek: [],
    }
  }

  const byDate: DateSummary[] = dateRange(from, to).map((date) => ({
    date,
    ...mockDailyMetrics(date),
  }))

  const byWeekdayGroups = new Map<string, DateSummary[]>()
  for (const row of byDate) {
    const label =
      WEEKDAY_LABELS_MON_FIRST[(fromISO(row.date).getUTCDay() + 6) % 7]
    const group = byWeekdayGroups.get(label)
    if (group) group.push(row)
    else byWeekdayGroups.set(label, [row])
  }
  const byDayOfWeek: DayOfWeekSummary[] = WEEKDAY_LABELS_MON_FIRST.flatMap(
    (label) => {
      const group = byWeekdayGroups.get(label)
      return group ? [{ dayOfWeek: label, ...aggregateMetrics(group) }] : []
    },
  )

  const byWeekGroups = new Map<ISODate, DateSummary[]>()
  for (const row of byDate) {
    const weekStart = mondayOf(row.date)
    const group = byWeekGroups.get(weekStart)
    if (group) group.push(row)
    else byWeekGroups.set(weekStart, [row])
  }
  const byGroupedWeek: WeekSummary[] = [...byWeekGroups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, group]) => {
      const startDate = group[0].date
      const endDate = group[group.length - 1].date
      return {
        period: `${formatMD(startDate)}~${formatMD(endDate)}`,
        startDate,
        endDate,
        ...aggregateMetrics(group),
      }
    })

  return {
    total: aggregateMetrics(byDate),
    byDate,
    byDayOfWeek,
    byGroupedWeek,
  }
}
