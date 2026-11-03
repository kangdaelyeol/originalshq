import { motion, type MotionValue } from 'motion/react'
import { cx } from '../../../lib/cx'
import type { D8Badge } from './sidebar-data'

/**
 * 펼친 줄 끝 표시 — count: 회색 알약 "12"(34×19px), alert: 빨간 원 "3"(23px), dot: 빨간 점(8px).
 * 셋 다 오른쪽 끝(패널 x 29.8em)에 맞춘 2.4em 칸 가운데에 놓인다(F169).
 */
export function SidebarBadge({ badge }: { badge: D8Badge }) {
  if (badge.kind === 'dot') return <span className="d8-badge d8-badge--dot" aria-hidden="true" />
  return (
    <span className={cx('d8-badge', `d8-badge--${badge.kind}`)} aria-hidden="true">
      {badge.value}
    </span>
  )
}

/** 접혔을 때 아이콘 오른쪽 위 빨간 점(빨강 1em + 밝은 테 0.2em, 아이콘 가운데에서 +0.9em,−0.9em) */
export function IconDot({ opacity }: { opacity: MotionValue<number> | number }) {
  return <motion.span className="d8-icon-dot" style={{ opacity }} aria-hidden="true" />
}
