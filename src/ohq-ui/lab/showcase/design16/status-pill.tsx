import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import type { Tone } from './design16-data'

interface StatusPillProps {
  tone: Tone
  children: ReactNode
  /** 앞 점 */
  dot?: boolean
}

/** 상태 알약 — 같은 색 옅은 막 + 점 + 글자("Checkout healthy" 초록 · 표의 Awaiting payment 호박 · To pack 파랑) */
export function StatusPill({ tone, children, dot = true }: StatusPillProps) {
  return (
    <span className={cx('d16-status', `d16-tone--${tone}`)}>
      {dot && <span className="d16-status__dot" aria-hidden />}
      {children}
    </span>
  )
}
