/**
 * MetricsSummary의 각 지표를 어떻게 표시할지 한 곳에 모아둔 메타데이터.
 * KPI 카드, 표, 그래프 모달이 전부 이 목록을 기준으로 렌더한다.
 */
import type { MetricsSummary } from '../client'

export type MetricKey = keyof MetricsSummary

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
  /** 있으면 표 컬럼 헤더에 "?" 아이콘을 같이 달아 호버 시 보여준다 — 채널마다
   * 지원 범위가 달라 값만으로는 헷갈릴 수 있는 지표에 쓴다(현재는 frequency만). */
  note?: string
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

// conversions 전용 — Google은 전환 귀속(attribution) 모델 때문에 원본 값 자체가
// 소수(예: 데이터 기반 귀속이 전환 1건을 여러 클릭에 나눠 배분)라 반올림하지
// 않고 그대로 보여주는데, Meta/Naver(항상 정수)와 자릿수가 들쭉날쭉하면 표에서
// 채널을 오갈 때 읽기 불편하다. 그래서 모든 채널이 소수 셋째 자리까지 고정
// 표기하도록 맞춘다(정수 채널은 .000으로 채워짐) — 값 자체(집계·합산)는 그대로.
const num3 = (v: number): string =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

export const METRIC_FIELDS: readonly MetricField[] = [
  {
    key: 'impressions',
    label: 'Impressions',
    format: num,
    formatCompact: num,
    unit: '회',
    color: '#3987e5',
  },
  {
    key: 'clicks',
    label: 'Clicks',
    format: num,
    formatCompact: num,
    unit: '회',
    color: '#d95926',
  },
  {
    key: 'spend',
    label: 'Spend',
    format: won,
    formatCompact: num,
    unit: '원',
    color: '#199e70',
  },
  {
    key: 'conversions',
    label: 'Conversions',
    format: num3,
    formatCompact: num3,
    unit: '건',
    color: '#c98500',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    format: won,
    formatCompact: num,
    unit: '원',
    color: '#c026d3',
    note: '전환 추적 설정이나 캠페인 목표에 따라 값이 안 잡힐 수 있습니다(예: 리드 목표 캠페인, 전환 추적 미설정 네이버 계정) — 0이 "매출 없음"과 "측정 안 됨"을 구분하지 않고 함께 나타냅니다.',
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
    note: '네이버는 frequency 지표를 제공하지 않아 항상 0으로 표시됩니다. Google은 캠페인 단위 데이터에서만 실제 값을 제공하고, adset(광고그룹) 단위에서는 제공하지 않아 0으로 표시됩니다.',
  },
]
