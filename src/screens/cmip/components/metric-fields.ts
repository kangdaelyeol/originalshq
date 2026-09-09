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
  /** 그래프 y축 제목에 "(단위)"로 붙는 값. */
  unit: string
  /**
   * 지표 겹쳐보기(index-line-chart) 전용 색상 — 지표 정체성에 고정으로 묶여 있어야
   * 체크박스로 다른 지표를 켜고 끄더라도 이미 표시 중인 선의 색이 안 바뀐다.
   * 앞 8개는 dataviz 스킬의 검증된 다크 테마 카테고리컬 팔레트(고정 순서),
   * 나머지 2개(CPM/Frequency)는 그 8개와 구분되도록 고른 보조 색상.
   */
  color: string
}

const num = (v: number): string => v.toLocaleString()
const won = (v: number): string => `${v.toLocaleString()}원`

// 소수점 둘째 자리까지 고정 — round2()가 4.1처럼 끝자리 0을 잘라내므로, 자릿수를
// 맞춰서 표시하려면 toFixed가 아니라 toLocaleString의 자릿수 옵션이 필요하다
// (천 단위 구분 쉼표는 유지하면서 4.10처럼 항상 두 자리를 채운다).
const num2 = (v: number): string =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const won2 = (v: number): string => `${num2(v)}원`
const pct2 = (v: number): string => `${num2(v)}%`

export const METRIC_FIELDS: readonly MetricField[] = [
  {
    key: 'impressions',
    label: '노출수(Impression)',
    format: num,
    formatCompact: num,
    unit: '회',
    color: '#3987e5',
  },
  {
    key: 'clicks',
    label: '클릭수(Clicks)',
    format: num,
    formatCompact: num,
    unit: '회',
    color: '#d95926',
  },
  {
    key: 'spend',
    label: '지출액(Spend)',
    format: won,
    formatCompact: num,
    unit: '원',
    color: '#199e70',
  },
  {
    key: 'conversions',
    label: '전환수(Conversion)',
    format: num,
    formatCompact: num,
    unit: '건',
    color: '#c98500',
  },
  {
    key: 'ctr',
    label: 'CTR',
    format: pct2,
    formatCompact: num2,
    unit: '%',
    color: '#d55181',
  },
  {
    key: 'cpc',
    label: 'CPC',
    format: won2,
    formatCompact: num2,
    unit: '원',
    color: '#008300',
  },
  {
    key: 'cpa',
    label: 'CPA',
    format: won2,
    formatCompact: num2,
    unit: '원',
    color: '#9085e9',
  },
  {
    key: 'cvr',
    label: 'CVR',
    format: pct2,
    formatCompact: num2,
    unit: '%',
    color: '#e66767',
  },
  {
    key: 'cpm',
    label: 'CPM',
    format: won2,
    formatCompact: num2,
    unit: '원',
    color: '#56c2d6',
  },
  {
    key: 'frequency',
    label: 'Frequency',
    format: num2,
    formatCompact: num2,
    unit: '회',
    color: '#b98d5e',
  },
]
