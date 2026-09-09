/**
 * MetricsSummary의 각 지표를 어떻게 표시할지 한 곳에 모아둔 메타데이터.
 * KPI 카드, 표, 그래프 모달이 전부 이 목록을 기준으로 렌더한다.
 */
import type { MetricsSummary } from '../client'

export interface MetricField {
  key: keyof MetricsSummary
  label: string
  /** KPI 카드용 — 단위 포함. */
  format: (v: number) => string
  /** 표/그래프 축용 — 단위 없이 간결하게. */
  formatCompact: (v: number) => string
}

const num = (v: number): string => v.toLocaleString()
const won = (v: number): string => `${v.toLocaleString()}원`
const pct = (v: number): string => `${v}%`

export const METRIC_FIELDS: readonly MetricField[] = [
  {
    key: 'impressions',
    label: '노출수(Impression)',
    format: num,
    formatCompact: num,
  },
  { key: 'clicks', label: '클릭수(Clicks)', format: num, formatCompact: num },
  { key: 'spend', label: '지출액(Spend)', format: won, formatCompact: num },
  {
    key: 'conversions',
    label: '전환수(Conversion)',
    format: num,
    formatCompact: num,
  },
  { key: 'ctr', label: 'CTR', format: pct, formatCompact: num },
  { key: 'cpc', label: 'CPC', format: won, formatCompact: num },
  { key: 'cpa', label: 'CPA', format: won, formatCompact: num },
  { key: 'cvr', label: 'CVR', format: pct, formatCompact: num },
  { key: 'cpm', label: 'CPM', format: won, formatCompact: num },
]
