import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import type { PillTone } from './glass-data'

interface PillGlowProps {
  tone: PillTone
  lit: boolean
  /** halo = 판 위에 번지는 색(알약 아래에 둔다) · bloom = 이웃 알약까지 비추는 빛(맨 위에 둔다) */
  variant: 'halo' | 'bloom'
  /** 알약과 같은 자리(국소 y, em) */
  slot?: number
}

/** 켜진 알약이 주변에 내는 빛(Design 6) — 알약과 같은 순간 켜지고(r35~r37 번쩍) 4프레임 만에 꺼진다. */
export function PillGlow({ tone, lit, variant, slot = 0 }: PillGlowProps) {
  return (
    <span
      className={cx('d6-glow', `d6-glow--${variant}`, `d6-tone--${tone}`, lit && 'is-lit')}
      style={{ '--d6-slot': `${slot}em` } as CSSProperties}
      aria-hidden
    />
  )
}
