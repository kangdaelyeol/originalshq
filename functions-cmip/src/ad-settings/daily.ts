import { db } from '../data'
import { summarizeByDate as summarizeMetaByDate } from '../channel/meta/helper'
import { summarizeByDate as summarizeRowsByDate } from '../channel/naver/helper'
import type { DataSetInsight, DateSummary } from '../channel/meta/types'
import type { NaverInsightRow } from '../channel/naver/types'
import type { GoogleCampaignInsightRow } from '../channel/google/types'
import type { AdChannel, AdLevel } from './types'

// 캠페인·광고셋 하나의 일별 성과 — 매체별 테스트가 구간마다 지표를 나눠 본다.
// 인사이트 화면(조회 기간 전체·이름으로 묶음)과 달리 플랫폼 ID로 그 대상의
// 행만 읽는다(이름이 바뀌어도 이어진다). 동기화된 일별 컬렉션만 읽어 라이브
// API를 부르지 않는다 — 하루 여섯 번 최근 14일을 다시 받아 두어 충분히 새롭다.

/** 채널·단위마다 읽을 컬렉션과 ID 칸. */
const SOURCE: Record<
  AdChannel,
  Record<AdLevel, { collection: string; idField: string }>
> = {
  meta: {
    campaign: { collection: 'metaInsightDaily', idField: 'campaign_id' },
    adset: { collection: 'metaInsightDaily', idField: 'adset_id' },
  },
  google: {
    campaign: {
      collection: 'googleCampaignInsightDaily',
      idField: 'campaignId',
    },
    adset: { collection: 'googleAdGroupInsightDaily', idField: 'adGroupId' },
  },
  naver: {
    campaign: { collection: 'naverInsightDaily', idField: 'campaign_id' },
    adset: { collection: 'naverInsightDaily', idField: 'adgroup_id' },
  },
  openai: {
    campaign: { collection: 'openaiInsightDaily', idField: 'campaign_id' },
    adset: { collection: 'openaiInsightDaily', idField: 'adgroup_id' },
  },
}

/** Google 행을 Naver 행 모양으로 — 일별 합계·파생 지표 공식을 그대로 쓰려고
 * (Naver·OpenAI와 같은 계산: 광고비 = cost, 매출 = 전환 가치). */
const googleAsRow = (r: GoogleCampaignInsightRow): NaverInsightRow => ({
  campaign_id: r.campaignId,
  campaign_name: r.campaignName,
  adgroup_id: '',
  adgroup_name: '',
  impressions: r.impressions,
  clicks: r.clicks,
  spend: r.cost,
  conversions: r.conversions,
  revenue: r.conversionsValue,
  date_start: r.date,
})

/** 대상의 일별 성과(날짜 순) — 데이터가 있는 날만. 단위가 캠페인이면 그 아래
 * 광고셋 행을 날짜마다 더한다(Google은 캠페인 행이 따로 있다). */
export async function getAdEntityDaily(
  channel: AdChannel,
  level: AdLevel,
  platformId: string,
): Promise<DateSummary[]> {
  const { collection, idField } = SOURCE[channel][level]
  // ID 하나로만 거른다(자동 단일 필드 색인) — 날짜 범위까지 걸면 복합 색인이
  // 필요한데, 대상 하나의 행은 많아야 몇 천 개라 날짜는 화면이 고른다.
  const snap = await db
    .collection(collection)
    .where(idField, '==', platformId)
    .get()
  const rows = snap.docs.map((d) => d.data())
  if (channel === 'meta') return summarizeMetaByDate(rows as DataSetInsight[])
  if (channel === 'google') {
    return summarizeRowsByDate(
      (rows as GoogleCampaignInsightRow[]).map(googleAsRow),
    )
  }
  return summarizeRowsByDate(rows as NaverInsightRow[])
}
