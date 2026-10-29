import './theme-picker.scss'
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { useDismiss } from './use-dismiss'
import { GLASS_THEMES, type GlassThemeId } from './themes'

/**
 * 테마 고르기 — 접혀 있을 때는 지금 테마의 견본과 이름만. 누르면 다른 견본들이
 * 옆으로 차례로 펼쳐지고(알약이 늘어난다), 펼친 동안은 마음껏 바꿔 볼 수
 * 있다. 바깥을 누르거나 Esc면 접힌다.
 */
export const ThemePicker = ({
  value,
  onChange,
}: {
  value: GlassThemeId
  onChange: (next: GlassThemeId) => void
}) => {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(boxRef, open, close)

  const current = GLASS_THEMES.find((each) => each.id === value)

  return (
    <div
      ref={boxRef}
      className={`glass_theme_picker${open ? ' is-open' : ''}`}
      role="group"
      aria-label="테마"
    >
      {GLASS_THEMES.map((each, index) => {
        const selected = each.id === value
        return (
          <button
            key={each.id}
            type="button"
            className={`glass_theme_option${selected ? ' is-selected' : ''}`}
            title={each.label}
            aria-pressed={selected}
            aria-expanded={selected ? open : undefined}
            // 접혀 있을 때는 지금 테마 하나만 누를 수 있다(누르면 펼친다).
            tabIndex={open || selected ? 0 : -1}
            aria-hidden={!open && !selected}
            style={
              {
                '--glass-i': index,
                '--sw-base': each.base,
                '--sw-a': each.accent,
                '--sw-b': each.link,
              } as CSSProperties
            }
            onClick={() => (open ? onChange(each.id) : setOpen(true))}
          >
            <span className="glass_theme_swatch" aria-hidden="true" />
            <span className="glass_sr_only">{each.label}</span>
          </button>
        )
      })}
      <span className="glass_theme_name" aria-hidden="true">
        {current?.label}
      </span>
    </div>
  )
}
