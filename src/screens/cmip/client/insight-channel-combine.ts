/**
 * Meta(실제) + Google(목업) 인사이트를 "종합/메타/구글" 3분할 뷰로 묶는다.
 * total뿐 아니라 campaign/adset 단위까지 같은 3분할을 제공한다.
 *
 * 캠페인·adset은 이름이 같으면(예: 두 채널에 같은 이름으로 병행 운영) 그 값을
 * 합산하고, 한쪽 채널에만 있으면 그 채널 값 그대로("combined"도 동일값) 노출한다
 * — 광고 플랫폼끼리 캠페인 ID를 공유하지 않아 이름 말고는 매칭할 키가 없다.
 *
 * 당근·네이버 등 채널이 늘어나면 이 파일에 그 채널만큼 인자/필드를 추가하는
 * 방식으로 확장한다.
 */
import {
  emptySeries,
  mergeByDate,
  seriesFromByDate,
  sumMetrics,
} from './insight-aggregate'
import type {
  AdsetSummary,
  CampaignSummary,
  GroupedInsightSeries,
  MetaInsightSummary,
  MetricsSummary,
} from './insight-client'

export interface ChannelSplitSeries {
  combined: GroupedInsightSeries
  meta: GroupedInsightSeries
  google: GroupedInsightSeries
}

export interface CombinedAdset extends ChannelSplitSeries {
  adsetName: string
}

export interface CombinedCampaign extends ChannelSplitSeries {
  campaignName: string
  adsets: CombinedAdset[]
}

export interface CombinedInsight {
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
  }
  /** 계정 전체(캠페인 구분 없이) byDate/byDayOfWeek/byGroupedWeek — 종합/메타/구글. */
  series: ChannelSplitSeries
  byCampaign: CombinedCampaign[]
}

function uniqueNames<T>(
  a: readonly T[],
  b: readonly T[],
  nameOf: (x: T) => string,
) {
  return Array.from(new Set([...a.map(nameOf), ...b.map(nameOf)])).sort(
    (x, y) => x.localeCompare(y),
  )
}

/** 채널별 시리즈를 종합/메타/구글 3분할로 묶는다. 한쪽 채널에 없으면(campaign/
 * adset이 그 채널에서 아예 없었던 경우) 빈 시리즈로 취급한다. */
function combineGroupedSeries(
  meta: GroupedInsightSeries | undefined,
  google: GroupedInsightSeries | undefined,
): ChannelSplitSeries {
  const metaSeries = meta ?? emptySeries()
  const googleSeries = google ?? emptySeries()
  return {
    combined: seriesFromByDate(
      mergeByDate(metaSeries.byDate, googleSeries.byDate),
    ),
    meta: metaSeries,
    google: googleSeries,
  }
}

function combineAdsets(
  metaAdsets: readonly AdsetSummary[],
  googleAdsets: readonly AdsetSummary[],
): CombinedAdset[] {
  return uniqueNames(metaAdsets, googleAdsets, (a) => a.adsetName).map(
    (adsetName) => {
      const metaAdset = metaAdsets.find((a) => a.adsetName === adsetName)
      const googleAdset = googleAdsets.find((a) => a.adsetName === adsetName)
      return {
        adsetName,
        ...combineGroupedSeries(metaAdset, googleAdset),
      }
    },
  )
}

function combineCampaigns(
  metaCampaigns: readonly CampaignSummary[],
  googleCampaigns: readonly CampaignSummary[],
): CombinedCampaign[] {
  return uniqueNames(metaCampaigns, googleCampaigns, (c) => c.campaignName).map(
    (campaignName) => {
      const metaCampaign = metaCampaigns.find(
        (c) => c.campaignName === campaignName,
      )
      const googleCampaign = googleCampaigns.find(
        (c) => c.campaignName === campaignName,
      )
      return {
        campaignName,
        ...combineGroupedSeries(metaCampaign, googleCampaign),
        adsets: combineAdsets(
          metaCampaign?.adsets ?? [],
          googleCampaign?.adsets ?? [],
        ),
      }
    },
  )
}

export function combineChannelInsights(
  meta: MetaInsightSummary,
  google: MetaInsightSummary,
): CombinedInsight {
  return {
    total: {
      combined: sumMetrics(meta.total, google.total),
      meta: meta.total,
      google: google.total,
    },
    series: combineGroupedSeries(meta, google),
    byCampaign: combineCampaigns(
      meta.byCampaign ?? [],
      google.byCampaign ?? [],
    ),
  }
}
