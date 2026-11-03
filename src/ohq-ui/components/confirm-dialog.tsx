import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { usePortalRoot } from '../lib/portal-root'

interface ConfirmDialogProps {
  /** 띄울지 */
  open: boolean
  title: string
  /** 무엇이 어떻게 되는지 — 되돌릴 수 없으면 그렇다고 적는다. */
  message?: ReactNode
  /** 확인 단추 글자(예: "지우기") */
  confirmLabel: string
  /** danger면 확인 단추가 빨갛다(지우기·삭제) */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * "정말 ~할까요?" 확인 모달 — 지우기처럼 되돌릴 수 없는 일 앞에 띄운다. Esc·바깥 누르기·취소는
 * 그만두기, 엔터는 확인(확인 단추에 처음부터 포커스). 다른 패널·모달(파일 모달 등) 위에 뜬다.
 */
export function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
  const root = usePortalRoot()
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    // 잡기 단계 — 밑에 깔린 모달·패널이 Esc로 같이 닫히지 않게 여기서 멈춘다.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onCancel])

  if (!open || !root) return null
  return createPortal(
    <div
      className="confirm"
      role="presentation"
      onClick={(e) => {
        // 포털이어도 React 이벤트는 부른 쪽(모달 등)으로 올라간다 — 밑의 모달이 닫히지 않게.
        e.stopPropagation()
        onCancel()
      }}
    >
      <section
        className="confirm__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={cx('confirm__icon', `confirm__icon--${tone}`)} aria-hidden>
          <AlertTriangle size={18} />
        </span>
        <div className="confirm__body">
          <h2 id="confirm-title" className="confirm__title">
            {title}
          </h2>
          {message && <div className="confirm__message">{message}</div>}
        </div>
        <div className="confirm__actions">
          <button type="button" className="button button--ghost button--md" onClick={onCancel}>
            취소
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={cx('button', 'button--md', tone === 'danger' ? 'confirm__danger' : 'button--primary')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    root,
  )
}
