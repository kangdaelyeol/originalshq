import { useState } from 'react'
import { cx } from '../../lib/cx'
import { formatInt, percentages } from '../../lib/format'

export interface DonutSegment {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: readonly DonutSegment[]
  ariaLabel: string
  /** 범례 개수 뒤에 붙는 단위(예: 건) */
  unit?: string
  size?: number
  thickness?: number
}

// 조각 사이 틈(호 길이 px) — 테두리를 긋지 않고 표면색 틈으로 나눈다.
const GAP = 3
// hover 시 굵어지는 만큼(양쪽 합) — 굵어져도 SVG 밖으로 잘리지 않게 반지름에서 미리 뺀다.
const GROW = 4

/** 부분 ↔ 전체 비중 도넛. 가운데 글자는 hover(또는 범례 포커스)한 조각을, 아니면
 * 첫 조각(가장 큰 항목)을 보여준다 — 샘플의 "54% SMS OTP" 자리. */
export function DonutChart({ segments, ariaLabel, unit = '', size = 148, thickness = 13 }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const pcts = percentages(segments.map((s) => s.value))
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const center = size / 2
  const r = (size - thickness - GROW) / 2
  const circumference = 2 * Math.PI * r
  const lengths = segments.map((s) => (total > 0 ? (s.value / total) * circumference : 0))
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, l) => sum + l, 0))
  const focusIndex = Math.max(0, segments.findIndex((s) => s.key === hovered))

  return (
    <div className="donut">
      <div className="donut__figure" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
          <circle className="donut__track" cx={center} cy={center} r={r} strokeWidth={thickness} />
          <g transform={`rotate(-90 ${center} ${center})`}>
            {segments.map((s, i) => {
              const dash = Math.max(0, lengths[i] - GAP)
              return (
                <circle
                  key={s.key}
                  className={cx('donut__arc', hovered !== null && hovered !== s.key && 'is-dimmed')}
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.key ? thickness + GROW : thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-(starts[i] + GAP / 2)}
                  onPointerEnter={() => setHovered(s.key)}
                  onPointerLeave={() => setHovered(null)}
                />
              )
            })}
          </g>
        </svg>
        {segments.length > 0 && (
          <div className="donut__center" aria-hidden>
            <strong>{pcts[focusIndex]}%</strong>
            <span>{segments[focusIndex].label}</span>
          </div>
        )}
      </div>

      <ul className="legend">
        {segments.map((s, i) => (
          <li
            key={s.key}
            className={cx('legend__row', hovered === s.key && 'is-active')}
            tabIndex={0}
            onPointerEnter={() => setHovered(s.key)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(s.key)}
            onBlur={() => setHovered(null)}
          >
            <span className="legend__swatch" style={{ background: s.color }} aria-hidden />
            <span className="legend__label">{s.label}</span>
            <span className="legend__value">
              {pcts[i]}%
              <span className="legend__count">
                {' '}
                ({formatInt(s.value)}
                {unit})
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
