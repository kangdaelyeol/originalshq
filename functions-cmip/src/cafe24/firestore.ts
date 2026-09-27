import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../data'
import type { ISODate } from '../types'
import type { Cafe24OrderRow } from './types'

/** cafe24Orders/{orderId} — 문서 id를 주문번호로 고정해서 재동기화가 항상
 * upsert(덮어쓰기)만으로 충분하다. Monday CRM(보드 전체를 통째로 지우고
 * 다시 넣음)과 달리 주문은 한 번 생성되면 사라지지 않고 상태만 바뀌므로
 * (결제완료→취소 등) 삭제가 필요 없다 — 같은 order_id로 다시 upsert하면
 * 최신 상태로 덮어써진다. */
export interface Cafe24OrderDoc {
  orderId: string
  orderDate: ISODate
  memberId: string | null
  paid: boolean
  canceled: boolean
  paymentAmount: number
  syncedAt: string
}

export const cafe24OrdersCol = (): CollectionReference<DocumentData> =>
  db.collection('cafe24Orders')

const rowToDoc = (row: Cafe24OrderRow): Cafe24OrderDoc => ({
  ...row,
  syncedAt: new Date().toISOString(),
})

const docToRow = (d: QueryDocumentSnapshot<DocumentData>): Cafe24OrderRow => {
  const x = d.data() as Cafe24OrderDoc
  return {
    orderId: x.orderId,
    orderDate: x.orderDate,
    memberId: x.memberId,
    paid: x.paid,
    canceled: x.canceled,
    paymentAmount: x.paymentAmount,
  }
}

/** 새로 받아온 rows를 order_id 기준으로 upsert한다 — 기존 문서 삭제 없이
 * 그대로 덮어쓰기만 하면 되는 이유는 위 Cafe24OrderDoc 주석 참고. */
export const upsertCafe24Orders = async (
  rows: Cafe24OrderRow[],
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = cafe24OrdersCol()
  const writer = db.bulkWriter()
  for (const row of rows) {
    writer.set(col.doc(row.orderId), rowToDoc(row))
  }
  await writer.close()

  return { upserted: rows.length }
}

/** [startISO, endISO](포함) 구간의 주문 행. 한 번에 읽어와 메모리 집계용
 * (monday-crm의 fetchOfflineSaleRows와 같은 관례) — orderDate 한 필드에 대한
 * 범위 쿼리라 별도 복합 인덱스는 필요 없다. */
export const fetchCafe24OrderRowsFromDb = async (
  startISO: ISODate,
  endISO: ISODate,
): Promise<Cafe24OrderRow[]> => {
  const snap = await cafe24OrdersCol()
    .where('orderDate', '>=', startISO)
    .where('orderDate', '<=', endISO)
    .get()
  return snap.docs.map(docToRow)
}
