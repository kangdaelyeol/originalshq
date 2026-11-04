import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { Tone } from '../../types'

interface WaterFlagProps {
  tone: Tone
  children: ReactNode
  className?: string
}

/**
 * 상태 표시 — 반투명 흰 칩(D7 안 고른 칩 rgba(255,255,255,0.28)) + 상태 색 점 + 글자. 회색 벽 위에서 상태 색은
 * 글자로 읽기 어려워(대비 1.8~3:1) 색은 점에만 두고 글자는 짙은 잉크로 쓴다(_tokens.scss 상태 점 색).
 */
export function WaterFlag({ tone, children, className }: WaterFlagProps) {
  return (
    <span className={cx('water-flag', `is-${tone}`, className)}>
      <span className="water-flag__dot" aria-hidden />
      {children}
    </span>
  )
}
