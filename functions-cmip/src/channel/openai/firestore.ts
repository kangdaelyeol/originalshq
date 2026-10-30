import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import type { OpenaiInsight, OpenaiInsightRow } from './types'

/** openaiInsightDaily/{adgroup_id}_{date_start} — 문서 하나 = 광고그룹 하나의
 * 하루치 행(naver/firestore.ts와 같은 이유로 upsert만으로 충분). 광고 계정은
 * API 키 하나에 묶인 하나뿐이라 계정 태그가 필요 없다. */
export interface OpenaiInsightDoc extends OpenaiInsightRow {
  syncedAt: string
}

export const openaiInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('openaiInsightDaily')

const docId = (row: Pick<OpenaiInsightRow, 'adgroup_id' | 'date_start'>): string =>
  `${row.adgroup_id}_${row.date_start}`

const docToRow = (d: QueryDocumentSnapshot<DocumentData>): OpenaiInsightRow => {
  const x = d.data() as OpenaiInsightDoc
  return {
    campaign_id: x.campaign_id,
    campaign_name: x.campaign_name,
    adgroup_id: x.adgroup_id,
    adgroup_name: x.adgroup_name,
    impressions: x.impressions,
    clicks: x.clicks,
    spend: x.spend,
    conversions: x.conversions,
    revenue: x.revenue,
    date_start: x.date_start,
  }
}

export const upsertOpenaiInsightRows = async (
  rows: OpenaiInsight,
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = openaiInsightCol()
  const writer = db.bulkWriter()
  const syncedAt = new Date().toISOString()
  for (const row of rows) {
    writer.set(col.doc(docId(row)), { ...row, syncedAt })
  }
  await writer.close()

  return { upserted: rows.length }
}

/** [startISO, endISO](포함) 구간의 인사이트 행 — date_start 기준 범위 쿼리. */
export const fetchOpenaiInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<OpenaiInsight> => {
  const snap = await openaiInsightCol()
    .where('date_start', '>=', startISO)
    .where('date_start', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
