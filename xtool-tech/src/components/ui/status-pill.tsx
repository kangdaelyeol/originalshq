import type { ReactNode } from 'react'
import type { Tone } from '../../data/types'
import { cx } from '../../lib/cx'

interface StatusPillProps {
  tone: Tone
  children: ReactNode
  /** 앞에 작은 점 — 'pulse'면 깜빡인다(Live 표시). */
  dot?: boolean | 'pulse'
  className?: string
}

export function StatusPill({ tone, children, dot, className }: StatusPillProps) {
  return (
    <span className={cx('pill', `pill--${tone}`, className)}>
      {dot && <span className={cx('pill__dot', dot === 'pulse' && 'pill__dot--pulse')} aria-hidden />}
      {children}
    </span>
  )
}
