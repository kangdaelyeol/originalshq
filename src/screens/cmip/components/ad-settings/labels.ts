import type {
  AdBudget,
  BudgetPeriod,
  CreativeFormat,
  FunnelStage,
  GoalKpi,
} from '../../client'

// 광고 설정 화면이 같이 쓰는 이름·표기.

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = {
  daily: '일',
  lifetime: '총',
  monthly: '월',
}

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  awareness: '인지',
  consideration: '고려',
  conversion: '전환',
}

export const KPI_LABEL: Record<GoalKpi, string> = {
  cpa: '전환 단가',
  roas: 'ROAS',
  cpc: 'CPC',
  cpm: 'CPM',
  ctr: 'CTR',
  cvr: 'CVR',
}

export const CREATIVE_FORMAT_LABEL: Record<CreativeFormat, string> = {
  image: '이미지',
  video: '영상',
  carousel: '슬라이드',
  text: '텍스트',
  other: '기타',
}

export const won = (v: number) => `${Math.round(v).toLocaleString()}원`

export const formatBudget = (budget: AdBudget) =>
  `${BUDGET_PERIOD_LABEL[budget.period]} ${won(budget.amount)}`

/** "10/30" — 연도는 올해가 아니면 붙인다. */
export const shortDate = (iso: string, today: string) =>
  iso.slice(0, 4) === today.slice(0, 4)
    ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
    : `${iso.slice(2, 4)}.${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
