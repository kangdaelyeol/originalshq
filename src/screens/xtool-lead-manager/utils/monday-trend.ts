import type { MondayDailyInflow } from '../entity'

/** 그래프의 하루 — 서버가 준 모양 그대로. */
export type InflowPoint = MondayDailyInflow

const DAY_MS = 86_400_000

const toISO = (time: number): string =>
  new Date(time).toISOString().slice(0, 10)

/** [start, end](둘 다 포함)의 모든 날짜에 대해 한 줄씩 — 인입이 없던 날은
 * 서버 데이터에 없으므로 0건으로 채운다(그래프에서 날짜가 건너뛰지 않게). */
export const inflowSeries = (
  days: MondayDailyInflow[],
  start: string,
  end: string,
): InflowPoint[] => {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const points: InflowPoint[] = []

  for (let time = Date.parse(start); time <= Date.parse(end); time += DAY_MS) {
    const date = toISO(time)
    points.push(byDate.get(date) ?? { date, total: 0, misentry: 0, boards: {} })
  }
  return points
}

/** 보드 이름을 표·툴팁용으로 줄인다 — "[B2B] F2 울트라 보드" → "F2 울트라". */
export const shortBoardName = (name: string): string =>
  name
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/\s*보드$/, '')
    .trim()

export interface InflowSummary {
  total: number
  misentry: number
  /** 하루 평균 인입(기간의 모든 날로 나눈 값). */
  average: number
  /** 가장 많이 들어온 날 — 기간이 비었으면 null. */
  peak: InflowPoint | null
  /** 기간 동안 인입이 있던 보드들 — 건수가 많은 순. */
  boards: { name: string; count: number }[]
}

export const summarizeInflow = (points: InflowPoint[]): InflowSummary => {
  const total = points.reduce((sum, point) => sum + point.total, 0)
  const boardCounts = new Map<string, number>()
  for (const point of points) {
    for (const [name, count] of Object.entries(point.boards ?? {})) {
      boardCounts.set(name, (boardCounts.get(name) ?? 0) + count)
    }
  }

  return {
    total,
    misentry: points.reduce((sum, point) => sum + point.misentry, 0),
    average: points.length === 0 ? 0 : total / points.length,
    peak: points.reduce<InflowPoint | null>(
      (best, point) => (!best || point.total > best.total ? point : best),
      null,
    ),
    boards: [...boardCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/** y축 눈금 — 최댓값을 덮는 "깔끔한" 수(1·2·5 × 10ⁿ 간격)로 4칸 안팎. */
export const niceTicks = (max: number): number[] => {
  if (max <= 0) return [0, 1]
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude
  const niceStep = Math.max(1, step)
  const ticks: number[] = []
  for (let value = 0; value < max + niceStep; value += niceStep) {
    ticks.push(value)
    if (value >= max) break
  }
  return ticks
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "10/12 (월)" — 요일까지. */
export const formatDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`)
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()} (${WEEKDAYS[parsed.getUTCDay()]})`
}

/** "10/12" — x축용 짧은 표기. */
export const formatDayShort = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}
