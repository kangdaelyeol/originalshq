import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import type { GoogleAdGroupInsightRow, GoogleCampaignInsightRow } from './types'

/** googleCampaignInsightDaily/{customerId}_{campaignId}_{date} —
 * 문서 하나 = 캠페인 하루치 행(meta/firestore.ts의 MetaInsightDoc과 같은
 * 이유로 upsert만으로 충분: 같은(customerId, campaignId, 날짜)를 다시
 * 동기화하면 최신 값으로 덮어써지는 게 맞다 — 어트리뷰션 갱신으로 지표가
 * 바뀌어도 값만 바뀌지 문서 자체가 사라지지 않는다). */
export interface GoogleCampaignInsightDoc extends GoogleCampaignInsightRow {
  customerId: string
  syncedAt: string
}

/** googleAdGroupInsightDaily/{customerId}_{adGroupId}_{date} — 동일 패턴,
 * adGroup(adset) 리소스는 캠페인과 별도 GAQL 쿼리라(client.ts 참고) 컬렉션도
 * 분리한다(Cafe24의 orders/refunds 분리와 같은 이유). */
export interface GoogleAdGroupInsightDoc extends GoogleAdGroupInsightRow {
  customerId: string
  syncedAt: string
}

export const googleCampaignInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('googleCampaignInsightDaily')

export const googleAdGroupInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('googleAdGroupInsightDaily')

const campaignDocId = (
  row: Pick<GoogleCampaignInsightRow, 'campaignId' | 'date'> & {
    customerId: string
  },
): string => `${row.customerId}_${row.campaignId}_${row.date}`

const adGroupDocId = (
  row: Pick<GoogleAdGroupInsightRow, 'adGroupId' | 'date'> & {
    customerId: string
  },
): string => `${row.customerId}_${row.adGroupId}_${row.date}`

/** 새로 받아온 캠페인 rows를 (customerId, campaignId, date) 기준으로
 * upsert한다 — 기존 문서 삭제 없이 덮어쓰기만 하면 되는 이유는 위
 * GoogleCampaignInsightDoc 주석 참고. */
export const upsertGoogleCampaignInsightRows = async (
  rows: readonly (GoogleCampaignInsightRow & { customerId: string })[],
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = googleCampaignInsightCol()
  const writer = db.bulkWriter()
  const syncedAt = new Date().toISOString()
  for (const row of rows) {
    writer.set(col.doc(campaignDocId(row)), { ...row, syncedAt })
  }
  await writer.close()

  return { upserted: rows.length }
}

export const upsertGoogleAdGroupInsightRows = async (
  rows: readonly (GoogleAdGroupInsightRow & { customerId: string })[],
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = googleAdGroupInsightCol()
  const writer = db.bulkWriter()
  const syncedAt = new Date().toISOString()
  for (const row of rows) {
    writer.set(col.doc(adGroupDocId(row)), { ...row, syncedAt })
  }
  await writer.close()

  return { upserted: rows.length }
}

const docToCampaignRow = (
  d: QueryDocumentSnapshot<DocumentData>,
): GoogleCampaignInsightRow => {
  const x = d.data() as GoogleCampaignInsightDoc
  return {
    date: x.date,
    campaignId: x.campaignId,
    campaignName: x.campaignName,
    costMicros: x.costMicros,
    cost: x.cost,
    impressions: x.impressions,
    clicks: x.clicks,
    conversions: x.conversions,
    conversionsValue: x.conversionsValue,
    ctr: x.ctr,
    cpc: x.cpc,
    cpa: x.cpa,
    cvr: x.cvr,
    cpm: x.cpm,
    frequency: x.frequency,
  }
}

const docToAdGroupRow = (
  d: QueryDocumentSnapshot<DocumentData>,
): GoogleAdGroupInsightRow => {
  const x = d.data() as GoogleAdGroupInsightDoc
  return {
    ...docToCampaignRow(d),
    adGroupId: x.adGroupId,
    adGroupName: x.adGroupName,
  }
}

/** [startISO, endISO](포함) 구간의 캠페인 인사이트 행 — date 기준 범위
 * 쿼리. DB에는 이 계정 데이터만 있어(단일 계정 전제, channel/google/index.ts
 * 주석 참고) customerId 필터는 걸지 않는다(meta/firestore.ts와 동일 이유). */
export const fetchGoogleCampaignInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<GoogleCampaignInsightRow[]> => {
  const snap = await googleCampaignInsightCol()
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
    .get()
  return snap.docs.map(docToCampaignRow)
}

export const fetchGoogleAdGroupInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<GoogleAdGroupInsightRow[]> => {
  const snap = await googleAdGroupInsightCol()
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
    .get()
  return snap.docs.map(docToAdGroupRow)
}
