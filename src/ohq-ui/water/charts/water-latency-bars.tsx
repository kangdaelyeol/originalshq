import type { CSSProperties } from 'react'
import { WaterFlag } from '../surfaces/water-flag'
import { WATER_STATUS_WARN } from './palette'
import { WaterBar } from './water-bar'

interface LatencyRow {
  key: string
  label: string
  value: number
}

interface WaterLatencyBarsProps {
  rows: readonly LatencyRow[]
  /** 목표선 — 넘으면 막대가 주의 색 + "목표 초과" 표시 */
  target: number
  /** 막대 100% 기준 값 */
  scale: number
  unit?: string
}

/**
 * 목표선이 있는 가로 막대(D7) — LatencyBars와 같은 props. 홈 막대 위에 흰 목표선(D7 흰 테두리처럼 — 홈과 어두운
 * 채움 어느 쪽 위에서도 보이게 가장자리에 옅은 어두운 선). 넘은 막대는 주의 색 채움 + "목표 초과" 표시(색만으로
 * 말하지 않는다). 값은 줄 오른쪽에 글자로.
 */
export function WaterLatencyBars({ rows, target, scale, unit = 'ms' }: WaterLatencyBarsProps) {
  const targetPct = Math.min(100, (target / scale) * 100)
  return (
    <ul className="water-latency">
      {rows.map((row, i) => {
        const over = row.value > target
        return (
          <li key={row.key} className="water-latency__row water-reveal" style={{ '--w-i': i } as CSSProperties}>
            <div className="water-latency__meta">
              <span className="water-latency__label">{row.label}</span>
              <span className="water-latency__value">
                {over && <WaterFlag tone="warn">목표 초과</WaterFlag>}
                {row.value}
                {unit}
              </span>
            </div>
            <WaterBar
              value={Math.min(1, row.value / scale)}
              index={i}
              color={over ? WATER_STATUS_WARN : undefined}
              label={`${row.label} ${row.value}${unit}${over ? ', 목표 초과' : ''}`}
            >
              <span className="water-bar__target" style={{ left: `${targetPct}%` }} />
            </WaterBar>
          </li>
        )
      })}
    </ul>
  )
}
