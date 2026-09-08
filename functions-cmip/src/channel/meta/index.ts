import { summarizeByDate, summarizeByDayOfWeek, summarizeTotal } from './helper'
import { MetaInsight } from './types'
import { getFetchUrl } from './utils'

const xTool_MAIN_ADS_ID = '763627086023164'
const xTool_SUB_ADS_ID = '1093841806220768'

export function summarizeMetaInsight(data: MetaInsight) {
  return {
    total: summarizeTotal(data),
    byDate: summarizeByDate(data),
    byDayOfWeek: summarizeByDayOfWeek(data),
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
}
