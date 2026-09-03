/**
 * CSV 적재 — Python `import_rows_batch` / `existing_conflict_keys` / `save_manual_smartstore`
 * 의 Firestore 버전.
 *
 * 절대 규칙 (과거 버그에서 나옴):
 *  - 배치 임포트는 배치 전체의 (채널+캠페인+날짜) 조합을 한 번만 삭제한 뒤 전체 삽입한다.
 *    파일별 delete-then-insert 를 루프하면 같은 배치의 다른 파일이 서로 지운다.
 *  - 삭제 범위는 '채널+날짜'가 아니라 '채널+캠페인+날짜'. 같은 네이버 채널의
 *    쇼핑검색광고와 애드부스트/GFA를 따로 임포트해도 서로 건드리지 않는다.
 *  - 균등배분 캠페인명의 ' [균등배분 …]' 접미사는 campaignName의 일부이며 삭제 키에도 그대로 쓴다
 *    (Python과 동일).
 */
import type {
  DocumentReference,
  DocumentData,
  Firestore,
} from 'firebase-admin/firestore'
import { parseDate } from '../utils'
import { perfCol, rowToPerfDoc } from './firestore'
import type { ParsedRow } from '../csv'
import {
  Channel,
  ConflictKey,
  ImportBatchItem,
  ImportBatchResult,
  ManualCommerceEntry,
} from '../types'

function keyOf(r: ParsedRow): string {
  return JSON.stringify([r.channel, r.campaign_name || '', r.date])
}

export const importRowsBatch = async (
  db: Firestore,
  brandId: string | number,
  resultsOrRows: ImportBatchItem[],
): Promise<ImportBatchResult> => {
  const rows: ParsedRow[] = []
  for (const item of resultsOrRows) {
    if (item && 'rows' in item && Array.isArray(item.rows))
      rows.push(...item.rows)
    else if (Array.isArray(item)) rows.push(...item)
    else if (item) rows.push(item as ParsedRow)
  }
  if (rows.length === 0) return { inserted: 0, deleted: 0 }

  // 1) 삭제 대상 조합 수집
  const keys = new Map<string, ParsedRow>()
  for (const r of rows) if (!keys.has(keyOf(r))) keys.set(keyOf(r), r)

  const col = perfCol(brandId)
  let deleted = 0
  const toDelete: DocumentReference<DocumentData>[] = []
  for (const r of keys.values()) {
    const snap = await col
      .where('channel', '==', r.channel)
      .where('campaignName', '==', r.campaign_name || '')
      .where('date', '==', r.date)
      .get()
    for (const d of snap.docs) toDelete.push(d.ref)
    deleted += snap.size
  }

  // 2) 삭제 + 삽입 (BulkWriter — 500 배치 자동 처리)
  const writer = db.bulkWriter()
  for (const ref of toDelete) writer.delete(ref)
  for (const r of rows) writer.create(col.doc(), rowToPerfDoc(brandId, r))
  await writer.close()

  return { inserted: rows.length, deleted }
}

/** 덮어쓰기 확인용 — (채널+캠페인+날짜) 단위로 이미 DB에 있는 조합. */
export const existingConflictKeys = async (
  db: Firestore,
  brandId: string | number,
  rows: ParsedRow[] | null | undefined,
): Promise<ConflictKey[]> => {
  if (!rows || rows.length === 0) return []
  const col = perfCol(brandId)
  const seen = new Set<string>()
  const found: ConflictKey[] = []
  for (const r of rows) {
    const k = keyOf(r)
    if (seen.has(k)) continue
    seen.add(k)
    const snap = await col
      .where('channel', '==', r.channel)
      .where('campaignName', '==', r.campaign_name || '')
      .where('date', '==', r.date)
      .limit(1)
      .get()
    if (!snap.empty) found.push([r.channel, r.campaign_name || '', r.date])
  }
  return found
}

/** 스마트스토어 등 커머스 채널 매출·구매건 수기입력. */
export const saveManualSmartstore = async (
  db: Firestore,
  brandId: string | number,
  entries: ManualCommerceEntry[],
  channel: Channel = 'smartstore',
): Promise<ImportBatchResult> => {
  const rows: ParsedRow[] = []
  for (const e of entries) {
    const d = parseDate(e.date)
    if (!d) continue
    rows.push({
      date: d,
      channel,
      campaign_name: '수기입력',
      adgroup_name: '',
      keyword: '',
      impressions: 0,
      clicks: 0,
      cost: 0, // 광고비는 넣지 않는다. 실제 광고비는 매체 CSV 합계로 집계.
      conversion: Number(e.orders) || 0,
      conv_indirect: 0,
      conv_purchase: 0,
      revenue: Number(e.revenue) || 0,
      result_type: null,
    })
  }
  return importRowsBatch(db, brandId, rows)
}
