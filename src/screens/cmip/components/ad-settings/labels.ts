import type {
  AdBudget,
  BudgetPeriod,
  CreativeFormat,
  FunnelStage,
  GoalKpi,
  PlatformSettingFields,
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

// 전환 목표마다 실제로 세는 이벤트 이름(Meta 표준 이벤트 기준) — 드롭다운에
// "문의(Contact)"처럼 같이 보여 준다. 목표·소재 관리에서 새로 만든 목표는
// 이벤트를 모르니 이름만.
const GOAL_EVENT: Record<string, string> = {
  inquiry: 'Contact',
  purchase: 'Purchase',
  cart: 'AddToCart',
  signup: 'CompleteRegistration',
  call: 'Call',
  landing: 'LandingPageView',
  traffic: 'LinkClick',
  awareness: 'Reach',
}

/** "문의(Contact)" — 이벤트를 모르는 목표는 이름만. */
export const goalOptionLabel = (goal: { key: string; label: string }) =>
  GOAL_EVENT[goal.key] ? `${goal.label}(${GOAL_EVENT[goal.key]})` : goal.label

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

/** 매체 설정 칸 이름 — 바뀐 칸 문구에서 "매체 예산"처럼 장 칸과 가른다. */
export const PLATFORM_FIELD_LABEL: Record<keyof PlatformSettingFields, string> =
  {
    budget: '예산',
    bidding: '입찰',
    targetCpa: '목표 CPA',
    targetRoas: '목표 ROAS',
    audience: '타기팅',
  }

/** 매체 설정 한 칸을 글자로 — 없으면 빈 글자. */
export const platformValue = (
  fields: PlatformSettingFields,
  key: keyof PlatformSettingFields,
): string => {
  switch (key) {
    case 'budget':
      return fields.budget ? formatBudget(fields.budget) : ''
    case 'targetCpa':
      return fields.targetCpa !== null ? won(fields.targetCpa) : ''
    case 'targetRoas':
      return fields.targetRoas !== null
        ? `${fields.targetRoas.toLocaleString('ko-KR')}%`
        : ''
    default:
      return fields[key]
  }
}

/** 매체 설정 한 줄 — 예산 · 입찰 · 목표 · 타기팅(있는 칸만). */
export const platformLine = (fields: PlatformSettingFields) =>
  (['budget', 'bidding', 'targetCpa', 'targetRoas', 'audience'] as const)
    .map((key) => {
      const value = platformValue(fields, key)
      return value && key.startsWith('target')
        ? `${PLATFORM_FIELD_LABEL[key]} ${value}`
        : value
    })
    .filter(Boolean)
    .join(' · ')

/** "10/30" — 연도는 올해가 아니면 붙인다. */
export const shortDate = (iso: string, today: string) =>
  iso.slice(0, 4) === today.slice(0, 4)
    ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
    : `${iso.slice(2, 4)}.${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
