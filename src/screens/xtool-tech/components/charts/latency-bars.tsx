import { StatusPill } from '../ui/status-pill'
import { SERIES_PRIMARY, STATUS_WARN } from './palette'

interface LatencyRow {
  key: string
  label: string
  value: number
}

interface LatencyBarsProps {
  rows: readonly LatencyRow[]
  /** 목표선 — 넘으면 막대가 주의 색 + "목표 초과" 라벨. */
  target: number
  /** 막대 100% 기준 값 */
  scale: number
  unit?: string
}

/** 가로 막대(값은 막대 끝 대신 줄 오른쪽에 바로 적는다) + 목표선. */
export function LatencyBars({ rows, target, scale, unit = 'ms' }: LatencyBarsProps) {
  const targetPct = (target / scale) * 100
  return (
    <ul className="bars">
      {rows.map((row) => {
        const over = row.value > target
        return (
          <li key={row.key} className="bars__row">
            <div className="bars__meta">
              <span className="bars__label">{row.label}</span>
              <span className="bars__value">
                {over && <StatusPill tone="warn">목표 초과</StatusPill>}
                {row.value}
                {unit}
              </span>
            </div>
            <div className="bars__track" role="img" aria-label={`${row.label} ${row.value}${unit}${over ? ', 목표 초과' : ''}`}>
              <span
                className="bars__fill"
                style={{
                  width: `${Math.min(100, (row.value / scale) * 100)}%`,
                  background: over ? STATUS_WARN : SERIES_PRIMARY,
                }}
              />
              <span className="bars__target" style={{ left: `${targetPct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
