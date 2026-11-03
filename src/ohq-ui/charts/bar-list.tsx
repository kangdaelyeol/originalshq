import { formatInt } from '../lib/format'
import { SERIES_PRIMARY } from './palette'

export interface BarListItem {
  key: string
  label: string
  value: number
}

interface BarListProps {
  items: readonly BarListItem[]
  ariaLabel: string
  /** 값 뒤 단위(예: 건) */
  unit?: string
  /** 이 개수를 넘으면 나머지를 "기타"로 묶는다. */
  limit?: number
  empty?: string
}

/** 항목별 개수 — 이름 · 값 한 줄 아래 가는 막대. 한 계열이라 색은 하나, 범례 없이. */
export function BarList({ items, ariaLabel, unit = '건', limit = 6, empty = '자료가 없어요' }: BarListProps) {
  const sorted = [...items].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const shown =
    sorted.length > limit
      ? [
          ...sorted.slice(0, limit - 1),
          { key: '__other', label: '기타', value: sorted.slice(limit - 1).reduce((sum, item) => sum + item.value, 0) },
        ]
      : sorted
  const max = Math.max(1, ...shown.map((item) => item.value))
  const total = shown.reduce((sum, item) => sum + item.value, 0)

  if (shown.length === 0) return <p className="bar-list__empty">{empty}</p>

  return (
    <ul className="bar-list" aria-label={ariaLabel}>
      {shown.map((item) => (
        <li key={item.key} className="bar-list__row" title={`${item.label} ${formatInt(item.value)}${unit}`}>
          <div className="bar-list__head">
            <span className="bar-list__label">{item.label}</span>
            <span className="bar-list__value">
              {formatInt(item.value)}
              <small>{unit}</small>
              <span className="bar-list__share">{Math.round((item.value / total) * 100)}%</span>
            </span>
          </div>
          <span className="bar-list__track" aria-hidden>
            <span
              className="bar-list__fill"
              style={{ width: `${(item.value / max) * 100}%`, background: SERIES_PRIMARY }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

