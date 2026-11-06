import { ChevronDown } from 'lucide-react'
import { cx } from '../../../lib/cx'

interface SelectPillProps {
  label: string
  className?: string
}

/** 고르기 칸 — 검색 칸과 같은 높이(18px)의 어두운 알약, 글자 6px("All channels" · "Last 30 days") */
export function SelectPill({ label, className }: SelectPillProps) {
  return (
    <button type="button" className={cx('d16-select', 'd16-hov', className)} aria-haspopup="listbox">
      <span>{label}</span>
      <ChevronDown className="d16-select__icon" strokeWidth={2} aria-hidden />
    </button>
  )
}
