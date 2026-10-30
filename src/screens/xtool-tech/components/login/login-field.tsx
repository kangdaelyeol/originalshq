import { CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

interface LoginFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  icon: LucideIcon
  type?: 'text' | 'email' | 'password'
  /** 있으면 칸이 빨갛게 바뀌고 아래에 문구가 뜬다(화면 낭독기에도 바로 읽힌다). */
  error?: string | null
}

/** 아이콘이 붙은 입력칸 — 비밀번호면 오른쪽에 보기/숨기기 버튼이 생긴다. */
export function LoginField({ label, icon: Icon, type = 'text', id, error, ...rest }: LoginFieldProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const errorId = `${inputId}-error`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={cx('login-field', error && 'login-field--error')}>
      <label className="login-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="login-field__control">
        <Icon size={16} aria-hidden />
        <input
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="login-field__toggle"
            aria-label={revealed ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="login-field__error" role="alert">
          <CircleAlert size={13} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
