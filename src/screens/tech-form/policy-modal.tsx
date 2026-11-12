import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AS_POLICY_TITLE, AsPolicy } from './as-policy'

/**
 * 아래에서 올라오는 창(휴대폰 전용 폼) — AS 정책 안내와 A/S 신청 확인사항이 같이 쓴다. 열리면 닫기 단추에 초점을 두고,
 * Esc·닫기(X)·바깥 누르기로 닫는다(onClose). 열려 있는 동안 뒤 화면은 굴러가지 않는다. 닫히면 열기 전에 초점이 있던
 * 단추로 초점을 돌려준다(그 단추가 화면에 남아 있을 때만). 폼 루트(.tech-form) 안에 그려 폼의 색·글꼴을 그대로 쓴다.
 * fit이면 내용만큼만 올라온다(짧은 안내) — 아니면 화면 높이의 92%.
 */
export function FormSheet({
  title,
  children,
  footer,
  onClose,
  fit = false,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
  fit?: boolean
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [onClose])

  return (
    <div className="tech-form__modal-backdrop" onClick={onClose}>
      <div
        className={fit ? 'tech-form__modal tech-form__modal--fit' : 'tech-form__modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tech-form__modal-head">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="tech-form__modal-close" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </header>
        <div className="tech-form__modal-body">{children}</div>
        <footer className="tech-form__modal-foot">{footer}</footer>
      </div>
    </div>
  )
}

/** AS 정책 안내 창 — 시작 화면의 "AS 정책 안내" 단추로 연다. "확인"으로도 닫는다. */
export function PolicyModal({ onClose }: { onClose: () => void }) {
  return (
    <FormSheet
      title="AS 정책 안내"
      onClose={onClose}
      footer={
        <button type="button" className="tech-form__button tech-form__button--block" onClick={onClose}>
          확인
        </button>
      }
    >
      <p className="tech-form__policy-title">{AS_POLICY_TITLE}</p>
      <AsPolicy />
    </FormSheet>
  )
}
