import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: 강조색(주요 행동) · ghost: 유리 위 보조 버튼(표 안 작업 등) */
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: LucideIcon
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx('button', `button--${variant}`, `button--${size}`, className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.4} aria-hidden />}
      {children}
    </button>
  )
}
