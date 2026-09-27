/**
 * getAllInsights 클라이언트 — functions-cmip `getAllInsights`(onRequest, GET) 호출.
 * onCall/onRequest POST와 달리 쿼리 스트링으로 dateStart/dateEnd(YYYY-MM-DD)를 받는다.
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface MetricsSummary {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  /** 전환매출액. 채널·전환 추적 설정에 따라 값이 안 잡힐 수 있어(예: 리드
   * 목표 캠페인, 전환 추적 미설정 네이버 계정) 0이 "매출 없음"과 "측정 안 됨"
   * 둘 다를 의미할 수 있다. */
  revenue: number
  /** 오프라인(매장) 매출 — Monday CRM 기준 실제 결제액(getOfflineRevenue).
   * 광고 채널 응답(Meta/Google/Naver)엔 이 개념 자체가 없어 항상 0으로 채워
   * 들어오고(normalizeInsightSummary), 계정 전체(종합) 합계에만
   * combineChannelInsights가 실제 값을 채워 넣는다 — 캠페인/adset 단위에는
   * Monday 매출을 특정 캠페인에 귀속시킬 방법이 없어 항상 0이다. */
  offlineRevenue: number
  /** 온라인(자사몰) 매출 — Cafe24 기준 실제 결제액(getCafe24Revenue).
   * offlineRevenue와 완전히 같은 성격(광고 채널 응답엔 없음 → 정규화로 0
   * 채움 → combined 합계에만 실제 값)이지만 출처가 다르다(오프라인 매장
   * vs 온라인 자사몰) — 매출을 "어디서 났는지"까지 구분해서 보기 위해
   * 오프라인과 합치지 않고 별도 필드로 둔다. */
  onlineRevenue: number
  /** 광고비 대비 매출(오프라인+온라인 합산) — offlineRevenue와 같은 이유로
   * combined(종합) 합계에서만 의미 있는 값이고, 개별 채널·캠페인·adset은
   * 항상 0이다. 퍼센트(250 = 250%, 광고비의 2.5배). */
  roas: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
  frequency: number
}

export interface DateSummary extends MetricsSummary {
  date: ISODate
}

export interface DayOfWeekSummary extends MetricsSummary {
  dayOfWeek: string
}

export interface WeekSummary extends MetricsSummary {
  period: string
  startDate: ISODate
  endDate: ISODate
}

/** 캠페인/adset처럼 하위 그룹 단위로 total과 같은 도출 방식의 시계열 3종을
 * 묶어 재사용하는 형태(functions-cmip GroupedInsightSeries와 동일). */
export interface GroupedInsightSeries {
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
}

export interface AdsetSummary extends GroupedInsightSeries {
  adsetName: string
}

export interface CampaignSummary extends GroupedInsightSeries {
  campaignName: string
  adsets: AdsetSummary[]
  /** 결과 유형(Meta Ads Manager의 "결과" 컬럼) — Meta 캠페인만 채워 보낸다.
   * Google/Naver 캠페인엔 대응 개념이 없어 항상 undefined. */
  resultType?: string | null
}

export interface MetaInsightSummary {
  total: MetricsSummary
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
  // Meta/Google(getGoogleInsights) 둘 다 항상 채워 보내지만, 이 타입을 쓰는 다른
  // 채널이 나중에 캠페인 단위를 아직 지원 못 하는 경우를 위해 optional로 둔다.
  byCampaign?: CampaignSummary[]
}

const withZeroExternalRevenue = <T extends MetricsSummary>(m: T): T => ({
  ...m,
  offlineRevenue: m.offlineRevenue ?? 0,
  onlineRevenue: m.onlineRevenue ?? 0,
  roas: m.roas ?? 0,
})

function normalizeSeries<T extends GroupedInsightSeries>(s: T): T {
  return {
    ...s,
    byDate: s.byDate.map(withZeroExternalRevenue),
    byDayOfWeek: s.byDayOfWeek.map(withZeroExternalRevenue),
    byGroupedWeek: s.byGroupedWeek.map(withZeroExternalRevenue),
  }
}

/**
 * Meta/Google/Naver 응답(getAllInsights 등)은 offlineRevenue/onlineRevenue
 * 개념 자체를 모르는 백엔드에서 오기 때문에 이 필드들이 아예 없이 온다 —
 * 조회 직후, 화면에 쓰기 전에 이 함수로 한 번 지나 total/byDate/byDayOfWeek/
 * byGroupedWeek/byCampaign/adsets 전부에 0을 채워 넣는다. 그래야 KpiGrid/
 * MetricsTable/PivotSummary/차트 모달처럼 MetricsSummary를 곧바로
 * (aggregateMetrics 등을 거치지 않고) 렌더하는 자리에서 undefined 접근으로
 * 죽지 않는다.
 */
export function normalizeInsightSummary(
  insight: MetaInsightSummary,
): MetaInsightSummary {
  return {
    ...normalizeSeries(insight),
    total: withZeroExternalRevenue(insight.total),
    byCampaign: insight.byCampaign?.map((campaign) => ({
      ...campaign,
      ...normalizeSeries(campaign),
      adsets: campaign.adsets.map((adset) => ({
        ...adset,
        ...normalizeSeries(adset),
      })),
    })),
  }
}

interface ErrorBody {
  error?: string
}

export async function getAllInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getAllInsights?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getAllInsights 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getAllInsights 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaInsightSummary
}
