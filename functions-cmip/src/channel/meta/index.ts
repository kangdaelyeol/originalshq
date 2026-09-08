import {
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
  const data = { ...mainRes, ...subRes }
  return summarizeMetaInsight(data, dateStart, dateEnd)
}
