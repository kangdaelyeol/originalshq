// 여러 화면이 같이 쓰는 작은 계산 — 한국 날짜, 날짜 사이 일수, 중앙값, 퍼센트.

export const DAY_MS = 86_400_000
const KST_MS = 9 * 3_600_000

/** 한국 시각의 ISO 글자("2026-11-05T13:08:25.000Z" 모양, Z는 무시) — 앞에서
 * 잘라 날짜·시각으로 쓴다. 한국은 서머타임이 없어 9시간을 더하면 된다. */
export const koreaIso = (ms: number): string =>
  new Date(ms + KST_MS).toISOString()

/** 한국 날짜(YYYY-MM-DD) — 기본은 오늘. */
export const koreaDate = (ms: number = Date.now()): string =>
  koreaIso(ms).slice(0, 10)

/** 두 날짜(YYYY-MM-DD) 사이의 일수(to - from). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/** 중앙값 — 없으면 null. 짝수 개면 가운데 둘의 평균이고, decimals를 주면 그
 * 평균을 그 자리까지 반올림한다(기술 통계는 소수 첫째 자리, 퍼널은 그대로). */
export const median = (
  values: readonly number[],
  decimals?: number,
): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  const average = (sorted[middle - 1] + sorted[middle]) / 2
  if (decimals === undefined) return average
  const scale = 10 ** decimals
  return Math.round(average * scale) / scale
}

/** 비율(0~1) → "12.3%". */
export const percent = (rate: number, digits = 1): string =>
  `${(rate * 100).toFixed(digits)}%`

/** 부분 ÷ 전체 → "12.3%" — 전체가 0이면 "-". */
export const percentOf = (part: number, whole: number, digits = 1): string =>
  whole > 0 ? percent(part / whole, digits) : '-'
