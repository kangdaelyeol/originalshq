import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import '../styles/bar-line-chart.scss'

export interface ChartPoint {
  label: string
  value: number
}

export type ChartType = 'bar' | 'line'

interface BarLineChartProps {
  points: readonly ChartPoint[]
  type: ChartType
  /** 툴팁/축 눈금에 쓰는 값 포맷터. */
  valueFormat: (v: number) => string
  color?: string
}

// viewBox 기준 좌표계 — SVG가 컨테이너 폭에 맞춰 그대로 스케일된다.
const VB_W = 720
const VB_H = 280
const MARGIN_TOP = 16
const MARGIN_RIGHT = 12
const MARGIN_BOTTOM = 30
const MARGIN_LEFT_MIN = 40

const SURFACE = '#161b22'
const GRID = '#21262d'
const MUTED = '#8b949e'

/** roughStep 이상인 가장 가까운 "깔끔한" 스텝(1/2/5 × 10^n). */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1
  const exp = Math.floor(Math.log10(roughStep))
  const base = roughStep / 10 ** exp
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return niceBase * 10 ** exp
}

/** y축 눈금 — 0부터 시작해 "깔끔한" 값으로 반올림. */
function niceTicks(max: number, count = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] }
  const step = niceStep(max / count)
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= niceMax + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000)
  }
  return { max: niceMax, ticks }
}

/** 윗변만 둥근(아래는 직각, 베이스라인에 붙는) 막대 path. */
function topRoundedRectPath(
  x: number,
  yTop: number,
  w: number,
  h: number,
  r: number,
): string {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  const yBase = yTop + h
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + rr}`,
    `Q${x},${yTop} ${x + rr},${yTop}`,
    `L${x + w - rr},${yTop}`,
    `Q${x + w},${yTop} ${x + w},${yTop + rr}`,
    `L${x + w},${yBase}`,
    'Z',
  ].join(' ')
}

export const BarLineChart = ({
  points,
  type,
  valueFormat,
  color = '#4493f8',
}: BarLineChartProps) => {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = points.length
  const maxValue = useMemo(
    () => Math.max(0, ...points.map((p) => p.value)),
    [points],
  )
  const { max: niceMax, ticks } = useMemo(() => niceTicks(maxValue), [maxValue])

  // y축 눈금 중 가장 긴 라벨 기준으로 왼쪽 여백을 넓혀 숫자가 잘리지 않게 한다
  // (예: 지출액처럼 "12,020,513"급 자릿수가 나오는 지표).
  const maxTickChars = Math.max(
    1,
    ...ticks.map((t) => t.toLocaleString().length),
  )
  const MARGIN_LEFT = Math.max(MARGIN_LEFT_MIN, 16 + maxTickChars * 6.5)
  const PLOT_W = VB_W - MARGIN_LEFT - MARGIN_RIGHT
  const PLOT_H = VB_H - MARGIN_TOP - MARGIN_BOTTOM

  if (n === 0) {
    return (
      <div className="bar-line-chart bar-line-chart--empty">데이터 없음</div>
    )
  }

  const bandW = PLOT_W / n
  const xCenter = (i: number) => MARGIN_LEFT + bandW * i + bandW / 2
  const yFor = (v: number) => MARGIN_TOP + PLOT_H - (v / niceMax) * PLOT_H

  // x축 라벨이 너무 촘촘하면 겹치지 않도록 일부만 표시.
  const labelStride = Math.max(1, Math.ceil(n / 8))

  const pickIndexFromClientX = (clientX: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const fraction = (clientX - rect.left) / rect.width
    const vbX = fraction * VB_W
    const i = Math.round((vbX - MARGIN_LEFT - bandW / 2) / bandW)
    return Math.min(n - 1, Math.max(0, i))
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    setHover(pickIndexFromClientX(e.clientX))
  }

  const linePath =
    type === 'line'
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${xCenter(i)},${yFor(p.value)}`)
          .join(' ')
      : ''

  const hoverPoint = hover != null ? points[hover] : null

  return (
    <div className="bar-line-chart" ref={wrapRef}>
      <svg
        className="bar-line-chart__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="성과 그래프"
      >
        {/* 그리드 + y축 눈금 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN_LEFT}
              x2={VB_W - MARGIN_RIGHT}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={MARGIN_LEFT - 8}
              y={yFor(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={MUTED}
            >
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {/* x축 라벨 */}
        {points.map((p, i) =>
          i % labelStride === 0 || i === n - 1 ? (
            <text
              key={`x-${i}`}
              x={xCenter(i)}
              y={MARGIN_TOP + PLOT_H + 18}
              textAnchor="middle"
              fontSize={10}
              fill={MUTED}
            >
              {p.label}
            </text>
          ) : null,
        )}

        {/* 막대 / 선 */}
        {type === 'bar' ? (
          points.map((p, i) => {
            const barW = Math.min(24, bandW * 0.6)
            const x = xCenter(i) - barW / 2
            const yTop = yFor(p.value)
            const h = MARGIN_TOP + PLOT_H - yTop
            return (
              <path
                key={i}
                d={topRoundedRectPath(x, yTop, barW, h, 4)}
                fill={color}
                opacity={hover === i ? 1 : 0.85}
              />
            )
          })
        ) : (
          <>
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={xCenter(i)}
                  cy={yFor(p.value)}
                  r={7}
                  fill={SURFACE}
                />
                <circle
                  cx={xCenter(i)}
                  cy={yFor(p.value)}
                  r={hover === i ? 6 : 5}
                  fill={color}
                />
              </g>
            ))}
          </>
        )}

        {/* 크로스헤어 (선 그래프에서만) */}
        {type === 'line' && hover != null && (
          <line
            x1={xCenter(hover)}
            x2={xCenter(hover)}
            y1={MARGIN_TOP}
            y2={MARGIN_TOP + PLOT_H}
            stroke={GRID}
            strokeWidth={1}
          />
        )}

        {/* 히트 타깃 */}
        {type === 'bar' ? (
          points.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={MARGIN_LEFT + bandW * i}
              y={MARGIN_TOP}
              width={bandW}
              height={PLOT_H}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))
        ) : (
          <rect
            x={MARGIN_LEFT}
            y={MARGIN_TOP}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
          />
        )}
      </svg>

      {hoverPoint && hover != null && (
        <div
          className="bar-line-chart__tooltip"
          style={{
            left: `${(xCenter(hover) / VB_W) * 100}%`,
            top: `${(yFor(hoverPoint.value) / VB_H) * 100}%`,
          }}
        >
          <span className="bar-line-chart__tooltip-label">
            {hoverPoint.label}
          </span>
          <span className="bar-line-chart__tooltip-value">
            {valueFormat(hoverPoint.value)}
          </span>
        </div>
      )}
    </div>
  )
}
