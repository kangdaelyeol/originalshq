export type DeltaDir = 'up' | 'down' | 'flat'

export const DELTA_ARROW: Record<DeltaDir, string> = {
  up: '▲',
  down: '▼',
  flat: '—',
}

/** 두 값 사이의 증감/등락률 — prev가 없으면(첫 행 등) null. 화면에 나열된 순서상
 * "바로 윗 행"과 비교하는 데 쓴다 — 기본 정렬(시간순)이면 일별 표에선 전일대비,
 * 주차별 표에선 전주대비가 되고, 요일별 표는 월~일 순서상 바로 앞 요일과
 * 비교한다. 컬럼 정렬을 바꾸면 그 정렬 순서의 윗 행과 비교한다.
 * 메인 행뿐 아니라 채널별 펼침 행(각 채널의 이전 행 값)에도 그대로 쓴다.
 * 기간별 성과 그래프도 같은 규칙으로 바로 앞 칸과 비교한다. */
export function computeMetricDelta(
  now: number,
  prev: number | null,
): { delta: number; pct: number | null; dir: DeltaDir } | null {
  if (prev == null) return null
  // 신규 고객 ROAS처럼 값을 모르는(NaN) 칸은 증감을 낼 수 없다.
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}
