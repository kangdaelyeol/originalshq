/** 추이 하나(시간 순 값들)의 요약 — 펼친 추이(TrendDetail)가 쓴다. */
export interface TrendStats {
  count: number
  mean: number
  max: { value: number; index: number }
  min: { value: number; index: number }
  last: number
  /** 바로 앞 칸(없으면 null). */
  prev: number | null
  /** 직선 추세(최소제곱)가 처음부터 끝까지 바꾼 양 — 기울기 × (칸 수 - 1). */
  trendChange: number
  /** 그 양을 평균으로 나눈 비율(%) — 평균이 0이면 null. */
  trendPct: number | null
  /** 직선 추세의 처음·끝 값 — 그래프에 점선으로. */
  trendLine: [number, number]
  /** 앞 절반·뒤 절반 평균(칸이 4개 미만이면 null). */
  halves: { first: number; second: number; pct: number | null } | null
  /** 표준편차와 변동계수(표준편차 ÷ 평균, %). */
  stdev: number
  cv: number | null
  /** 값이 0인 칸 수. */
  zeros: number
  /** 이동평균(창 크기 window, 앞쪽 칸은 있는 만큼으로) — 칸이 7개 미만이면 null. */
  moving: { window: number; values: number[] } | null
}

const average = (values: readonly number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

const pctOf = (part: number, base: number): number | null =>
  base === 0 ? null : (part / Math.abs(base)) * 100

export const trendStats = (input: readonly number[]): TrendStats => {
  const values = input.map((v) => (Number.isFinite(v) ? v : 0))
  const count = values.length
  const mean = average(values)

  let max = { value: -Infinity, index: 0 }
  let min = { value: Infinity, index: 0 }
  values.forEach((value, index) => {
    if (value > max.value) max = { value, index }
    if (value < min.value) min = { value, index }
  })
  if (count === 0) {
    max = { value: 0, index: 0 }
    min = { value: 0, index: 0 }
  }

  // 최소제곱 직선 — x는 칸 순서(0..n-1).
  const xMean = (count - 1) / 2
  let num = 0
  let den = 0
  values.forEach((value, index) => {
    num += (index - xMean) * (value - mean)
    den += (index - xMean) ** 2
  })
  const slope = den === 0 ? 0 : num / den
  const intercept = mean - slope * xMean
  const trendChange = slope * Math.max(count - 1, 0)

  const half = Math.floor(count / 2)
  const halves =
    count >= 4
      ? (() => {
          const first = average(values.slice(0, half))
          const second = average(values.slice(count - half))
          return { first, second, pct: pctOf(second - first, first) }
        })()
      : null

  const stdev = Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
  const window = count >= 21 ? 7 : 3
  const moving =
    count >= 7
      ? {
          window,
          values: values.map((_, index) =>
            average(values.slice(Math.max(0, index - window + 1), index + 1)),
          ),
        }
      : null

  return {
    count,
    mean,
    max,
    min,
    last: values[count - 1] ?? 0,
    prev: count >= 2 ? values[count - 2] : null,
    trendChange,
    trendPct: pctOf(trendChange, mean),
    trendLine: [intercept, intercept + slope * Math.max(count - 1, 0)],
    halves,
    stdev,
    cv: pctOf(stdev, mean),
    zeros: values.filter((value) => value === 0).length,
    moving,
  }
}
