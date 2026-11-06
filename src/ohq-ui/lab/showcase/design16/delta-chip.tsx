import { ArrowDown, ArrowUp } from 'lucide-react'
import { cx } from '../../../lib/cx'

interface DeltaChipProps {
  value: string
  /** 오름(초록) · 내림(빨강) */
  down?: boolean
}

/** KPI 변화 칩 — 18×8 초록 막(27,51,41)에 화살표와 "135%" */
export function DeltaChip({ value, down }: DeltaChipProps) {
  const Arrow = down ? ArrowDown : ArrowUp
  return (
    <span className={cx('d16-delta', down && 'is-down')}>
      <Arrow className="d16-delta__icon" strokeWidth={3} aria-hidden />
      {value}
    </span>
  )
}
