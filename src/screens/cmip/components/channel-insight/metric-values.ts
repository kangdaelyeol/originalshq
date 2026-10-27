import type { MetricsSummary } from '../../client'
import type { MetricField, MetricKey } from '../metric-fields'

// 합산해서 의미 있는(더하면 되는) 지표 — 평균 행에서 일수로 나눈다. 나머지(ctr/cpc/
// cpa/cvr/cpm/frequency)는 이미 비율/도수라 aggregateMetrics가 원본 카운트 합계에서
// 다시 계산해준 값을 그대로 쓴다(다시 나누면 이중으로 평균 내는 꼴이 된다).
const SUM_METRIC_KEYS: ReadonlySet<MetricKey> = new Set([
  'impressions',
  'clicks',
  'spend',
  'conversions',
  'offlineRevenue',
  'onlineRevenue',
  'totalRevenue',
])

/** 평균 행의 표시값 — formatCompact(num())는 소수 자릿수를 강제하지 않아, 일수로
 * 나눈 값이 딱 안 떨어지면 toLocaleString 기본값(최대 3자리)이 그대로 노출돼
 * 다른 행(합계·일별, 전부 정수)과 자릿수가 들쭉날쭉해 보였다. spend(원)는 애초에
 * 소수 단위가 없는 지표라 정수로 반올림하고, 나머지 합산 지표(횟수·건수)는 소수
 * 1자리까지만 남긴다. 비율 지표(ctr/cpc 등)는 원래도 고정 2자리라 그대로 둔다. */
export function averageValueOf(
  f: MetricField,
  agg: MetricsSummary,
  dayCount: number,
): number {
  if (!SUM_METRIC_KEYS.has(f.key)) return agg[f.key]
  const raw = agg[f.key] / dayCount
  return f.key === 'spend' ? Math.round(raw) : Math.round(raw * 10) / 10
}
