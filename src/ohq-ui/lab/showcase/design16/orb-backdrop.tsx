import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { D16_ORBS, type OrbData } from './design16-data'

interface OrbBackdropProps {
  orbs?: readonly OrbData[]
  className?: string
}

/** 유리 판 뒤의 공들 — 왼쪽 위가 밝은 둥근 그러데이션(색은 토큰 --d16-orb-*) */
export function OrbBackdrop({ orbs = D16_ORBS, className }: OrbBackdropProps) {
  return (
    <div className={cx('d16-orbs', className)} aria-hidden>
      {orbs.map((orb, i) => (
        <span
          key={i}
          className={`d16-orb d16-orb--${orb.tone}`}
          style={{ '--x': orb.x, '--y': orb.y, '--r': orb.r } as CSSProperties}
        />
      ))}
    </div>
  )
}
