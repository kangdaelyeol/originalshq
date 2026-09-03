import { BRAND_OPTIONS } from '../types'
import type { BrandId } from '../types'
import { SegmentedToggle } from './segmented-toggle'

const OPTIONS = BRAND_OPTIONS.map((b) => ({ value: b.id, label: b.label }))

interface Props {
  value: BrandId
  onChange: (id: BrandId) => void
  disabled?: boolean
}

/** 브랜드(xTool / BleeqUp) 토글 로우. */
export const BrandSelect = ({ value, onChange, disabled }: Props) => (
  <SegmentedToggle
    label="브랜드"
    options={OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
  />
)
