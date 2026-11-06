import { cx } from '../../../lib/cx'

interface FilterChipsProps {
  chips: readonly { key: string; label: string; count: number }[]
  value: string
  onChange?: (next: string) => void
  className?: string
}

/** 상태 걸러보기 — 14.5px 알약, 고른 것은 강조색(All 437), 나머지는 어두운 유리 막 */
export function FilterChips({ chips, value, onChange, className }: FilterChipsProps) {
  return (
    <div className={cx('d16-chips', className)} role="toolbar" aria-label="Filter orders">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={chip.key === value}
          className={cx('d16-chip', 'd16-hov', chip.key === value && 'is-on')}
          onClick={() => onChange?.(chip.key)}
        >
          {chip.label}
          <span className="d16-chip__count">{chip.count}</span>
        </button>
      ))}
    </div>
  )
}
