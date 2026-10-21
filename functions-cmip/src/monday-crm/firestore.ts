import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore'
import { db } from '../data'
import type { ISODate } from '../types'
import type { OfflineSaleRow } from './types'

/** offlineSales/{mondaySubitemId} — functions-xtool(monday/firestore.ts의
 * replaceOfflineSales)이 쓰고 여기서는 읽기만 한다. 문서 모양이 두
 * 코드베이스 사이의 계약이라, 바꾸면 xtool의 MondayOfflineSaleLine도 같이
 * 바꿔야 한다. */
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
  syncedAt: Timestamp
}

export const offlineSalesCol = (): CollectionReference<DocumentData> =>
  db.collection('offlineSales')

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
