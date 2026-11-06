import { cx } from '../../../lib/cx'

interface CompareToggleProps {
  label: string
  on: boolean
  onToggle?: () => void
}

/** 비교 선 켜기 — 켜지면 파란 알약(44×15)에 점선 표시와 "Last year"(12M) · "Previous"(그 밖) */
export function CompareToggle({ label, on, onToggle }: CompareToggleProps) {
  return (
    <button type="button" aria-pressed={on} className={cx('d16-compare', 'd16-hov', on && 'is-on')} onClick={onToggle}>
      <svg className="d16-compare__mark" viewBox="0 0 8 2" aria-hidden>
        <path d="M0 1H8" />
      </svg>
      {label}
    </button>
  )
}
