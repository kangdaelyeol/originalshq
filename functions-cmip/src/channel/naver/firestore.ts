import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import type { NaverInsight, NaverInsightRow } from './types'

/** naverInsightDaily/{adgroup_id}_{date_start} — 문서 하나 = adgroup 하나의
 * 하루치 행(meta/firestore.ts의 MetaInsightDoc과 같은 이유로 upsert만으로
 * 충분 — 같은(adgroup, 날짜)를 다시 동기화하면 최신 값으로 덮어써지는 게
 * 맞다). 네이버는 계정(customerId)이 고정 상수 하나뿐이라(constants.ts)
 * Meta의 adAccountId 같은 태그가 필요 없다. */
export interface NaverInsightDoc extends NaverInsightRow {
  syncedAt: string
}

export const naverInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('naverInsightDaily')

const docId = (row: Pick<NaverInsightRow, 'adgroup_id' | 'date_start'>): string =>
  `${row.adgroup_id}_${row.date_start}`

const docToRow = (d: QueryDocumentSnapshot<DocumentData>): NaverInsightRow => {
  const x = d.data() as NaverInsightDoc
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

/** 새로 받아온 rows를 (adgroup_id, date_start) 기준으로 upsert한다 — 기존
 * 문서 삭제 없이 덮어쓰기만 하면 되는 이유는 위 NaverInsightDoc 주석 참고. */
export const upsertNaverInsightRows = async (
  rows: NaverInsight,
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = naverInsightCol()
  const writer = db.bulkWriter()
  const syncedAt = new Date().toISOString()
  for (const row of rows) {
    writer.set(col.doc(docId(row)), { ...row, syncedAt })
  }
  await writer.close()

  return { upserted: rows.length }
}

/** [startISO, endISO](포함) 구간의 인사이트 행 — date_start 기준 범위 쿼리.
 * summarizeNaverInsight(channel/naver/index.ts)에 그대로 넣을 수 있는
 * NaverInsight 모양으로 돌려준다. */
export const fetchNaverInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<NaverInsight> => {
  const snap = await naverInsightCol()
    .where('date_start', '>=', startISO)
    .where('date_start', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
