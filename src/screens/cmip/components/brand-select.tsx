import { BRAND_OPTIONS } from '../types'
import type { BrandId } from '../types'
import '../styles/brand-select.scss'

interface Props {
  value: BrandId
  onChange: (id: BrandId) => void
  disabled?: boolean
}

/** 브랜드(xTool / BleeqUp) 토글 로우 — 항상 하나만 선택된 세그먼트 컨트롤. */
export const BrandSelect = ({ value, onChange, disabled = false }: Props) => {
  return (
    <div className="brand-select">
      <span className="brand-select__label">브랜드</span>
      <div className="brand-select__row" role="group" aria-label="브랜드 선택">
        {BRAND_OPTIONS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`brand-select__option${value === b.id ? ' is-active' : ''}`}
            aria-pressed={value === b.id}
            disabled={disabled}
            onClick={() => onChange(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
