import { cx } from '../../../lib/cx'
import { D16_ITEM_ICONS } from './d16-icons'
import type { ItemKind } from './design16-data'

interface ItemThumbProps {
  kind: ItemKind
  /** 한 변(영상 px) — 카드 줄 7.5 · 표 9 · 재고 13 */
  size?: number
  className?: string
}

/** 상품 칸 — 종류마다 어두운 색 바탕(녹차 청록·허브 자주·우롱 갈색·홍차 남색·다기 초록)에 밝은 선 아이콘 */
export function ItemThumb({ kind, size = 7.5, className }: ItemThumbProps) {
  const Icon = D16_ITEM_ICONS[kind]
  return (
    <span
      className={cx('d16-thumb', `d16-thumb--${kind}`, className)}
      style={{ width: `calc(${size} * var(--d16-px))`, height: `calc(${size} * var(--d16-px))` }}
      aria-hidden
    >
      <Icon strokeWidth={2.2} />
    </span>
  )
}
