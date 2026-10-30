import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { compact, formatInt } from '../../lib/format'
import { useElementSize } from '../../lib/use-element-size'
import { monotonePath, niceTicks } from './chart-utils'
import { CHART_SURFACE } from './palette'

export interface ChartSeries {
  key: string
  label: string
  color: string
  values: readonly number[]
}

interface AreaChartProps {
  labels: readonly string[]
  series: readonly ChartSeries[]
  ariaLabel: string
  /** 그림 + x축 글자 띠까지 포함한 전체 높이 — 축 글자가 카드 밖으로 밀리지 않게. */
  height?: number
  /** 개수처럼 정수만 있는 값이면 눈금도 정수로. */
  integer?: boolean
  /** y축 눈금 표기 */
  formatTick?: (value: number) => string
  /** 툴팁·표 보기의 값 표기 */
  formatValue?: (value: number) => string
}

const PAD = { top: 12, right: 14, bottom: 30, left: 44 }
// x축 글자 사이 최소 간격 — 칸이 많으면(30일 등) 이 간격이 되게 건너뛰며 찍는다.
const MIN_LABEL_GAP = 54
// 칸이 이보다 많으면 모든 점 대신 마지막 점과 hover 점만 그린다.
const MAX_DOTS = 14

/** 샘플 영상의 "빛나는 선 + 아래로 옅어지는 면" 차트. 같은 축(한 개의 y축)에 계열을
 * 여러 개 겹칠 수 있고, hover·키보드(←/→)로 세로 기준선과 툴팁이 따라간다. */
export function AreaChart({
  labels,
  series,
  ariaLabel,
  height = 240,
  integer = false,
  formatTick = compact,
  formatValue = formatInt,
}: AreaChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [containerRef, { width }] = useElementSize<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const n = labels.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const baseY = PAD.top + plotH
  const ticks = niceTicks(Math.max(0, ...series.flatMap((s) => s.values)), 4, integer)
  const top = ticks[ticks.length - 1]
  const xAt = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const yAt = (v: number) => PAD.top + plotH - (v / top) * plotH

  // 오른쪽 끝(가장 최근) 글자는 늘 보이게 끝에서부터 같은 간격으로 고른다.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / MIN_LABEL_GAP))))
  const showAllDots = n <= MAX_DOTS

  const indexAt = (offsetX: number) => {
    if (n <= 1 || plotW <= 0) return 0
    const ratio = (offsetX - PAD.left) / plotW
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    setActive(indexAt(e.clientX - e.currentTarget.getBoundingClientRect().left))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? n - 1
    const next =
      e.key === 'ArrowLeft' ? current - 1
      : e.key === 'ArrowRight' ? current + 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : null
    if (next === null) return
    e.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, next)))
  }

  const activeX = active === null ? 0 : xAt(active)
  // 툴팁이 카드 밖으로 나가지 않게 — 오른쪽 1/3에서는 왼쪽으로, 왼쪽 1/3에서는 오른쪽으로 편다.
  const tooltipShift = activeX > width * 0.66 ? 'calc(-100% - 14px)' : activeX < width * 0.34 ? '14px' : '-50%'

  return (
    <div
      ref={containerRef}
      className="area-chart"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel} — 좌우 화살표로 값을 볼 수 있어요`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? n - 1)}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          className="area-chart__svg"
          width={width}
          height={height}
          aria-hidden
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <filter id={`${uid}-glow`} x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="area-chart__grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} />
                <text x={PAD.left - 10} y={yAt(t)} dy="0.32em" textAnchor="end">
                  {formatTick(t)}
                </text>
              </g>
            ))}
          </g>

          <g className="area-chart__x">
            {labels.map((label, i) =>
              (n - 1 - i) % labelEvery === 0 ? (
                <text key={`${label}-${i}`} x={xAt(i)} y={height - 8} textAnchor="middle">
                  {label}
                </text>
              ) : null,
            )}
          </g>

          {series.map((s) => {
            const line = monotonePath(s.values.map((v, i) => [xAt(i), yAt(v)] as const))
            return (
              <path
                key={`area-${s.key}`}
                d={`${line} L${xAt(n - 1)},${baseY} L${xAt(0)},${baseY} Z`}
                fill={`url(#${uid}-fill-${s.key})`}
              />
            )
          })}

          {active !== null && (
            <line className="area-chart__crosshair" x1={activeX} x2={activeX} y1={PAD.top} y2={baseY} />
          )}

          <g filter={`url(#${uid}-glow)`}>
            {series.map((s) => (
              <path
                key={`line-${s.key}`}
                d={monotonePath(s.values.map((v, i) => [xAt(i), yAt(v)] as const))}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {series.map((s) =>
              s.values.map((v, i) =>
                showAllDots || i === active || i === n - 1 ? (
                  <circle
                    key={`dot-${s.key}-${i}`}
                    className="area-chart__dot"
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={i === active ? 5.5 : 4}
                    fill={s.color}
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                  />
                ) : null,
              ),
            )}
          </g>
        </svg>
      )}

      {active !== null && width > 0 && (
        <div className="chart-tooltip" style={{ left: activeX, top: PAD.top, transform: `translateX(${tooltipShift})` }}>
          <p className="chart-tooltip__label">{labels[active]}</p>
          {series.map((s) => (
            <p key={s.key} className="chart-tooltip__row">
              <span className="line-key" style={{ background: s.color }} aria-hidden />
              <strong>{formatValue(s.values[active])}</strong>
              <span>{s.label}</span>
            </p>
          ))}
        </div>
      )}

      {/* 표 보기 — 화면 낭독기용(툴팁 없이도 모든 값을 읽을 수 있게). */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">구간</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}`}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(s.values[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
