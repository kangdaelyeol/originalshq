import { useRef, useState, type FormEvent } from 'react'

export type ReservationReceipt = { id: string; key: string }

/** UUID v4 used as the idempotency key for one reservation attempt. */
const freshKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 15) | 64
  b[8] = (b[8] & 63) | 128
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/*
 * Reservation dialog controller.
 *
 * Holds the form fields and the three things the dialog can do: submit a
 * reservation, cancel the one just made, and save its receipt as a text file.
 * The request key is kept across retries so a resubmitted form is recognised
 * as the same reservation.
 */
export const useReservationViewModel = () => {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [engraving, setEngraving] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ReservationReceipt | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const requestKey = useRef('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!consent) {
      setError('예약 안내를 위한 개인정보 수집에 동의해 주세요.')
      return
    }
    setBusy(true)
    try {
      if (!requestKey.current) requestKey.current = freshKey()
      const r = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          engraving,
          consent,
          requestKey: requestKey.current,
        }),
      })
      const result = (await r
        .json()
        .catch(
          () => ({}) as { id?: string; key?: string; error?: string },
        )) as { id?: string; key?: string; error?: string }
      if (!r.ok)
        throw new Error(
          result.error || '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        )
      if (!result.id || !result.key)
        throw new Error('접수 결과를 확인하지 못했습니다. 다시 시도해 주세요.')
      setReceipt({ id: result.id, key: result.key })
      setCancelled(false)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '접수하지 못했습니다. 입력 내용은 유지됩니다.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!receipt || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt),
      })
      if (!r.ok)
        throw new Error('취소하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setCancelled(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function saveReceipt() {
    if (!receipt) return
    const payload = [
      '파르케 사전 예약 접수증',
      `접수 번호: ${receipt.id}`,
      `취소 키: ${receipt.key}`,
      '예약 제품: 파르케 가족 공유형',
      '안내 가격: 59,000원',
      '결제: 없음',
      '배송 일정·최종 구성·각인 비용: 별도 안내',
      `예약 취소: ${location.origin}/parke/reservation?id=${encodeURIComponent(receipt.id)}#${encodeURIComponent(receipt.key)}`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(
      new Blob([payload], { type: 'text/plain;charset=utf-8' }),
    )
    a.download = `parke-reservation-${receipt.id}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return {
    state: { name, phone, engraving, consent, busy, error, receipt, cancelled },
    actions: {
      setName,
      setPhone,
      setEngraving,
      setConsent,
      submit,
      cancel,
      saveReceipt,
    },
  }
}
