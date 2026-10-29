import type { MondayDailyInflow } from '../entity'

/** 그래프의 점 하나 — 하루, 한 주, 또는 한 달. `date`는 그 구간의 첫날이다. */
export interface InflowPoint extends MondayDailyInflow {
  /** 툴팁·표에 쓰는 이름 — "10/12 (월)", "10/6~10/12", "2026.10". */
  label: string
  /** x축에 쓰는 짧은 이름 — "10/12", "10/6~", "10월". */
  axisLabel: string
  /** 좁은 칸(보드별 추이의 가장 많은 칸)에 쓰는 이름 — "10/12 (월)",
   * "10/6~10/12", "2026.10"(달은 범위를 뺀다). */
  shortLabel: string
}

/** 묶는 단위. */
export type InflowUnit = 'day' | 'week' | 'month'

export const INFLOW_UNIT_LABEL: Record<InflowUnit, string> = {
  day: '일별',
  week: '주차별',
  month: '월별',
}

/** 요약의 평균 칸 이름. */
export const INFLOW_UNIT_AVERAGE: Record<InflowUnit, string> = {
  day: '하루 평균',
  week: '주 평균',
  month: '월 평균',
}

/** 표·요약에서 이 단위의 한 칸을 부르는 말. */
export const INFLOW_UNIT_NOUN: Record<InflowUnit, string> = {
  day: '날',
  week: '주',
  month: '달',
}

const DAY_MS = 86_400_000

const toISO = (time: number): string =>
  new Date(time).toISOString().slice(0, 10)

const EMPTY_DAY = { total: 0, misentry: 0, boards: {} }

/** [start, end](둘 다 포함)의 모든 날짜에 대해 한 줄씩 — 인입이 없던 날은
 * 서버 데이터에 없으므로 0건으로 채운다(그래프에서 날짜가 건너뛰지 않게). */
const dailyRows = (
  days: MondayDailyInflow[],
  start: string,
  end: string,
): MondayDailyInflow[] => {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const rows: MondayDailyInflow[] = []
  for (let time = Date.parse(start); time <= Date.parse(end); time += DAY_MS) {
    const date = toISO(time)
    rows.push(byDate.get(date) ?? { date, ...EMPTY_DAY })
  }
  return rows
}

/** 여러 날을 한 줄로 합친다. */
const mergeDays = (rows: MondayDailyInflow[]): MondayDailyInflow => {
  const boards: Record<string, number> = {}
  for (const row of rows) {
    for (const [name, count] of Object.entries(row.boards ?? {})) {
      boards[name] = (boards[name] ?? 0) + count
    }
  }
  return {
    date: rows[0].date,
    total: rows.reduce((sum, row) => sum + row.total, 0),
    misentry: rows.reduce((sum, row) => sum + row.misentry, 0),
    boards,
  }
}

/** 주차 — 기간을 시작일부터 7일씩 자르되, 7로 나누어떨어지지 않는 나머지
 * 일수는 맨 앞 구간에 둔다(마지막 주가 온전한 7일이 되게). cmip의 주차별
 * 표(functions-cmip의 buildWeekRanges)와 같은 규칙이라 두 화면의 주차가
 * 같은 날짜에서 끊긴다. */
const weekChunks = (rows: MondayDailyInflow[]): MondayDailyInflow[][] => {
  const chunks: MondayDailyInflow[][] = []
  const remainder = rows.length % 7
  if (remainder > 0) chunks.push(rows.slice(0, remainder))
  for (let index = remainder; index < rows.length; index += 7) {
    chunks.push(rows.slice(index, index + 7))
  }
  return chunks
}

/** 월 — 달력의 달 단위. 기간이 달 중간에서 시작하거나 끝나면 그 달은 기간에
 * 걸친 날만 센다. */
const monthChunks = (rows: MondayDailyInflow[]): MondayDailyInflow[][] => {
  const byMonth = new Map<string, MondayDailyInflow[]>()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), row])
  }
  return [...byMonth.values()]
}

/** 조회 기간의 인입을 단위(일/주/월)로 묶은 그래프용 데이터. */
export const inflowSeries = (
  days: MondayDailyInflow[],
  start: string,
  end: string,
  unit: InflowUnit = 'day',
): InflowPoint[] => {
  const rows = dailyRows(days, start, end)

  if (unit === 'day') {
    return rows.map((row) => ({
      ...row,
      label: formatDay(row.date),
      axisLabel: formatDayShort(row.date),
      shortLabel: formatDay(row.date),
    }))
  }

  const chunks = unit === 'week' ? weekChunks(rows) : monthChunks(rows)
  return chunks.map((chunk) => {
    const first = chunk[0].date
    const last = chunk[chunk.length - 1].date
    const range = `${formatDayShort(first)}~${formatDayShort(last)}`
    const [year, month] = first.split('-')
    return {
      ...mergeDays(chunk),
      label: unit === 'week' ? range : `${year}.${month} (${range})`,
      axisLabel: unit === 'week' ? range : `${Number(month)}월`,
      shortLabel: unit === 'week' ? range : `${year}.${month}`,
    }
  })
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
  /** 한 칸(하루·한 주·한 달) 평균 인입. */
  average: number
  /** 가장 많이 들어온 칸 — 기간이 비었으면 null. */
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

/** 보드별 추이 목록의 한 줄 — 기간 칸마다의 건수와 그 합·비중·최고 칸. */
export interface BoardTrend {
  name: string
  /** 기간 칸(points 순서 = 오래된 것부터)마다의 건수. */
  series: number[]
  total: number
  /** 기간 전체 인입 대비(0~1). */
  share: number
  /** 가장 많았던 칸 — 한 번도 없었으면 null. */
  peak: { index: number; label: string; count: number } | null
}

const boardTrendOf = (
  name: string,
  series: number[],
  points: InflowPoint[],
  allTotal: number,
): BoardTrend => {
  const total = series.reduce((sum, value) => sum + value, 0)
  const peakIndex = series.reduce(
    (best, value, index) => (value > series[best] ? index : best),
    0,
  )
  return {
    name,
    series,
    total,
    share: allTotal === 0 ? 0 : total / allTotal,
    peak:
      total === 0
        ? null
        : {
            index: peakIndex,
            label: points[peakIndex].shortLabel,
            count: series[peakIndex],
          },
  }
}

/**
 * 표(기간 × 보드)를 보드 쪽으로 돌려 본 것 — 보드마다 한 줄(많은 순), 그리고
 * 오기입 한 줄. 오기입은 여러 보드에 걸친 별도 지표라 따로 돌려준다.
 */
export const buildBoardTrends = (
  points: InflowPoint[],
  summary: InflowSummary,
): { boards: BoardTrend[]; misentry: BoardTrend } => ({
  boards: summary.boards.map((board) =>
    boardTrendOf(
      board.name,
      points.map((point) => point.boards?.[board.name] ?? 0),
      points,
      summary.total,
    ),
  ),
  misentry: boardTrendOf(
    '오기입',
    points.map((point) => point.misentry),
    points,
    summary.total,
  ),
})

/** 표의 칸(열)마다 가장 큰 값 — 히트맵 칸의 색 세기(값 / 이 값)에 쓴다. */
export const inflowColumnMax = (
  points: InflowPoint[],
  summary: InflowSummary,
): Record<string, number> => {
  const keys: InflowSortKey[] = [
    'total',
    'misentry',
    ...summary.boards.map((board) => `board:${board.name}` as const),
  ]
  return Object.fromEntries(
    keys.map((key) => [
      key,
      Math.max(0, ...points.map((point) => Number(sortValue(point, key)))),
    ]),
  )
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

/** 표의 정렬 기준 — 날짜(기간), 전체 인입, 오기입, 또는 보드 하나
 * (`board:보드이름`). */
export type InflowSortKey = 'date' | 'total' | 'misentry' | `board:${string}`

const sortValue = (point: InflowPoint, key: InflowSortKey): string | number => {
  if (key === 'date') return point.date
  if (key === 'total') return point.total
  if (key === 'misentry') return point.misentry
  return point.boards?.[key.slice('board:'.length)] ?? 0
}

/** 표에 보여줄 순서로 정렬한다. 값이 같은 줄끼리는 최근 날짜가 위로 온다. */
export const sortInflowRows = (
  points: InflowPoint[],
  key: InflowSortKey,
  direction: 'asc' | 'desc',
): InflowPoint[] => {
  const sign = direction === 'asc' ? 1 : -1
  return [...points].sort((a, b) => {
    const valueA = sortValue(a, key)
    const valueB = sortValue(b, key)
    const compared =
      typeof valueA === 'number' && typeof valueB === 'number'
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB))
    return compared !== 0 ? compared * sign : b.date.localeCompare(a.date)
  })
}
