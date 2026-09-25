import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore'
import { db, FieldValue } from '../data'
import type { ISODate } from '../types'
import type { OfflineSaleRow } from './types'

/** offlineSales/{mondaySubitemId} — Monday 보드가 하나로 고정돼 있어(브랜드별
 * 확장 필요 전까지는) brands/{brandId} 아래가 아니라 최상위 컬렉션에 둔다.
 * 문서 id를 mondaySubitemId로 고정해서, 재동기화 때 델타 계산 없이 통째로
 * 지우고 다시 넣어도(resyncOfflineSales) 같은 subitem은 항상 같은 문서가 된다. */
export interface OfflineSaleDoc {
  mondayItemId: string
  mondaySubitemId: string
  date: ISODate
  customerName: string
  productName: string
  revenue: number
  discount: number
  totalPaid: number
  syncedAt: Timestamp | FieldValue
}

export const offlineSalesCol = (): CollectionReference<DocumentData> =>
  db.collection('offlineSales')

const rowToDoc = (row: OfflineSaleRow): OfflineSaleDoc => ({
  ...row,
  syncedAt: FieldValue.serverTimestamp(),
})

const docToRow = (d: QueryDocumentSnapshot<DocumentData>): OfflineSaleRow => {
  const x = d.data() as OfflineSaleDoc
  return {
    mondayItemId: x.mondayItemId,
    mondaySubitemId: x.mondaySubitemId,
    date: x.date,
    customerName: x.customerName,
    productName: x.productName,
    revenue: x.revenue,
    discount: x.discount,
    totalPaid: x.totalPaid,
  }
}

/** Monday에서 새로 받아온 rows로 offlineSales 컬렉션을 통째로 바꿔친다 —
 * 기존 문서를 전부 지우고 다시 채우는 전체 재동기화 방식이다(부분 delta
 * 동기화 아님). Monday 쪽에서 지워진 항목도 이래야 같이 지워진다. 같은
 * subitem은 문서 id가 같아 delete→set이 같은 경로에 순서대로 걸리지만,
 * bulkWriter가 그 순서를 보장하지 않을 가능성까지 고려해 create가 아니라
 * set을 쓴다(이미 지워졌든 아니든 최종 상태만 맞으면 된다). */
export const resyncOfflineSales = async (
  rows: OfflineSaleRow[],
): Promise<{ inserted: number; deleted: number }> => {
  const col = offlineSalesCol()
  const existingRefs = await col.listDocuments()

  const writer = db.bulkWriter()
  for (const ref of existingRefs) writer.delete(ref)
  for (const row of rows) {
    writer.set(col.doc(row.mondaySubitemId), rowToDoc(row))
  }
  await writer.close()

  return { inserted: rows.length, deleted: existingRefs.length }
}

/** [startISO, endISO](포함) 구간의 오프라인 매출 행. 한 번에 읽어와 메모리
 * 집계용(fetchPerfRows와 같은 관례) — date 한 필드에 대한 범위 쿼리라
 * 별도 복합 인덱스는 필요 없다. */
export const fetchOfflineSaleRows = async (
  startISO: ISODate,
  endISO: ISODate,
): Promise<OfflineSaleRow[]> => {
  const snap = await offlineSalesCol()
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
