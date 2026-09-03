import '../styles/segmented-toggle.scss'

interface Props<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

/** 라벨 + 버튼 N개 세그먼트 컨트롤 — 항상 하나만 선택. 브랜드·보고서 종류 등에 공용. */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: Props<T>) {
  return (
    <div className="segmented-toggle">
      <span className="segmented-toggle__label">{label}</span>
      <div className="segmented-toggle__row" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`segmented-toggle__option${
              value === o.value ? ' is-active' : ''
            }`}
            aria-pressed={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
