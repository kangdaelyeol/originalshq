import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, CheckCircle2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog'
import { Checkbox } from './ui/checkbox'
const freshKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 15) | 64
  b[8] = (b[8] & 63) | 128
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export default function Reservation({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [engraving, setEngraving] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<{ id: string; key: string } | null>(null),
    [cancelled, setCancelled] = useState(false)
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pf-reservation-dialog">
        <DialogClose className="pf-reservation-close" aria-label="예약 창 닫기">
          <X />
        </DialogClose>
        <DialogTitle>파르케, 먼저 만나세요.</DialogTitle>
        <DialogDescription className="pf-reservation-intro">
          59,000원 · 결제 없는 사전 예약
          <br />
          배송 일정과 최종 구성을 안내받은 뒤 구매를 결정하세요.
        </DialogDescription>
        {receipt ? (
          <div className="pf-reservation-success">
            <CheckCircle2 />
            <strong>
              {cancelled
                ? '예약이 취소되었습니다.'
                : '예약 의사가 접수되었습니다.'}
            </strong>
            <p>
              {cancelled
                ? '입력하신 예약 정보도 삭제했습니다.'
                : '지금 결제된 금액은 없습니다.\n예약 안내를 위한 연락처를 안전하게 저장했습니다.'}
            </p>
            <code>{receipt.id}</code>
            {!cancelled && (
              <>
                <button className="pf-primary" onClick={saveReceipt}>
                  접수증 저장하기
                </button>
                <button onClick={cancel} disabled={busy}>
                  {busy ? '취소 처리 중…' : '이 예약 취소하기'}
                </button>
              </>
            )}
            {error && (
              <p className="pf-reservation-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form className="pf-reservation-form" onSubmit={submit}>
            <div className="pf-reservation-summary">
              <span>파르케 가족 공유형</span>
              <strong>59,000원</strong>
            </div>
            <label>
              이름
              <input
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                placeholder="예약자 이름"
              />
            </label>
            <label>
              휴대폰 번호
              <input
                name="phone"
                autoComplete="tel"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                minLength={10}
                maxLength={20}
                placeholder="010-0000-0000"
              />
            </label>
            <label>
              각인 희망 문구 <small>선택 · 비용은 별도 안내</small>
              <input
                name="engraving"
                value={engraving}
                onChange={(e) => setEngraving(e.target.value)}
                maxLength={16}
                placeholder="예: ONYU"
              />
            </label>
            <div className="pf-consent">
              <Checkbox
                id="reservation-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(Boolean(v))}
                aria-label="예약 안내를 위한 개인정보 수집 동의"
              />
              <label htmlFor="reservation-consent">
                예약 확인·출시 안내를 위한 개인정보 수집 및 이용에 동의합니다.
              </label>
            </div>
            <p className="pf-reservation-privacy">
              수집 항목: 이름, 휴대폰 번호, 각인 문구(선택)
              <br />
              이용 목적: 예약 확인과 파르케 출시 안내
              <br />
              보유 기간: 예약 취소 또는 안내 종료 시까지. 동의를 거부할 수
              있으나 예약 접수는 어렵습니다.
            </p>
            {error && (
              <p className="pf-reservation-error" role="alert">
                {error}
              </p>
            )}
            <button className="pf-primary" type="submit" disabled={busy}>
              {busy ? '접수 중…' : '결제 없이 예약하기'}
              <ArrowUpRight size={20} />
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
