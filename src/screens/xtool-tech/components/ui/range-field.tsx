import { useId, type CSSProperties } from 'react'

interface RangeFieldProps {
  label: string
  /** 슬라이더 아래 짧은 설명 */
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  /** 오른쪽 위에 보이는 값 표기(예: 22px, 46%) */
  format: (value: number) => string
  onChange: (value: number) => void
}

/** 라벨 + 현재 값 + 슬라이더 — 채워진 구간은 강조색. */
export function RangeField({ label, hint, value, min, max, step = 1, format, onChange }: RangeFieldProps) {
  const id = useId()
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="range-field">
      <div className="range-field__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        style={{ '--fill': fill } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && (
        <p id={`${id}-hint`} className="range-field__hint">
          {hint}
        </p>
      )}
    </div>
  )
}
