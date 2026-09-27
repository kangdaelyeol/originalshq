/**
 * Meta(실제) + Google(실제) + Naver(실제) 인사이트를 "종합/메타/구글/네이버" 4분할
 * 뷰로 묶는다. total뿐 아니라 campaign/adset 단위까지 같은 4분할을 제공한다.
 *
 * 캠페인·adset은 이름이 같으면(예: 여러 채널에 같은 이름으로 병행 운영) 그 값을
 * 합산하고, 한쪽 채널에만 있으면 그 채널 값 그대로("combined"도 동일값) 노출한다
 * — 광고 플랫폼끼리 캠페인 ID를 공유하지 않아 이름 말고는 매칭할 키가 없다.
 *
 * 당근 등 채널이 더 늘어나면 이 파일에 그 채널만큼 인자/필드를 추가하는 방식으로
 * 확장한다.
 */
import {
  emptyMetrics,
  emptySeries,
  mergeByDateWeighted,
  seriesFromByDate,
  sumMetricsWeighted,
} from './insight-aggregate'
import type {
  AdsetSummary,
  CampaignSummary,
  DateSummary,
  GroupedInsightSeries,
  MetaInsightSummary,
  MetricsSummary,
} from './insight-client'
import type {
  OfflineRevenueDateSummary,
  OfflineRevenueSummary,
} from './offline-revenue-client'
import type {
  Cafe24RevenueDateSummary,
  Cafe24RevenueSummary,
} from './cafe24-revenue-client'
import type { ISODate } from '../types'

export interface ChannelSplitSeries {
  combined: GroupedInsightSeries
  meta: GroupedInsightSeries
  google: GroupedInsightSeries
  naver: GroupedInsightSeries
}

export interface CombinedAdset extends ChannelSplitSeries {
  adsetName: string
}

export interface CombinedCampaign extends ChannelSplitSeries {
  campaignName: string
  adsets: CombinedAdset[]
  /** 결과 유형 — Meta 캠페인에만 있는 값이라, 이름이 같은 캠페인이 여러 채널에
   * 걸쳐 있어도 Meta 쪽 값을 그대로 가져온다(Google/Naver는 대응 개념이 없어
   * undefined). */
  resultType?: string | null
}

export interface CombinedInsight {
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
    naver: MetricsSummary
  }
  /** 계정 전체(캠페인 구분 없이) byDate/byDayOfWeek/byGroupedWeek — 종합/메타/구글/네이버. */
  series: ChannelSplitSeries
  byCampaign: CombinedCampaign[]
}

// 네이버 검색광고 API는 frequency(도달 기반 평균 노출 빈도) 지표 자체를 제공하지
// 않아 항상 0으로 채워 보낸다(channel/naver/utils.ts) — 진짜 0이 아니라 "측정
// 안 됨"이다. sumMetricsWeighted/mergeByDateWeighted가 이 표시를 보고 네이버의
// 노출수를 frequency 가중평균 분모에서 제외한다(그대로 두면 종합 frequency가
// 실제보다 낮게 나온다). Meta/Google은 정상 제공하므로 true.
const HAS_FREQUENCY: Record<'meta' | 'google' | 'naver', boolean> = {
  meta: true,
  google: true,
  naver: false,
}

function uniqueNames<T>(
  lists: readonly (readonly T[])[],
  nameOf: (x: T) => string,
) {
  return Array.from(
    new Set(lists.flatMap((list) => list.map(nameOf))),
  ).sort((x, y) => x.localeCompare(y))
}

/** 광고 채널엔 없는 "오프라인 매출"(Monday)과 "온라인 매출"(Cafe24)을
 * combined.byDate에만 끼워 넣는다 — 날짜가 같으면 그 행에 얹고, 광고비가 아예
 * 0이라 ad byDate에 그 날짜 행 자체가 없었던 날(매출은 있는데 광고 집행이
 * 없던 날)은 새 행으로 추가한다. campaign/adset 단위 combineGroupedSeries
 * 호출에는 이 인자들을 안 주므로([]), 두 매출 모두 특정 캠페인에 귀속시키는
 * 일은 없다 — 항상 계정 전체(종합) 기준으로만 채워진다. */
function mergeExternalRevenueIntoByDate(
  byDate: readonly DateSummary[],
  offlineByDate: readonly OfflineRevenueDateSummary[],
  onlineByDate: readonly Cafe24RevenueDateSummary[],
): DateSummary[] {
  if (offlineByDate.length === 0 && onlineByDate.length === 0) {
    return [...byDate]
  }

  const offlineByDateMap = new Map(
    offlineByDate.map((d) => [d.date, d.totalPaid]),
  )
  const onlineByDateMap = new Map(
    onlineByDate.map((d) => [d.date, d.paymentAmount]),
  )
  const merged = byDate.map((row) => {
    const offlineRevenue = offlineByDateMap.get(row.date) ?? 0
    const onlineRevenue = onlineByDateMap.get(row.date) ?? 0
    const totalRevenue = offlineRevenue + onlineRevenue
    return {
      ...row,
      offlineRevenue,
      onlineRevenue,
      totalRevenue,
      // row.roas는 광고만 합친 시점(오프라인/온라인 매출=0 기준)에 계산된
      // 값이라 방금 얹은 실제 매출로 다시 계산해야 한다.
      roas: row.spend > 0 ? (totalRevenue / row.spend) * 100 : 0,
    }
  })

  const existingDates = new Set(byDate.map((row) => row.date))
  const missingDates = new Set<string>()
  for (const d of offlineByDate) {
    if (!existingDates.has(d.date)) missingDates.add(d.date)
  }
  for (const d of onlineByDate) {
    if (!existingDates.has(d.date)) missingDates.add(d.date)
  }
  for (const date of missingDates) {
    const offlineRevenue = offlineByDateMap.get(date) ?? 0
    const onlineRevenue = onlineByDateMap.get(date) ?? 0
    merged.push({
      ...emptyMetrics(),
      date,
      offlineRevenue,
      onlineRevenue,
      totalRevenue: offlineRevenue + onlineRevenue,
    })
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date))
}

/** 채널별 시리즈를 종합/메타/구글/네이버 4분할로 묶는다. 한쪽 채널에 없으면
 * (campaign/adset이 그 채널에서 아예 없었던 경우) 빈 시리즈로 취급한다.
 * dateStart/dateEnd는 "combined"의 byGroupedWeek 경계 기준(조회 범위) — Meta
 * capi와 같은 방식으로 잘라야 한다. offlineRevenueByDate/onlineRevenueByDate는
 * combined에만 반영되고(campaign/adset 호출은 [] 고정), byDayOfWeek/
 * byGroupedWeek는 seriesFromByDate가 이미 채워진 byDate를 다시 묶는 것뿐이라
 * 자동으로 offlineRevenue/onlineRevenue까지 같이 집계된다. */
function combineGroupedSeries(
  meta: GroupedInsightSeries | undefined,
  google: GroupedInsightSeries | undefined,
  naver: GroupedInsightSeries | undefined,
  dateStart: ISODate,
  dateEnd: ISODate,
  offlineRevenueByDate: readonly OfflineRevenueDateSummary[] = [],
  onlineRevenueByDate: readonly Cafe24RevenueDateSummary[] = [],
): ChannelSplitSeries {
  const metaSeries = meta ?? emptySeries()
  const googleSeries = google ?? emptySeries()
  const naverSeries = naver ?? emptySeries()
  const adCombinedByDate = mergeByDateWeighted([
    { byDate: metaSeries.byDate, hasFrequency: HAS_FREQUENCY.meta },
    { byDate: googleSeries.byDate, hasFrequency: HAS_FREQUENCY.google },
    { byDate: naverSeries.byDate, hasFrequency: HAS_FREQUENCY.naver },
  ])
  return {
    combined: seriesFromByDate(
      mergeExternalRevenueIntoByDate(
        adCombinedByDate,
        offlineRevenueByDate,
        onlineRevenueByDate,
      ),
      dateStart,
      dateEnd,
    ),
    meta: metaSeries,
    google: googleSeries,
    naver: naverSeries,
  }
}

function combineAdsets(
  metaAdsets: readonly AdsetSummary[],
  googleAdsets: readonly AdsetSummary[],
  naverAdsets: readonly AdsetSummary[],
  dateStart: ISODate,
  dateEnd: ISODate,
): CombinedAdset[] {
  return uniqueNames(
    [metaAdsets, googleAdsets, naverAdsets],
    (a) => a.adsetName,
  ).map((adsetName) => {
    const metaAdset = metaAdsets.find((a) => a.adsetName === adsetName)
    const googleAdset = googleAdsets.find((a) => a.adsetName === adsetName)
    const naverAdset = naverAdsets.find((a) => a.adsetName === adsetName)
    return {
      adsetName,
      ...combineGroupedSeries(
        metaAdset,
        googleAdset,
        naverAdset,
        dateStart,
        dateEnd,
      ),
    }
  })
}

function combineCampaigns(
  metaCampaigns: readonly CampaignSummary[],
  googleCampaigns: readonly CampaignSummary[],
  naverCampaigns: readonly CampaignSummary[],
  dateStart: ISODate,
  dateEnd: ISODate,
): CombinedCampaign[] {
  return uniqueNames(
    [metaCampaigns, googleCampaigns, naverCampaigns],
    (c) => c.campaignName,
  ).map((campaignName) => {
    const metaCampaign = metaCampaigns.find(
      (c) => c.campaignName === campaignName,
    )
    const googleCampaign = googleCampaigns.find(
      (c) => c.campaignName === campaignName,
    )
    const naverCampaign = naverCampaigns.find(
      (c) => c.campaignName === campaignName,
    )
    return {
      campaignName,
      ...combineGroupedSeries(
        metaCampaign,
        googleCampaign,
        naverCampaign,
        dateStart,
        dateEnd,
      ),
      adsets: combineAdsets(
        metaCampaign?.adsets ?? [],
        googleCampaign?.adsets ?? [],
        naverCampaign?.adsets ?? [],
        dateStart,
        dateEnd,
      ),
      resultType: metaCampaign?.resultType,
    }
  })
}

/** dateStart/dateEnd는 이번 조회에 실제로 쓴 범위 — 각 채널의 실제 데이터 커버리지가
 * 그보다 좁아도(예: 목업 보유 기간 제한) byGroupedWeek 경계는 항상 이 범위 기준으로
 * 맞춘다(Meta capi도 그렇게 자르기 때문에 채널 간 경계가 어긋나지 않는다).
 * offlineRevenue(Monday CRM, getOfflineRevenue)와 onlineRevenue(Cafe24,
 * getCafe24Revenue)는 광고 채널에 없는 개념이라 meta/google/naver 어느 쪽에도
 * 안 섞이고 total.combined/series.combined에만 실제 값이 들어간다(캠페인/adset
 * 단위는 항상 0 — 특정 캠페인에 귀속시킬 방법이 없다). */
export function combineChannelInsights(
  meta: MetaInsightSummary,
  google: MetaInsightSummary,
  naver: MetaInsightSummary,
  dateStart: ISODate,
  dateEnd: ISODate,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
): CombinedInsight {
  const adCombinedTotal = sumMetricsWeighted([
    { metrics: meta.total, hasFrequency: HAS_FREQUENCY.meta },
    { metrics: google.total, hasFrequency: HAS_FREQUENCY.google },
    { metrics: naver.total, hasFrequency: HAS_FREQUENCY.naver },
  ])
  const combinedOfflineRevenue = offlineRevenue?.total.totalPaid ?? 0
  const combinedOnlineRevenue = onlineRevenue?.total.paymentAmount ?? 0
  const combinedTotalRevenue = combinedOfflineRevenue + combinedOnlineRevenue

  return {
    total: {
      combined: {
        ...adCombinedTotal,
        offlineRevenue: combinedOfflineRevenue,
        onlineRevenue: combinedOnlineRevenue,
        totalRevenue: combinedTotalRevenue,
        // sumMetricsWeighted가 이미 roas를 계산했지만 그건 ad-only
        // offlineRevenue/onlineRevenue(=0) 기준이라, 방금 얹은 실제 매출로
        // 다시 계산해야 한다.
        roas:
          adCombinedTotal.spend > 0
            ? (combinedTotalRevenue / adCombinedTotal.spend) * 100
            : 0,
      },
      meta: meta.total,
      google: google.total,
      naver: naver.total,
    },
    series: combineGroupedSeries(
      meta,
      google,
      naver,
      dateStart,
      dateEnd,
      offlineRevenue?.byDate ?? [],
      onlineRevenue?.byDate ?? [],
    ),
    byCampaign: combineCampaigns(
      meta.byCampaign ?? [],
      google.byCampaign ?? [],
      naver.byCampaign ?? [],
      dateStart,
      dateEnd,
    ),
  }
}
