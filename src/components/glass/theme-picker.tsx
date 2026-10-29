import './theme-picker.scss'
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { useDismiss } from './use-dismiss'
import { GLASS_THEMES, type GlassThemeId } from './themes'

const GROUPS = [
  { scheme: 'dark', label: '다크' },
  { scheme: 'light', label: '라이트' },
] as const

const swatchStyle = (theme: (typeof GLASS_THEMES)[number]) =>
  ({
    '--sw-base': theme.base,
    '--sw-a': theme.accent,
    '--sw-b': theme.link,
  }) as CSSProperties

/**
 * 테마 고르기 — 접혀 있을 때는 지금 테마의 견본과 이름만. 누르면 아래로 유리
 * 판이 펼쳐지고(흐릿하게 커지며 나타나고 견본이 차례로), 다크·라이트 두 줄에서
 * 마음껏 바꿔 볼 수 있다. 바깥을 누르거나 Esc면 접힌다.
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
    <div ref={boxRef} className={`glass_theme_picker${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="glass_theme_current"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`테마 — ${current?.label ?? ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {current && (
          <span
            className="glass_theme_swatch"
            style={swatchStyle(current)}
            aria-hidden="true"
          />
        )}
        <span className="glass_theme_name">{current?.label}</span>
        <ChevronDown
          className="glass_theme_chevron"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="glass_theme_panel" role="group" aria-label="테마">
          {GROUPS.map((group) => (
            <div key={group.scheme} className="glass_theme_group">
              <span className="glass_theme_group_label">{group.label}</span>
              <div className="glass_theme_options">
                {GLASS_THEMES.filter(
                  (each) => each.scheme === group.scheme,
                ).map((each) => (
                  <button
                    key={each.id}
                    type="button"
                    className={`glass_theme_option${each.id === value ? ' is-selected' : ''}`}
                    aria-pressed={each.id === value}
                    style={
                      {
                        ...swatchStyle(each),
                        '--glass-i': GLASS_THEMES.indexOf(each),
                      } as CSSProperties
                    }
                    onClick={() => onChange(each.id)}
                  >
                    <span className="glass_theme_swatch" aria-hidden="true" />
                    <span className="glass_theme_option_name">
                      {each.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
