import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { AS_POLICY_TITLE, AsPolicy } from './as-policy'

/**
 * AS 정책 안내 창 — 아래에서 올라오는 판(휴대폰 전용 폼). 열리면 닫기 단추에 초점을 두고, Esc·닫기(X)·바깥 누르기·
 * "확인"으로 닫는다. 열려 있는 동안 뒤 화면은 굴러가지 않는다. 닫히면 연 단추로 초점을 돌려준다(부르는 쪽).
 * 폼 루트(.tech-form) 안에 그려 폼의 색·글꼴을 그대로 쓴다.
 */
export function PolicyModal({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
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
    }
  }, [onClose])

  return (
    <div className="tech-form__modal-backdrop" onClick={onClose}>
      <div
        className="tech-form__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tech-form__modal-head">
          <h2 id={titleId}>AS 정책 안내</h2>
          <button ref={closeRef} type="button" className="tech-form__modal-close" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </header>
        <div className="tech-form__modal-body">
          <p className="tech-form__policy-title">{AS_POLICY_TITLE}</p>
          <AsPolicy />
        </div>
        <footer className="tech-form__modal-foot">
          <button type="button" className="tech-form__button tech-form__button--block" onClick={onClose}>
            확인
          </button>
        </footer>
      </div>
    </div>
  )
}
