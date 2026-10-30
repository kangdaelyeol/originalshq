import { useState } from 'react'
import { cx } from '../../lib/cx'
import { percentages } from '../../lib/format'

export interface ShareItem {
  key: string
  label: string
  value: number
  color: string
}

interface ShareBarProps {
  items: readonly ShareItem[]
  ariaLabel: string
}

/** 100% 누적 막대 한 줄 + 범례 — 조각 사이는 2px 틈으로 나눈다. */
export function ShareBar({ items, ariaLabel }: ShareBarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const pcts = percentages(items.map((item) => item.value))

  return (
    <div className="share">
      <div className="share__bar" role="img" aria-label={ariaLabel}>
        {items.map((item, i) => (
          <span
            key={item.key}
            className={cx('share__segment', hovered !== null && hovered !== item.key && 'is-dimmed')}
            style={{ flexGrow: item.value, background: item.color }}
            title={`${item.label} ${pcts[i]}%`}
            onPointerEnter={() => setHovered(item.key)}
            onPointerLeave={() => setHovered(null)}
          />
        ))}
      </div>

      <ul className="legend">
        {items.map((item, i) => (
          <li
            key={item.key}
            className={cx('legend__row', hovered === item.key && 'is-active')}
            tabIndex={0}
            onPointerEnter={() => setHovered(item.key)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.key)}
            onBlur={() => setHovered(null)}
          >
            <span className="legend__swatch" style={{ background: item.color }} aria-hidden />
            <span className="legend__label">{item.label}</span>
            <span className="legend__value">{pcts[i]}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
