/**
 * 파생 지표 — Python `AdPerformance`의 @property(ctr/cpc/cpm/cpa/roas) 이관.
 * 저장하지 않고 항상 계산한다.
 */

export function safeDiv(a: number, b: number): number {
  return b ? a / b : 0
}

/**
 * 집계 원자료. 소스마다 필드명이 imps/impressions, conv/conversion, rev/revenue로
 * 갈리던 Python 쪽 관행(analyzer.py의 _agg vs AdPerformance 컬럼명)을 그대로 반영해
 * 두 이름 다 옵셔널로 받는다.
 */
export interface AggregateInput {
  cost?: number
  clicks?: number
  imps?: number
  impressions?: number
  conv?: number
  conversion?: number
  rev?: number
  revenue?: number
}

export interface DerivedMetrics {
  ctr: number
  cpc: number
  cpm: number
  cpa: number
  roas: number
}

/** 합계 객체 {cost, clicks, imps/impressions, conv/conversion, rev/revenue} 에서 지표 계산. */
export function derive(s: AggregateInput): DerivedMetrics {
  const imps = s.imps ?? s.impressions ?? 0
  const clicks = s.clicks ?? 0
  const cost = s.cost ?? 0
  const conv = s.conv ?? s.conversion ?? 0
  const rev = s.rev ?? s.revenue ?? 0
  return {
    ctr: safeDiv(clicks, imps) * 100,
    cpc: safeDiv(cost, clicks),
    cpm: safeDiv(cost, imps) * 1000,
    cpa: safeDiv(cost, conv),
    roas: safeDiv(rev, cost) * 100,
  }
}

/** ₩ 표기 — Python `_won`. */
export function won(x: number | null | undefined): string {
  return '₩' + Math.round(x || 0).toLocaleString('en-US')
}

/** "+12%" / "-8%" 형태 (소수 0자리). Python `f"{x:+.0f}%"`. */
export function pctStr(x: number, digits = 0): string {
  const v = Number(x)
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

/** 증감률 (%) 또는 null. Python `_pct` / `_pct_change`. */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}
