import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'

interface AvatarProps {
  initials: string
  color: string
  /** 글자색 — 밝은 바탕(강조 녹색 등)이면 짙은 색으로. 기본은 흰색. */
  ink?: string
  size?: 'sm' | 'md'
  className?: string
}

/** 이니셜 사각 아바타 — 색은 사람 구분용(장식). */
export function Avatar({ initials, color, ink, size = 'sm', className }: AvatarProps) {
  const style = { '--avatar': color, ...(ink ? { '--avatar-ink': ink } : {}) } as CSSProperties
  return (
    <span className={cx('avatar', `avatar--${size}`, className)} style={style} aria-hidden>
      {initials}
    </span>
  )
}
