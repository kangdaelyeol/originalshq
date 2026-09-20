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
  emptySeries,
  mergeByDateWeighted,
  seriesFromByDate,
  sumMetricsWeighted,
} from './insight-aggregate'
import type {
  AdsetSummary,
  CampaignSummary,
  GroupedInsightSeries,
  MetaInsightSummary,
  MetricsSummary,
} from './insight-client'
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

/** 채널별 시리즈를 종합/메타/구글/네이버 4분할로 묶는다. 한쪽 채널에 없으면
 * (campaign/adset이 그 채널에서 아예 없었던 경우) 빈 시리즈로 취급한다.
 * dateStart/dateEnd는 "combined"의 byGroupedWeek 경계 기준(조회 범위) — Meta
 * capi와 같은 방식으로 잘라야 한다. */
function combineGroupedSeries(
  meta: GroupedInsightSeries | undefined,
  google: GroupedInsightSeries | undefined,
  naver: GroupedInsightSeries | undefined,
  dateStart: ISODate,
  dateEnd: ISODate,
): ChannelSplitSeries {
  const metaSeries = meta ?? emptySeries()
  const googleSeries = google ?? emptySeries()
  const naverSeries = naver ?? emptySeries()
  return {
    combined: seriesFromByDate(
      mergeByDateWeighted([
        { byDate: metaSeries.byDate, hasFrequency: HAS_FREQUENCY.meta },
        { byDate: googleSeries.byDate, hasFrequency: HAS_FREQUENCY.google },
        { byDate: naverSeries.byDate, hasFrequency: HAS_FREQUENCY.naver },
      ]),
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
 * 맞춘다(Meta capi도 그렇게 자르기 때문에 채널 간 경계가 어긋나지 않는다). */
export function combineChannelInsights(
  meta: MetaInsightSummary,
  google: MetaInsightSummary,
  naver: MetaInsightSummary,
  dateStart: ISODate,
  dateEnd: ISODate,
): CombinedInsight {
  return {
    total: {
      combined: sumMetricsWeighted([
        { metrics: meta.total, hasFrequency: HAS_FREQUENCY.meta },
        { metrics: google.total, hasFrequency: HAS_FREQUENCY.google },
        { metrics: naver.total, hasFrequency: HAS_FREQUENCY.naver },
      ]),
      meta: meta.total,
      google: google.total,
      naver: naver.total,
    },
    series: combineGroupedSeries(meta, google, naver, dateStart, dateEnd),
    byCampaign: combineCampaigns(
      meta.byCampaign ?? [],
      google.byCampaign ?? [],
      naver.byCampaign ?? [],
      dateStart,
      dateEnd,
    ),
  }
}
