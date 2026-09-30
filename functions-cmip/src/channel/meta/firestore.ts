import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../../data'
import type { DataSetInsight } from './types'

/** metaInsightDaily/{adset_id}_{date_start} — 문서 하나 = adset 하나의 하루치
 * 행(cafe24Orders와 같은 이유로 upsert만으로 충분: Meta 인사이트는 같은
 * (adset, 날짜)를 다시 조회하면 최신 값으로 그대로 덮어써지는 게 맞다 —
 * 어트리뷰션 갱신으로 지표가 바뀌어도 삭제 후 재생성이 아니라 값만
 * 바뀌기 때문). adset_id는 캠페인/adset이 삭제되지 않는 한 안 바뀌고
 * 광고계정 전체에서 유일해서, adAccountId 없이 이 두 값만으로 문서 ID를
 * 만들어도 충돌하지 않는다 — adAccountId는 참고용으로 본문에만 넣는다. */
export interface MetaInsightDoc extends DataSetInsight {
  adAccountId: string
  syncedAt: string
}

export const metaInsightCol = (): CollectionReference<DocumentData> =>
  db.collection('metaInsightDaily')

const docId = (row: Pick<DataSetInsight, 'adset_id' | 'date_start'>): string =>
  `${row.adset_id}_${row.date_start}`

const rowToDoc = (
  row: DataSetInsight & { adAccountId: string },
): MetaInsightDoc => ({
  ...row,
  syncedAt: new Date().toISOString(),
})

const docToRow = (
  d: QueryDocumentSnapshot<DocumentData>,
): DataSetInsight => {
  const x = d.data() as MetaInsightDoc
  return {
    campaign_id: x.campaign_id,
    campaign_name: x.campaign_name,
    adset_id: x.adset_id,
    adset_name: x.adset_name,
    impressions: x.impressions,
    inline_link_clicks: x.inline_link_clicks,
    spend: x.spend,
    reach: x.reach,
    results: x.results,
    action_values: x.action_values,
    date_start: x.date_start,
    date_stop: x.date_stop,
  }
}

/** 새로 받아온 rows를 (adset_id, date_start) 기준으로 upsert한다 — 기존 문서
 * 삭제 없이 덮어쓰기만 하면 되는 이유는 위 MetaInsightDoc 주석 참고. */
export const upsertMetaInsightRows = async (
  rows: readonly (DataSetInsight & { adAccountId: string })[],
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = metaInsightCol()
  const writer = db.bulkWriter()
  for (const row of rows) {
    writer.set(col.doc(docId(row)), rowToDoc(row))
  }
  await writer.close()

  return { upserted: rows.length }
}

/** [startISO, endISO](포함) 구간의 인사이트 행 — date_start 기준 범위 쿼리.
 * summarizeMetaInsight(channel/meta/index.ts)에 그대로 넣을 수 있는
 * DataSetInsight[] 모양으로 돌려준다. */
export const fetchMetaInsightRowsFromDb = async (
  startISO: string,
  endISO: string,
): Promise<DataSetInsight[]> => {
  const snap = await metaInsightCol()
    .where('date_start', '>=', startISO)
    .where('date_start', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
