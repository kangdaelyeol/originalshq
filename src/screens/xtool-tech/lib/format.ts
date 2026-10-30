const trimZero = (s: string): string => s.replace(/\.0$/, '')

/** 1,284 → 1.3k, 48,620 → 48.6k, 1,380,000 → 1.4M — 축 눈금·범례 합계용. */
export function compact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${trimZero((v / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1))}M`
  if (abs >= 1_000) return `${trimZero((v / 1_000).toFixed(abs >= 100_000 ? 0 : 1))}k`
  return trimZero(v.toFixed(Number.isInteger(v) ? 0 : 1))
}

export const formatInt = (v: number): string => Math.round(v).toLocaleString('ko-KR')

/** 합이 정확히 100이 되게 반올림한다(최대 나머지 방식) — 도넛·비중 범례가 99%·101%로 보이지 않게. */
export function percentages(values: readonly number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const result = raw.map(Math.floor)
  let rest = 100 - result.reduce((s, v) => s + v, 0)
  const byRemainder = raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
  for (const { i } of byRemainder) {
    if (rest <= 0) break
    result[i] += 1
    rest -= 1
  }
  return result
}
