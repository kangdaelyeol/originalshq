import { ArrowUpRight, CheckCircle2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog'
import { Checkbox } from './ui/checkbox'
import { useReservationViewModel } from '../view-model'

export default function Reservation({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const { state, actions } = useReservationViewModel()
  const { name, phone, engraving, consent, busy, error, receipt, cancelled } =
    state
  const {
    setName,
    setPhone,
    setEngraving,
    setConsent,
    submit,
    cancel,
    saveReceipt,
  } = actions

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
