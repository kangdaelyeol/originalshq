import '@/screens/xtool-lead-manager/styles/confirm-modal.scss'
import { useCallback, useEffect, useState } from 'react'
import type { ConfirmVariant, Lead } from '../types'

const VARIANT_CONTENT: Record<
  ConfirmVariant,
  {
    title: string
    description: string
    confirmLabel: string
    confirmingLabel: string
  }
> = {
  delete: {
    title: '고객 정보를 삭제할까요?',
    description: '삭제하면 되돌릴 수 없습니다. 데이터가 영구적으로 사라집니다.',
    confirmLabel: '삭제[Enter]',
    confirmingLabel: '삭제 중...',
  },
  register: {
    title: '전환 이벤트를 등록할까요?',
    description:
      '등록 후에는 취소할 수 없습니다. 정보를 다시 한번 확인해주세요.',
    confirmLabel: '등록[Enter]',
    confirmingLabel: '등록 중...',
  },
}

export const ConfirmModal = ({
  lead,
  variant,
  onConfirm,
  onCancel,
}: {
  lead: Lead
  variant: ConfirmVariant
  onConfirm: () => Promise<void>
  onCancel: () => void
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const content = VARIANT_CONTENT[variant]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, onConfirm])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onCancel()
      if (e.key === 'Enter' && !isSubmitting) await handleConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onCancel, onConfirm, handleConfirm])

  const handleOverlayClick = () => {
    if (isSubmitting) return
    onCancel()
  }

  return (
    <div className="lead_manager_confirm_modal" onClick={handleOverlayClick}>
      <div
        className={['confirm_form', variant].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="icon_wrap">
          {variant === 'delete' ? (
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.7 12.1A2 2 0 0 0 9.2 21h5.6a2 2 0 0 0 2-1.9L18 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 11v6M14 11v6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M8 12.5l2.5 2.5L16 9.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="title">{content.title}</div>
        <div className="description">{content.description}</div>

        <div className="lead_summary">
          <div className="row">
            <span className="label">고객명</span>
            <span className="value">{lead.fn}</span>
          </div>
          <div className="row">
            <span className="label">전화번호</span>
            <span className="value">{lead.ph}</span>
          </div>
          <div className="row">
            <span className="label">상담기기</span>
            <span className="value">{lead.device}</span>
          </div>
          {lead.state === 'contacted' && (
            <div className="row">
              <span className="label">구매금액</span>
              <span className="value">{lead.price}</span>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            취소[ESC]
          </button>
          <button
            type="button"
            className={['btn confirm', variant].join(' ')}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting && <span className="spinner" />}
            {isSubmitting ? content.confirmingLabel : content.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
