import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'

interface AvatarProps {
  initials: string
  /** 파스텔 바탕 색상각(없으면 흰 회색) */
  hue?: number
  /** 지름(영상 px) */
  size?: number
  className?: string
}

/** 머리글자 동그라미 — 옅은 파스텔 바탕에 진한 글자(영상 SM 214,202,180) */
export function Avatar({ initials, hue, size = 10, className }: AvatarProps) {
  return (
    <span
      className={cx('d16-avatar', className)}
      style={{ '--s': size, '--h': hue ?? 220, '--c': hue === undefined ? '6%' : '38%' } as CSSProperties}
      aria-hidden
    >
      {initials}
    </span>
  )
}
