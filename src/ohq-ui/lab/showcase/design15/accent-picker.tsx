import { cx } from '../../../lib/cx'
import { cssVars } from './d15-format'
import type { D15Accent, D15AccentKey } from './design15-data'

interface AccentPickerProps {
  accents: readonly D15Accent[]
  value: D15AccentKey
  onChange: (key: D15AccentKey) => void
}

/**
 * 강조색 견본(F790 확대) — 둥근 네모 칩(위가 밝은 세로 그라데이션)·이름. 고른 칸은 강조색 테두리.
 * 누르면 앱 전체 강조색이 0.2초에 바뀐다(F776~F782, CSS ease).
 */
export function AccentPicker({ accents, value, onChange }: AccentPickerProps) {
  return (
    <div className="d15-swatches" role="radiogroup" aria-label="Accent">
      {accents.map((a) => (
        <button
          key={a.key}
          type="button"
          role="radio"
          aria-checked={a.key === value}
          className={cx('d15-swatch', a.key === value && 'is-active')}
          onClick={() => onChange(a.key)}
          data-tour={`accent-${a.key}`}
        >
          <i className="d15-swatch__chip" style={cssVars({ '--top': a.chip[0], '--bottom': a.chip[1] })} />
          {a.name}
        </button>
      ))}
    </div>
  )
}
