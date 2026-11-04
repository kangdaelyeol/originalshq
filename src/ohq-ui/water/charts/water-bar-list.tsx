import type { CSSProperties } from 'react'
import type { BarListItem } from '../../charts/bar-list'
import { formatInt } from '../../lib/format'
import { WaterEmpty } from '../surfaces/water-empty'
import { WATER_OTHER } from './palette'
import { WaterBar } from './water-bar'

interface WaterBarListProps {
  items: readonly BarListItem[]
  ariaLabel: string
  /** 값 뒤 단위(예: 건) */
  unit?: string
  /** 이 개수를 넘으면 나머지를 "기타"로 묶는다 */
  limit?: number
  empty?: string
}

/**
 * 항목별 개수(D7) — BarList와 같은 props. 이름 · 값 한 줄 아래 홈 막대. 한 계열이라 어두운 알약 하나(범례 없이),
 * "기타"만 무채 회색. 막대는 위에서부터 21ms 간격으로 extend 스프링으로 차오르고, 글자 줄은 같은 간격으로
 * 55ms 동안 진해진다(D7 아이콘 — F82 → F86). 값은 막대 옆에 글자로 늘 보인다(툴팁에 기대지 않는다).
 */
export function WaterBarList({ items, ariaLabel, unit = '건', limit = 6, empty = '자료가 없어요' }: WaterBarListProps) {
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

  if (shown.length === 0) return <WaterEmpty title={empty} />

  return (
    <ul className="water-bar-list" aria-label={ariaLabel}>
      {shown.map((item, i) => (
        <li
          key={item.key}
          className="water-bar-list__row water-reveal"
          style={{ '--w-i': i } as CSSProperties}
          title={`${item.label} ${formatInt(item.value)}${unit}`}
        >
          <div className="water-bar-list__head">
            <span className="water-bar-list__label">{item.label}</span>
            <span className="water-bar-list__value">
              {formatInt(item.value)}
              <small>{unit}</small>
              <span className="water-bar-list__share">{Math.round((item.value / total) * 100)}%</span>
            </span>
          </div>
          <WaterBar value={item.value / max} index={i} color={item.key === '__other' ? WATER_OTHER : undefined} />
        </li>
      ))}
    </ul>
  )
}
