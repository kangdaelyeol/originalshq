import type { CollectionReference, DocumentData } from 'firebase-admin/firestore'
import { db } from '../data'
import type { ISODate } from '../types'
import type { Cafe24RefundRow } from './types'

/** cafe24Adjustments/{id} — 관리자가 손으로 넣는 환불 보정 1건.
 *
 * 카페24 API로는 알 수 없는 환불 변동을 채우는 용도다. 10/8 조사에서 발견:
 * 취소 처리 후 실제 환불 없이 취소가 철회된 주문(20260821-0000039)은 카페24
 * 관리자 "일별 매출내역"엔 취소일에 환불 +, 철회일에 환불 −로 잡히는데, API
 * 에는 주문·환불 어느 리소스에도 흔적이 없다 — 자동으로는 맞출 방법이 없어서
 * 날짜와 금액을 직접 등록하게 한다.
 *
 * amount는 "환불 금액"에 더할 값이다: 양수면 그 날 환불이 늘고(순매출 감소),
 * 음수면 환불이 줄어든다(순매출 증가). 동기화(syncCafe24Orders)는 이
 * 컬렉션을 건드리지 않는다 — 지우기 전까지 계속 반영된다. */
export interface Cafe24AdjustmentDoc {
  date: ISODate
  amount: number
  /** 어느 주문 때문에 넣은 보정인지(선택) — 나중에 왜 있는지 찾아보기 위한 메모용. */
  orderId: string
  memo: string
  createdAt: number
}

export interface Cafe24Adjustment extends Cafe24AdjustmentDoc {
  id: string
}

export type Cafe24AdjustmentInput = Pick<
  Cafe24AdjustmentDoc,
  'date' | 'amount' | 'orderId' | 'memo'
>

const adjustmentsCol = (): CollectionReference<DocumentData> =>
  db.collection('cafe24Adjustments')

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function validateCafe24AdjustmentInput(
  body: unknown,
): { ok: true; data: Cafe24AdjustmentInput } | { ok: false; error: string } {
  const { date, amount, orderId, memo } = (body ?? {}) as Record<
    string,
    unknown
  >
  if (
    typeof date !== 'string' ||
    !ISO_DATE.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
  ) {
    return { ok: false, error: 'date는 YYYY-MM-DD 형식이어야 합니다' }
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: 'amount는 0이 아닌 숫자여야 합니다' }
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, error: 'amount는 원 단위 정수여야 합니다' }
  }
  if (orderId !== undefined && typeof orderId !== 'string') {
    return { ok: false, error: 'orderId는 문자열이어야 합니다' }
  }
  // 사유 없이 금액만 남으면 나중에 이 보정이 왜 있는지 아무도 모른다.
  if (typeof memo !== 'string' || memo.trim() === '') {
    return { ok: false, error: 'memo(사유)는 필수입니다' }
  }
  return {
    ok: true,
    data: {
      date,
      amount,
      orderId: (orderId ?? '').trim(),
      memo: memo.trim(),
    },
  }
}

export async function listCafe24Adjustments(): Promise<Cafe24Adjustment[]> {
  const snap = await adjustmentsCol().get()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Cafe24AdjustmentDoc) }))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    )
}

export async function createCafe24Adjustment(
  input: Cafe24AdjustmentInput,
): Promise<Cafe24Adjustment> {
  const doc: Cafe24AdjustmentDoc = { ...input, createdAt: Date.now() }
  const ref = await adjustmentsCol().add(doc)
  return { id: ref.id, ...doc }
}

/** 없는 id면 false — 호출부가 404로 돌려준다. */
export async function deleteCafe24Adjustment(id: string): Promise<boolean> {
  const ref = adjustmentsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

/** [startISO, endISO](포함) 구간의 보정을 환불 행 모양으로 돌려준다 —
 * helper.ts의 집계가 refundDate 기준 그룹핑을 그대로 재사용할 수 있게
 * Cafe24RefundRow로 맞춘다(isAdjustment로 실제 환불과 구분). */
export async function fetchCafe24AdjustmentRowsFromDb(
  startISO: ISODate,
  endISO: ISODate,
): Promise<Cafe24RefundRow[]> {
  const snap = await adjustmentsCol()
    .where('date', '>=', startISO)
    .where('date', '<=', endISO)
    .get()
  return snap.docs.map((d) => {
    const x = d.data() as Cafe24AdjustmentDoc
    return {
      refundCode: `ADJ-${d.id}`,
      orderId: x.orderId ?? '',
      refundDate: x.date,
      amount: x.amount,
      pointsRefunded: 0,
      isFallback: false,
      isAdjustment: true,
    }
  })
}
