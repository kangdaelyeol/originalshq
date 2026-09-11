import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import { MetaInsight } from './types'
import { getFetchUrl } from './utils'

const xTool_MAIN_ADS_ID = '763627086023164'
const xTool_SUB_ADS_ID = '1093841806220768'

function summarizeMetaInsight(
  data: MetaInsight,
  startDate: string,
  endDate: string,
) {
  return {
    total: summarizeTotal(data),
    byDate: summarizeByDate(data),
    byDayOfWeek: summarizeByDayOfWeek(data),
    byGroupedWeek: summarizeByWeek(data, startDate, endDate),
    // 캠페인별(그 안의 adset별 포함) byDate/byDayOfWeek/byGroupedWeek — total과
    // 같은 도출 방식을 캠페인·adset 단위 부분집합에 그대로 적용한 것.
    byCampaign: summarizeByCampaign(data, startDate, endDate),
  }
}

export const getMetaInsight = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
) => {
  const mainAdsInsightFetchUrl = getFetchUrl(
    dateStart,
    dateEnd,
    xTool_MAIN_ADS_ID,
    accessToken,
  )

  const subAdsInsightFetchUrl = getFetchUrl(
    dateStart,
    dateEnd,
    xTool_SUB_ADS_ID,
    accessToken,
  )
  const [mainRes, subRes] = await Promise.all([
    await fetch(mainAdsInsightFetchUrl).then((res) => res.json()),
    await fetch(subAdsInsightFetchUrl).then((res) => res.json()),
  ])
  const data: MetaInsight = [...(mainRes.data ?? []), ...(subRes.data ?? [])]
  return summarizeMetaInsight(data, dateStart, dateEnd)
}
