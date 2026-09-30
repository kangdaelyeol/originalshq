import type {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { db } from '../data'
import type { ISODate } from '../types'
import type { Cafe24OrderRow, Cafe24RefundRow } from './types'

/** cafe24Orders/{orderId} — 문서 id를 주문번호로 고정해서 재동기화가 항상
 * upsert(덮어쓰기)만으로 충분하다. Monday CRM(보드 전체를 통째로 지우고
 * 다시 넣음)과 달리 주문은 한 번 생성되면 사라지지 않고 상태만 바뀌므로
 * (결제완료→취소 등) 삭제가 필요 없다 — 같은 order_id로 다시 upsert하면
 * 최신 상태로 덮어써진다. 취소/환불은 여기 안 담고 cafe24Refunds에 따로
 * 담는다(types.ts의 Cafe24OrderRow 주석 참고). */
export interface Cafe24OrderDoc {
  orderId: string
  orderDate: ISODate
  paymentDate: ISODate | null
  cancelDate: ISODate | null
  memberId: string | null
  paid: boolean
  grossPayment: number
  shippingFee: number
  pointsSpent: number
  couponDiscount: number
  itemDiscount: number
  additionalShippingFee: number
  cancelRefundAmount: number
  cancelPointsRefund: number
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
    paymentDate: x.paymentDate ?? null,
    cancelDate: x.cancelDate ?? null,
    memberId: x.memberId,
    paid: x.paid,
    grossPayment: x.grossPayment,
    shippingFee: x.shippingFee,
    pointsSpent: x.pointsSpent,
    couponDiscount: x.couponDiscount ?? 0,
    itemDiscount: x.itemDiscount ?? 0,
    additionalShippingFee: x.additionalShippingFee ?? 0,
    cancelRefundAmount: x.cancelRefundAmount ?? 0,
    cancelPointsRefund: x.cancelPointsRefund ?? 0,
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

/** [startISO, endISO](포함) 구간과 관련된 주문 행. paymentDate 또는
 * cancelDate가 그 구간에 걸리는 행을 전부 가져온다 — grossPayment는
 * paymentDate로, additionalShippingFee는 cancelDate로 귀속되는데(반품
 * 접수가 결제한 달과 다른 달일 수 있음) 이 둘이 서로 다른 달일 수 있어서다
 * (types.ts의 Cafe24OrderRow 주석 참고). Firestore가 서로 다른 필드로 OR
 * 쿼리를 지원하지 않아 두 쿼리를 따로 날리고 orderId로 합친다. helper.ts가
 * 이 합쳐진 행 집합을 받아 grossPayment/additionalShippingFee를 각각 다시
 * range 안에서만 걸러 그룹핑한다. */
export const fetchCafe24OrderRowsFromDb = async (
  startISO: ISODate,
  endISO: ISODate,
): Promise<Cafe24OrderRow[]> => {
  const col = cafe24OrdersCol()
  const [byPaymentDateSnap, byCancelDateSnap] = await Promise.all([
    col
      .where('paymentDate', '>=', startISO)
      .where('paymentDate', '<=', endISO)
      .get(),
    col
      .where('cancelDate', '>=', startISO)
      .where('cancelDate', '<=', endISO)
      .get(),
  ])

  const rowsById = new Map<string, Cafe24OrderRow>()
  for (const d of byPaymentDateSnap.docs) rowsById.set(d.id, docToRow(d))
  for (const d of byCancelDateSnap.docs) rowsById.set(d.id, docToRow(d))
  return Array.from(rowsById.values())
}

/** cafe24Refunds/{refundCode} — 환불 이벤트 하나가 문서 하나. 같은 주문이
 * 여러 번 환불되면(8/31 조사에서 발견한 사례) refund_code가 각각 달라
 * 문서도 따로 생긴다. 환불 이벤트는 완료되면 상태가 안 바뀌므로 주문과
 * 마찬가지로 upsert만으로 충분하다. */
export interface Cafe24RefundDoc {
  refundCode: string
  orderId: string
  refundDate: ISODate
  amount: number
  pointsRefunded: number
  isFallback: boolean
  syncedAt: string
}

export const cafe24RefundsCol = (): CollectionReference<DocumentData> =>
  db.collection('cafe24Refunds')

const refundRowToDoc = (row: Cafe24RefundRow): Cafe24RefundDoc => ({
  ...row,
  syncedAt: new Date().toISOString(),
})

const docToRefundRow = (
  d: QueryDocumentSnapshot<DocumentData>,
): Cafe24RefundRow => {
  const x = d.data() as Cafe24RefundDoc
  return {
    refundCode: x.refundCode,
    orderId: x.orderId,
    refundDate: x.refundDate,
    amount: x.amount,
    pointsRefunded: x.pointsRefunded ?? 0,
    // isFallback 필드 추가 전에 upsert된 문서엔 이 필드가 없다 — refundCode가
    // "ORDER-{orderId}" 형태인 건 전부 index.ts의 buildFallbackRefunds가 만든
    // 합성 문서였으므로(실제 카페24 환불은 항상 "C..." 형태), 그 패턴으로
    // 재동기화 없이도 기존 데이터를 안전하게 구분한다.
    isFallback: x.isFallback ?? x.refundCode.startsWith('ORDER-'),
  }
}

export const upsertCafe24Refunds = async (
  rows: Cafe24RefundRow[],
): Promise<{ upserted: number }> => {
  if (rows.length === 0) return { upserted: 0 }

  const col = cafe24RefundsCol()
  const writer = db.bulkWriter()
  for (const row of rows) {
    writer.set(col.doc(row.refundCode), refundRowToDoc(row))
  }
  await writer.close()

  return { upserted: rows.length }
}

/** refundCode 목록으로 cafe24Refunds 문서를 지운다 — index.ts의
 * buildFallbackRefundRows가 만드는 `ORDER-{orderId}` 합성 문서 전용 정리용.
 * 실제 카페24 환불(refund_code, "C..." 형태)은 이 함수로 지울 일이 없다 —
 * 합성 문서만 우리 로직(예: paid 필터) 변경에 따라 더 이상 조건을 만족하지
 * 않게 될 수 있는데, upsert만으로는 예전에 잘못 만들어둔 문서가 안 지워지고
 * 남는다(8월 월간 집계 검증 중 발견: 미결제 취소 주문의 유령 환불 문서가
 * paid 필터 추가 후에도 재동기화만으로는 안 없어졌다). */
export const deleteCafe24Refunds = async (
  refundCodes: readonly string[],
): Promise<{ deleted: number }> => {
  if (refundCodes.length === 0) return { deleted: 0 }

  const col = cafe24RefundsCol()
  const writer = db.bulkWriter()
  for (const code of refundCodes) {
    writer.delete(col.doc(code))
  }
  await writer.close()

  return { deleted: refundCodes.length }
}

/** [startISO, endISO](포함) 구간에 완료 처리된 환불 행 — refundDate 한
 * 필드에 대한 범위 쿼리. */
export const fetchCafe24RefundRowsFromDb = async (
  startISO: ISODate,
  endISO: ISODate,
): Promise<Cafe24RefundRow[]> => {
  const snap = await cafe24RefundsCol()
    .where('refundDate', '>=', startISO)
    .where('refundDate', '<=', endISO)
    .get()
  return snap.docs.map(docToRefundRow)
}
