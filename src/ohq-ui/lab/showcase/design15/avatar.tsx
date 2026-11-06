import { cx } from '../../../lib/cx'
import { memberByInitials, type D15Presence } from './design15-data'

// 팀 밖 사람(NB)은 초록 파스텔(F330 할 일 카드)
const OUTSIDE_TINT = '#d6ebd0'

interface AvatarProps {
  initials: string
  /** sm 목록·카드(1.5em) · md 팀 행(1.7em) · lg 팀 카드(3em) · xl 서랍(3.8em) */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 지금 상태 점 — 초록 online · 호박 away · 회색 offline */
  presence?: D15Presence
  className?: string
}

/** 머리글자 동그라미 — 사람마다 파스텔 바탕(F358 NC 살구·PR 분홍·MS 초록·HK 보라…) */
export function Avatar({ initials, size = 'sm', presence, className }: AvatarProps) {
  const tint = memberByInitials(initials)?.tint ?? OUTSIDE_TINT
  return (
    <span className={cx('d15-avatar', `d15-avatar--${size}`, className)} style={{ background: tint }}>
      {initials}
      {presence && <i className={cx('d15-avatar__dot', `is-${presence}`)} aria-label={presence} />}
    </span>
  )
}

/** 겹친 머리글자들(할 일 카드·오늘 일정) */
export function AvatarStack({ people, size = 'sm' }: { people: readonly string[]; size?: AvatarProps['size'] }) {
  return (
    <span className="d15-avatars">
      {people.map((p) => (
        <Avatar key={p} initials={p} size={size} />
      ))}
    </span>
  )
}
