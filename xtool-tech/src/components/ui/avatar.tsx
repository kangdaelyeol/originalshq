import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'

interface AvatarProps {
  initials: string
  color: string
  size?: 'sm' | 'md'
  className?: string
}

/** 이니셜 사각 아바타 — 색은 사람 구분용(장식). */
export function Avatar({ initials, color, size = 'sm', className }: AvatarProps) {
  return (
    <span className={cx('avatar', `avatar--${size}`, className)} style={{ '--avatar': color } as CSSProperties} aria-hidden>
      {initials}
    </span>
  )
}
