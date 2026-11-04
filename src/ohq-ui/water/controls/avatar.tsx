import type { CSSProperties } from 'react'
import { cx } from '../../lib/cx'

interface WaterAvatarProps {
  initials: string
  /** 사람 구분 색(장식) — 유리 구슬에 물든다 */
  color: string
  /** 글자색 — 밝은 색이면 짙게. 기본은 흰색 */
  ink?: string
  /** xs 20 · sm 32 · md 38px */
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /** 프로필 사진 — 있으면 이니셜 대신 */
  photo?: string
}

/**
 * 물 아바타 — 사람 색이 물든 유리 구슬(D7 불투명 유리 단추의 테두리·안쪽 그림자) + 그림자 진 흰 이니셜.
 * 사진이면 사진 위에 같은 유리 테두리를 얹는다. Avatar와 같은 props.
 */
export function WaterAvatar({ initials, color, ink, size = 'sm', className, photo }: WaterAvatarProps) {
  const style = { '--water-avatar': color, ...(ink ? { '--water-avatar-ink': ink } : {}) } as CSSProperties
  return (
    <span
      className={cx('water-avatar', `water-avatar--${size}`, photo && 'water-avatar--photo', className)}
      style={style}
      aria-hidden
    >
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  )
}
