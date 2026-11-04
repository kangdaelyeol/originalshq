import { AlertCircle } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { WaterIcon } from './types'

interface WaterTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** 칸 아래 짧은 도움말 */
  hint?: ReactNode
  /** 오류 — 있으면 도움말 대신 보이고 칸 테두리가 붉어진다(aria-invalid) */
  error?: ReactNode
  /** 칸 앞 아이콘(검색 등) */
  icon?: WaterIcon
}

/**
 * 물 입력 — 얕은 유리 알약(그림자를 작게 띄운 D7 유리). 초점이 오면 흰 고리를 두른다(0.1s). TextField와 같은
 * props에 도움말·오류·아이콘을 더했다.
 */
export function WaterTextField({ label, hint, error, icon: Icon, id, className, ...rest }: WaterTextFieldProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const noteId = `${inputId}-note`
  const note = error ?? hint
  return (
    <div className={cx('water-field', error ? 'is-error' : null, rest.disabled && 'is-disabled', className)}>
      <label className="water-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="water-field__box">
        {Icon && <Icon className="water-field__icon" />}
        <input
          id={inputId}
          className="water-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...rest}
        />
      </div>
      {error ? (
        <p id={noteId} className="water-field__note water-field__note--error">
          <AlertCircle className="water-field__note-icon" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="water-field__note">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
