import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { Tone } from '../../types'

interface WaterStatusPillProps {
  tone: Tone
  children: ReactNode
  /** 앞에 작은 상태 점 — 'pulse'면 점에서 물결이 퍼진다(Live 표시) */
  dot?: boolean | 'pulse'
  className?: string
}

/**
 * 물 상태 알약 — 반투명 흰 칩(D7 안 고른 칩) + 상태 색 점(--w-ok·warn·crit·info). 회색 벽 위에서 색 글자는
 * 대비가 낮아 글자는 잉크색으로 두고 색은 점에만 쓴다. pulse는 D7 물결(반지름이 고르게 커지며 1-u²로 흐려짐).
 */
export function WaterStatusPill({ tone, children, dot, className }: WaterStatusPillProps) {
  return (
    <span className={cx('water-pill', `water-pill--${tone}`, className)}>
      {dot && <span className={cx('water-pill__dot', dot === 'pulse' && 'water-pill__dot--pulse')} aria-hidden />}
      {children}
    </span>
  )
}
