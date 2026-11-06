import type { CSSProperties } from 'react'

interface StockBarProps {
  left: number
  reorder: number
}

/** 재고 막대(26×2.4) — 남은 양 ÷ 다시 주문할 양, 주황 채움(9/20 = 45%) */
export function StockBar({ left, reorder }: StockBarProps) {
  const v = reorder > 0 ? Math.min(1, left / reorder) : 0
  return (
    <span
      className="d16-stock"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={reorder}
      aria-valuenow={left}
      style={{ '--v': v } as CSSProperties}
    />
  )
}
