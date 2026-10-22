// Meta 광고(소재) 단위 인사이트 — "광고 성과" 탭용.
//
// Monday 상담의 utm_campaign에는 Meta 캠페인·광고셋이 아니라 광고 이름이
// 들어 있다(예: "260108_F2Ultra_vd_재료의한계를뛰어넘는…"). 그래서 기존
// metaInsightDaily(광고셋 단위)만으로는 utm을 광고셋에 이을 수 없어, 광고
// 단위로 따로 받아 "광고 이름 → 광고셋 → 캠페인" 연결과 광고별 광고비를 둔다.
import type {
  CollectionReference,
  DocumentData,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import { fetchAllInsightPages } from './client'
import { META_AD_ACCOUNT_IDS } from './index'

/** Graph API 광고 단위 행(하루치). 숫자 필드는 문자열로 온다. */
export interface MetaAdRow {
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  ad_id: string
  ad_name: string
  spend: string | number
  impressions: string | number
  inline_link_clicks?: string | number
  date_start: string
}

/** metaAdInsightDaily/{ad_id}_{date_start} — 광고 하나의 하루치. 광고셋
 * 단위(metaInsightDaily)와 같은 이유로 upsert만 한다. */
interface MetaAdDoc {
  adAccountId: string
  campaignId: string
  campaignName: string
  adsetId: string
  adsetName: string
  adId: string
  adName: string
  date: string
  spend: number
  impressions: number
  clicks: number
  syncedAt: string
}

/** 화면에 주는 모양 — 광고 정보는 한 번만, 날짜별 값은 [광고 순번, 날짜,
 * 광고비, 노출, 클릭]으로 줄여서 보낸다(광고 × 날짜라 행이 많다). */
export interface MetaAdInsights {
  ads: {
    id: string
    name: string
    adsetId: string
    adsetName: string
    campaignId: string
    campaignName: string
  }[]
  daily: [number, string, number, number, number][]
}

const metaAdCol = (): CollectionReference<DocumentData> =>
  db.collection('metaAdInsightDaily')

const getAdFetchUrl = (
  dateStart: string,
  dateEnd: string,
  adsId: string,
  accessToken: string,
): string => {
  const params = new URLSearchParams({
    fields:
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,inline_link_clicks,date_start',
    time_increment: '1',
    level: 'ad',
    access_token: accessToken,
    time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
    limit: '5000',
  })
  return `https://graph.facebook.com/v25.0/act_${adsId}/insights?${params.toString()}`
}

const toDoc = (row: MetaAdRow, adAccountId: string): MetaAdDoc => ({
  adAccountId,
  campaignId: row.campaign_id,
  campaignName: row.campaign_name,
  adsetId: row.adset_id,
  adsetName: row.adset_name,
  adId: row.ad_id,
  adName: row.ad_name,
  date: row.date_start,
  spend: Number(row.spend) || 0,
  impressions: Number(row.impressions) || 0,
  clicks: Number(row.inline_link_clicks) || 0,
  syncedAt: new Date().toISOString(),
})

/** 두 광고계정의 광고 단위 인사이트를 받아 Firestore에 upsert한다 — 수동
 * 백필(syncMetaAdInsights)과 예약 동기화가 같이 쓴다. */
export const syncMetaAdRows = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<{ upserted: number; ads: number }> => {
  const byAccount = await Promise.all(
    META_AD_ACCOUNT_IDS.map(async (adAccountId) => ({
      adAccountId,
      rows: await fetchAllInsightPages<MetaAdRow>(
        getAdFetchUrl(dateStart, dateEnd, adAccountId, accessToken),
        adAccountId,
      ),
    })),
  )
  const docs = byAccount.flatMap(({ adAccountId, rows }) =>
    rows.map((row) => toDoc(row, adAccountId)),
  )
  const writer = db.bulkWriter()
  for (const doc of docs) {
    writer.set(metaAdCol().doc(`${doc.adId}_${doc.date}`), doc)
  }
  await writer.close()
  return {
    upserted: docs.length,
    ads: new Set(docs.map((doc) => doc.adId)).size,
  }
}

/** [dateStart, dateEnd] 구간의 광고 단위 값을 화면용 모양으로. 광고·광고셋·
 * 캠페인 이름은 바뀔 수 있어서 구간 안의 가장 최근 날짜 값을 쓴다. 광고비·
 * 노출·클릭이 모두 0인 날은 뺀다. */
export const readMetaAdInsights = async (
  dateStart: string,
  dateEnd: string,
): Promise<MetaAdInsights> => {
  const snapshot = await metaAdCol()
    .where('date', '>=', dateStart)
    .where('date', '<=', dateEnd)
    .get()
  const docs = snapshot.docs
    .map((doc) => doc.data() as MetaAdDoc)
    .sort((a, b) => a.date.localeCompare(b.date))

  const latest = new Map<string, MetaAdDoc>()
  for (const doc of docs) latest.set(doc.adId, doc)
  const ads = [...latest.values()].map((doc) => ({
    id: doc.adId,
    name: doc.adName,
    adsetId: doc.adsetId,
    adsetName: doc.adsetName,
    campaignId: doc.campaignId,
    campaignName: doc.campaignName,
  }))
  const index = new Map(ads.map((ad, i) => [ad.id, i]))

  const daily: MetaAdInsights['daily'] = docs
    .filter((doc) => doc.spend > 0 || doc.impressions > 0 || doc.clicks > 0)
    .map((doc) => [
      index.get(doc.adId) as number,
      doc.date,
      doc.spend,
      doc.impressions,
      doc.clicks,
    ])
  return { ads, daily }
}
