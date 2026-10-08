import { useEffect, useState, type FormEvent } from 'react'
import {
  adjustmentClient,
  type Cafe24Adjustment,
} from '../client/adjustment-client'

/** 폼에서는 방향과 금액을 따로 받는다 — 부호를 직접 치게 하면 "환불을
 * 줄이려면 음수"를 매번 떠올려야 해서 실수하기 쉽다. */
export type AdjustmentDirection = 'increase' | 'decrease'

export interface AdjustmentForm {
  date: string
  direction: AdjustmentDirection
  /** 입력창 원본 문자열(양수, 원 단위). */
  amount: string
  orderId: string
  memo: string
}

const EMPTY_FORM: AdjustmentForm = {
  date: '',
  direction: 'decrease',
  amount: '',
  orderId: '',
  memo: '',
}

/*
 * Cafe24 환불 수동 보정 페이지 컨트롤러.
 *
 * 목록 조회, 등록 폼, 삭제를 다룬다. 등록·삭제가 성공하면 서버가 돌려준
 * 결과로 목록을 바로 고친다(다시 조회하지 않음).
 */
export const useAdjustmentsViewModel = () => {
  const [adjustments, setAdjustments] = useState<Cafe24Adjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AdjustmentForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    adjustmentClient.list().then((res) => {
      if (cancelled) return
      if (res.ok) setAdjustments(res.data)
      else setError(res.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateForm = <K extends keyof AdjustmentForm>(
    field: K,
    value: AdjustmentForm[K],
  ) => setForm((prev) => ({ ...prev, [field]: value }))

  const parsedAmount = Number(form.amount.replace(/[,\s]/g, ''))
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount > 0
  /** 서버에 보낼 부호 있는 금액 — 환불 차감이면 음수. */
  const signedAmount =
    form.direction === 'decrease' ? -parsedAmount : parsedAmount
  const canSubmit =
    form.date !== '' && amountValid && form.memo.trim() !== '' && !submitting

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    const res = await adjustmentClient.create({
      date: form.date,
      amount: signedAmount,
      orderId: form.orderId.trim(),
      memo: form.memo.trim(),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    // 서버 목록과 같은 순서(날짜 내림차순, 같은 날은 최근 등록 먼저)를 유지한다.
    setAdjustments((prev) =>
      [res.data, ...prev].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
      ),
    )
    // 같은 주문의 짝(취소일 +, 철회일 −)을 이어서 넣기 쉽게 주문번호와
    // 사유는 남기고 날짜·금액만 비운다.
    setForm((prev) => ({ ...prev, date: '', amount: '' }))
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    setError('')
    const res = await adjustmentClient.delete(id)
    setDeletingId(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setAdjustments((prev) => prev.filter((item) => item.id !== id))
  }

  return {
    state: {
      adjustments,
      loading,
      form,
      submitting,
      deletingId,
      error,
      canSubmit,
      /** 금액을 제대로 넣었을 때만 미리보기를 보여주기 위한 값. */
      previewAmount: amountValid ? signedAmount : null,
      /** 전체 보정의 합 — 0이면 기간 합계에는 영향이 없다는 뜻. */
      netTotal: adjustments.reduce((sum, item) => sum + item.amount, 0),
    },
    actions: { updateForm, submit, remove },
  }
}
