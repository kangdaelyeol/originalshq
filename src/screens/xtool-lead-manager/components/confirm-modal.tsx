import { useCallback, useEffect, useState } from 'react'
import {
  ConfirmVariant,
  type RegisterFormValues,
} from '@/screens/xtool-lead-manager/types'
import '@/screens/xtool-lead-manager/styles/confirm-modal.scss'
import { Device, type Lead } from '@/screens/xtool-lead-manager/entity'

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
  register_consultation: {
    title: '상담을 등록할까요?',
    description:
      '등록하면 Meta로 전환 이벤트가 전송됩니다. 정보를 다시 한번 확인해주세요.',
    confirmLabel: '등록[Enter]',
    confirmingLabel: '등록 중...',
  },
  register_purchase: {
    title: '구매를 등록할까요?',
    description:
      '등록하면 Meta로 전환 이벤트가 전송됩니다. 정보를 다시 한번 확인해주세요.',
    confirmLabel: '등록[Enter]',
    confirmingLabel: '등록 중...',
  },
}

export const ConfirmModal = ({
  lead,
  variant,
  registerForm,
  onUpdateRegisterForm,
  onToggleTest,
  onUpdateTestCode,
  onConfirm,
  onCancel,
}: {
  lead: Lead
  variant: ConfirmVariant
  registerForm: RegisterFormValues
  onUpdateRegisterForm: (field: keyof RegisterFormValues, value: string) => void
  onToggleTest: () => void
  onUpdateTestCode: (code: string) => void
  onConfirm: () => Promise<void>
  onCancel: () => void
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const content = VARIANT_CONTENT[variant]
  const isRegister = variant !== ConfirmVariant.DELETE

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
      // 등록 폼의 입력창에 포커스가 있을 때 Enter로 바로 확정되면 입력을
      // 마치기도 전에 등록되기 쉬우므로, 등록 폼에서는 Enter 단축키를 끈다.
      if (e.key === 'Escape' && !isSubmitting) onCancel()
      if (e.key === 'Enter' && !isSubmitting && !isRegister)
        await handleConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, isRegister, onCancel, onConfirm, handleConfirm])

  const handleOverlayClick = () => {
    if (isSubmitting) return
    onCancel()
  }

  return (
    <div className="lead_manager_confirm_modal" onClick={handleOverlayClick}>
      <div
        className={['confirm_form', isRegister ? 'register' : variant].join(
          ' ',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="icon_wrap">
          {variant === ConfirmVariant.DELETE ? (
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
        </div>

        {isRegister && (
          <div className="register_form">
            <div className="form_row">
              <label className="label" htmlFor="register-device">
                기기
              </label>
              <select
                id="register-device"
                className="control"
                value={registerForm.device}
                onChange={(e) => onUpdateRegisterForm('device', e.target.value)}
              >
                {Object.values(Device).map((device) => (
                  <option key={device} value={device}>
                    {device}
                  </option>
                ))}
              </select>
            </div>

            {variant === ConfirmVariant.REGISTER_PURCHASE && (
              <div className="form_row">
                <label className="label" htmlFor="register-price">
                  구매 금액
                </label>
                <input
                  id="register-price"
                  className="control"
                  type="number"
                  min={0}
                  placeholder="원"
                  value={registerForm.price}
                  onChange={(e) =>
                    onUpdateRegisterForm('price', e.target.value)
                  }
                />
              </div>
            )}

            <div className="form_row">
              <label className="label" htmlFor="register-at">
                시각
              </label>
              <input
                id="register-at"
                className="control"
                type="datetime-local"
                placeholder="지금"
                value={registerForm.at}
                onChange={(e) => onUpdateRegisterForm('at', e.target.value)}
              />
            </div>

            {/* 켜두면 이번 Meta CAPI 전송에 test_event_code가 실려 나가
                이벤트 관리자의 테스트 이벤트로 잡힌다. */}
            <div className="form_row test_toggle_row">
              <label className="test_toggle" htmlFor="register-is-test">
                <input
                  id="register-is-test"
                  type="checkbox"
                  checked={registerForm.isTest}
                  onChange={onToggleTest}
                />
                <span>테스트 이벤트로 전송</span>
              </label>
              {registerForm.isTest && (
                <input
                  className="control"
                  placeholder="test_event_code"
                  value={registerForm.testEventCode}
                  onChange={(e) => onUpdateTestCode(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

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
            className={['btn confirm', isRegister ? 'register' : variant].join(
              ' ',
            )}
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
