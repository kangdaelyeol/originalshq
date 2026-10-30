/**
 * 매체별 테스트 계산(순수 함수) — 대상 하나의 일별 성과를 구간마다 나눠 지표를
 * 내고, 성과 데이터에서 눈에 띄는 변화(광고비 수준이 바뀐 날, 집행이 멈춘 날)를
 * 찾는다. 설정 변경(광고 설정 기록)은 components/ad-test/changes.ts가 찾는다.
 */
import type { ISODate } from '../types'
import { addDays, dateRange } from '../utils'
import type { AdEntityDay, AdTestSegment, GoalKpi } from './ad-settings-client'

/** 구간 하나의 지표 — 구간 길이가 달라도 견줄 수 있게 일평균을 같이 낸다. */
export interface SegmentMetrics {
  /** 구간의 날 수(데이터가 없는 날 포함). */
  days: number
  /** 광고비가 나간 날 수. */
  activeDays: number
  spend: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  dailySpend: number
  dailyConversions: number
  ctr: number
  cpc: number
  cpm: number
  cvr: number
  cpa: number
  roas: number
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0)

export function segmentMetrics(
  days: readonly AdEntityDay[],
  start: ISODate,
  end: ISODate,
): SegmentMetrics {
  const inRange = days.filter((d) => d.date >= start && d.date <= end)
  const sum = (key: keyof Omit<AdEntityDay, 'date'>) =>
    inRange.reduce((s, d) => s + d[key], 0)
  const spend = sum('spend')
  const impressions = sum('impressions')
  const clicks = sum('clicks')
  const conversions = sum('conversions')
  const revenue = sum('revenue')
  const length = end >= start ? dateRange(start, end).length : 0
  return {
    days: length,
    activeDays: inRange.filter((d) => d.spend > 0).length,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    dailySpend: div(spend, length),
    dailyConversions: div(conversions, length),
    ctr: div(clicks, impressions) * 100,
    cpc: div(spend, clicks),
    cpm: div(spend, impressions) * 1000,
    cvr: div(conversions, clicks) * 100,
    cpa: div(spend, conversions),
    roas: div(revenue, spend) * 100,
  }
}

/** 구간을 견주는 지표 — 판단 지표(GoalKpi)는 낮을수록/높을수록 좋은지 안다. */
export interface TestKpi {
  key: keyof SegmentMetrics
  label: string
  unit: 'won' | 'pct' | 'count' | 'days'
  /** 좋은 쪽 — 승자(가장 좋은 구간)를 고를 때. 없으면 크기만 본다. */
  better?: 'low' | 'high'
  goalKpi?: GoalKpi
  note?: string
}

export const TEST_KPIS: readonly TestKpi[] = [
  {
    key: 'dailySpend',
    label: '일평균 광고비',
    unit: 'won',
    note: '구간 길이가 달라도 견줄 수 있게 하루 평균',
  },
  {
    key: 'dailyConversions',
    label: '일평균 전환',
    unit: 'count',
    better: 'high',
  },
  {
    key: 'cpa',
    label: '전환 단가(CPA)',
    unit: 'won',
    better: 'low',
    goalKpi: 'cpa',
  },
  {
    key: 'cvr',
    label: '전환율(CVR)',
    unit: 'pct',
    better: 'high',
    goalKpi: 'cvr',
  },
  {
    key: 'ctr',
    label: '클릭률(CTR)',
    unit: 'pct',
    better: 'high',
    goalKpi: 'ctr',
  },
  {
    key: 'cpc',
    label: '클릭 단가(CPC)',
    unit: 'won',
    better: 'low',
    goalKpi: 'cpc',
  },
  {
    key: 'cpm',
    label: '노출 단가(CPM)',
    unit: 'won',
    better: 'low',
    goalKpi: 'cpm',
  },
  {
    key: 'roas',
    label: 'ROAS(플랫폼 전환 가치)',
    unit: 'pct',
    better: 'high',
    goalKpi: 'roas',
    note: '플랫폼이 잡은 전환 가치 ÷ 광고비 — 문의 목표 등은 0',
  },
  { key: 'spend', label: '광고비 합계', unit: 'won' },
  { key: 'conversions', label: '전환', unit: 'count' },
  { key: 'clicks', label: '클릭', unit: 'count' },
  { key: 'impressions', label: '노출', unit: 'count' },
  { key: 'activeDays', label: '집행일', unit: 'days' },
]

export const formatKpi = (kpi: TestKpi, value: number, days?: number) => {
  if (!Number.isFinite(value)) return '-'
  switch (kpi.unit) {
    case 'won':
      return `${Math.round(value).toLocaleString()}원`
    case 'pct':
      return `${value.toFixed(2)}%`
    case 'days':
      return days === undefined ? `${value}일` : `${value}/${days}일`
    default:
      return Math.abs(value - Math.round(value)) < 0.005
        ? Math.round(value).toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  }
}

/** 판단 지표가 비율 지표로 계산이 안 되는 구간(전환·클릭 0 등)은 승자에서 뺀다. */
const meaningful = (kpi: TestKpi, m: SegmentMetrics) => {
  if (kpi.key === 'cpa' || kpi.key === 'cvr')
    return m.conversions > 0 && m.clicks > 0
  if (kpi.key === 'cpc' || kpi.key === 'ctr') return m.clicks > 0
  if (kpi.key === 'cpm') return m.impressions > 0
  if (kpi.key === 'roas') return m.spend > 0 && m.revenue > 0
  return true
}

/** 가장 좋은 구간의 순번 — 비교할 구간이 둘 이상일 때만. */
export const bestSegment = (
  kpi: TestKpi,
  metrics: readonly SegmentMetrics[],
): number | null => {
  if (!kpi.better) return null
  const candidates = metrics
    .map((m, i) => ({ i, v: m[kpi.key], ok: meaningful(kpi, m) }))
    .filter((c) => c.ok && Number.isFinite(c.v))
  if (candidates.length < 2) return null
  const sorted = [...candidates].sort((a, b) =>
    kpi.better === 'low' ? a.v - b.v : b.v - a.v,
  )
  // 2등과 1% 넘게 벌어져야 "가장 좋음" — 거의 같으면 가리지 않는다.
  const [first, second] = sorted
  const gap = Math.abs(first.v - second.v) / Math.max(Math.abs(second.v), 1e-9)
  return gap >= 0.01 ? first.i : null
}

// ── 성과 데이터에서 찾는 변화 ────────────────────────────────────────────

export interface DataEvent {
  date: ISODate
  kind: 'spendUp' | 'spendDown' | 'paused' | 'resumed'
  /** 앞 7일·뒤 7일 일평균 광고비(멈춤·재개는 앞뒤 집행일 기준). */
  before: number
  after: number
  /** 멈춤이면 며칠 동안. */
  pausedDays?: number
}

const WINDOW = 7
// 앞뒤 7일 평균이 이만큼 이상 벌어지면 "수준이 바뀌었다"로 본다.
const SHIFT_RATIO = 1.5
// 하루 광고비가 이보다 적으면 비율이 의미 없다.
const MIN_DAILY = 3000

/** 데이터가 있는 첫날~마지막날 사이를 하루도 빼지 않고(없는 날은 0). */
export const fillDays = (days: readonly AdEntityDay[]): AdEntityDay[] => {
  if (days.length === 0) return []
  const byDate = new Map(days.map((d) => [d.date, d]))
  return dateRange(days[0].date, days[days.length - 1].date).map(
    (date) =>
      byDate.get(date) ?? {
        date,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      },
  )
}

/**
 * 광고비 수준이 바뀐 날 — 그 날 앞 7일과 뒤 7일(그 날 포함)의 일평균이 1.5배
 * 넘게 벌어진 날 중, 7일 안에서는 가장 크게 바뀐 날만. 예산·입찰 변경을 설정에
 * 적지 않았어도 성과에 드러난다. 3일 이상 광고비가 0이면 멈춤·재개로.
 */
export function dataEvents(days: readonly AdEntityDay[]): DataEvent[] {
  const all = fillDays(days)
  const spend = all.map((d) => d.spend)
  const avg = (from: number, to: number) => {
    const part = spend.slice(Math.max(0, from), Math.min(spend.length, to))
    return part.length ? part.reduce((s, v) => s + v, 0) / part.length : 0
  }
  const shifts: (DataEvent & { score: number })[] = []
  for (let i = WINDOW; i <= spend.length - WINDOW; i++) {
    const before = avg(i - WINDOW, i)
    const after = avg(i, i + WINDOW)
    if (Math.max(before, after) < MIN_DAILY || Math.min(before, after) <= 0)
      continue
    const ratio = after / before
    if (ratio < SHIFT_RATIO && ratio > 1 / SHIFT_RATIO) continue
    shifts.push({
      date: all[i].date,
      kind: ratio > 1 ? 'spendUp' : 'spendDown',
      before,
      after,
      score: Math.abs(Math.log(ratio)),
    })
  }
  // 7일 안에 겹치면 가장 크게 바뀐 날만.
  const picked: DataEvent[] = []
  for (const s of [...shifts].sort((a, b) => b.score - a.score)) {
    const near = picked.some(
      (p) =>
        Math.abs(Date.parse(p.date) - Date.parse(s.date)) < WINDOW * 86_400_000,
    )
    if (!near && picked.length < 5) {
      picked.push({
        date: s.date,
        kind: s.kind,
        before: s.before,
        after: s.after,
      })
    }
  }
  // 멈춤 — 집행하던 중 3일 이상 0.
  let i = 0
  while (i < all.length) {
    if (spend[i] > 0) {
      i++
      continue
    }
    let j = i
    while (j < all.length && spend[j] === 0) j++
    const length = j - i
    if (i > 0 && j < all.length && length >= 3) {
      picked.push({
        date: all[i].date,
        kind: 'paused',
        before: avg(i - WINDOW, i),
        after: 0,
        pausedDays: length,
      })
      picked.push({
        date: all[j].date,
        kind: 'resumed',
        before: 0,
        after: avg(j, j + WINDOW),
      })
    }
    i = j
  }
  // 멈춤·재개 앞뒤 7일의 수준 변화는 멈춤 때문이라 따로 알리지 않는다.
  const pauses = picked.filter(
    (p) => p.kind === 'paused' || p.kind === 'resumed',
  )
  const nearPause = (e: DataEvent) =>
    pauses.some(
      (p) =>
        Math.abs(Date.parse(p.date) - Date.parse(e.date)) <=
        WINDOW * 86_400_000,
    )
  return picked
    .filter((e) => e.kind === 'paused' || e.kind === 'resumed' || !nearPause(e))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── 구간 ────────────────────────────────────────────────────────────────

export const SEGMENT_LETTERS = 'ABCDEFGHIJKL'

let segmentSeq = 0
export const newSegmentId = () =>
  `seg-${Date.now().toString(36)}-${(++segmentSeq).toString(36)}`

/** 경계 날짜들(그 날부터 새 구간)로 [start, end]를 자른다. */
export function splitRange(
  start: ISODate,
  end: ISODate,
  cuts: readonly ISODate[],
  noteOf: (from: ISODate) => string = () => '',
): AdTestSegment[] {
  const starts = [
    start,
    ...[...new Set(cuts)].filter((c) => c > start && c <= end).sort(),
  ]
  return starts.map((from, i) => ({
    id: newSegmentId(),
    label: `구간 ${SEGMENT_LETTERS[i] ?? i + 1}`,
    start: from,
    end: i + 1 < starts.length ? addDays(starts[i + 1], -1) : end,
    note: noteOf(from),
  }))
}

/** [start, end]를 n개로 고르게. */
export function evenSegments(
  start: ISODate,
  end: ISODate,
  n: number,
): AdTestSegment[] {
  const all = dateRange(start, end)
  const size = Math.max(1, Math.floor(all.length / n))
  const cuts = Array.from(
    { length: n - 1 },
    (_, k) => all[(k + 1) * size],
  ).filter(Boolean)
  return splitRange(start, end, cuts)
}
