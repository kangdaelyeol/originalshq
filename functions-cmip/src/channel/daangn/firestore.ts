import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import type { DaangnInsight, DaangnInsightRow } from './types'

/** daangnInsightDaily/{adgroup_id}_{date_start} — 문서 하나 = 광고그룹 하나의
 * 하루치 행(openai/firestore.ts와 같은 이유로 upsert만으로 충분). 광고 계정은
 * 키 하나에 묶인 하나뿐이라 계정 태그가 필요 없다. */
export interface DaangnInsightDoc extends DaangnInsightRow {
  syncedAt: string
}

export const daangnInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('daangnInsightDaily')

const docId = (
  row: Pick<DaangnInsightRow, 'adgroup_id' | 'date_start'>,
): string => `${row.adgroup_id}_${row.date_start}`

const docToRow = (d: QueryDocumentSnapshot<DocumentData>): DaangnInsightRow => {
  const x = d.data() as DaangnInsightDoc
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
    reach: x.reach,
    events: x.events,
  }
}

export const upsertDaangnInsightRows = async (
  rows: DaangnInsight,
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = daangnInsightCol()
  const writer = db.bulkWriter()
  const syncedAt = new Date().toISOString()
  for (const row of rows) {
    writer.set(col.doc(docId(row)), { ...row, syncedAt })
  }
  await writer.close()

  return { upserted: rows.length }
}

/** [startISO, endISO](포함) 구간의 인사이트 행 — date_start 기준 범위 쿼리. */
export const fetchDaangnInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<DaangnInsight> => {
  const snap = await daangnInsightCol()
    .where('date_start', '>=', startISO)
    .where('date_start', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
