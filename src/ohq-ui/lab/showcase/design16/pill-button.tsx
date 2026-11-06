import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'

interface PillButtonProps {
  children: ReactNode
  icon?: LucideIcon
  /** accent: 파란 알약(+ Create·+ New order) · glass: 유리 알약(Export) · quiet: 판 안 작은 단추(Packed·Restock) */
  variant?: 'accent' | 'glass' | 'quiet'
  size?: 'sm' | 'md'
  className?: string
  onClick?: () => void
}

/** 알약 단추 — 높이 md 18px · sm 14px(영상 px) */
export function PillButton({
  children,
  icon: Icon,
  variant = 'accent',
  size = 'md',
  className,
  onClick,
}: PillButtonProps) {
  return (
    <button
      type="button"
      className={cx('d16-pill', `d16-pill--${variant}`, `d16-pill--${size}`, 'd16-hov', className)}
      onClick={onClick}
    >
      {Icon && <Icon className="d16-pill__icon" strokeWidth={2.2} aria-hidden />}
      <span className="d16-pill__label">{children}</span>
    </button>
  )
}
