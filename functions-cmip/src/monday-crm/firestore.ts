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
  isInstallmentInterest: boolean
  isDeferredBalance: boolean
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
    isInstallmentInterest: x.isInstallmentInterest,
    isDeferredBalance: x.isDeferredBalance,
  }
}

/** Monday에서 새로 받아온 rows로 offlineSales 컬렉션을 똑같이 맞춘다 — 새
 * rows는 전부 쓰고(set), 새 rows에 없는 기존 문서(Monday에서 지워진 항목)만
 * 지운다.
 *
 * 예전에는 기존 문서를 전부 지우고 다시 채웠는데, 같은 문서 id에 delete와
 * set을 한 bulkWriter에 함께 넣으면 실행 순서가 보장되지 않는다 — set이
 * 먼저 끝나고 delete가 나중에 실행된 문서는 통째로 사라졌다(10/21 발견: 매
 * 동기화마다 다른 결제 줄이 무작위로 빠져 8월 −4,310만·10월 −1억 9,440만이
 * 비었다). 이제 지우는 문서와 쓰는 문서가 겹치지 않아 순서와 무관하다. */
export const resyncOfflineSales = async (
  rows: OfflineSaleRow[],
): Promise<{ inserted: number; deleted: number }> => {
  const col = offlineSalesCol()
  const existingRefs = await col.listDocuments()
  const nextIds = new Set(rows.map((row) => row.mondaySubitemId))
  const staleRefs = existingRefs.filter((ref) => !nextIds.has(ref.id))

  const writer = db.bulkWriter()
  for (const row of rows) {
    writer.set(col.doc(row.mondaySubitemId), rowToDoc(row))
  }
  for (const ref of staleRefs) writer.delete(ref)
  await writer.close()

  return { inserted: rows.length, deleted: staleRefs.length }
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
