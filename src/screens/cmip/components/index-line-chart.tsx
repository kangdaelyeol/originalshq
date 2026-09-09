import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import '../styles/index-line-chart.scss'

export interface IndexSeries {
  key: string
  label: string
  color: string
  /** 카테고리(x) 순서에 맞춘 원본 값. */
  raw: readonly number[]
  /** 툴팁에 원본 값을 보여줄 때 쓰는 포맷터(단위 포함). */
  format: (v: number) => string
}

interface IndexLineChartProps {
  categories: readonly string[]
  series: readonly IndexSeries[]
  xAxisLabel?: string
}

// viewBox 기준 좌표계 — SVG가 컨테이너 폭에 맞춰 그대로 스케일된다.
const VB_W = 720
const VB_H = 300
const MARGIN_TOP = 30
const MARGIN_RIGHT = 16
const MARGIN_BOTTOM = 44
const MARGIN_LEFT = 46 // 지수값은 대개 두세 자리라 고정폭으로 충분

const SURFACE = '#161b22'
const GRID = '#21262d'
const MUTED = '#8b949e'
const REFERENCE = '#484f58'

/** roughStep 이상인 가장 가까운 "깔끔한" 스텝(1/2/5 × 10^n). */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1
  const exp = Math.floor(Math.log10(roughStep))
  const base = roughStep / 10 ** exp
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return niceBase * 10 ** exp
}

/** 데이터 범위 + 기준선(100)을 모두 포함하는 "깔끔한" y축 구간. 0을 강제하지 않는다 —
 * 지수는 100 근방의 변화를 보는 게 목적이라 0부터 그리면 그 변화가 눌려 보인다. */
function niceRange(
  minV: number,
  maxV: number,
  count = 5,
): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(minV, 100)
  let hi = Math.max(maxV, 100)
  if (lo === hi) {
    lo -= 10
    hi += 10
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const step = niceStep((hi - lo) / count)
  const niceMin = Math.floor(lo / step) * step
  const niceMax = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000)
  }
  return { min: niceMin, max: niceMax, ticks }
}

/**
 * raw 값을 "첫 유효값 = 100" 기준 지수로 바꾼다. 선행 값이 0이라 기준으로 못 쓰면
 * 그 구간은 계산 불가(null)로 두고, 이후 첫 0이 아닌 값부터 지수화한다.
 */
function toIndexSeries(raw: readonly number[]): (number | null)[] {
  const baseIdx = raw.findIndex((v) => v !== 0)
  if (baseIdx === -1) return raw.map(() => 100) // 전부 0이면 변화 없음(100)으로 처리
  const base = raw[baseIdx]
  return raw.map((v, i) => (i < baseIdx ? null : (v / base) * 100))
}

/** null(계산 불가 구간)을 건너뛰며 이어진 구간마다 별도 서브패스를 그리는 라인 path. */
function buildLinePath(
  values: readonly (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  const parts: string[] = []
  let drawing = false
  values.forEach((v, i) => {
    if (v == null) {
      drawing = false
      return
    }
    parts.push(`${drawing ? 'L' : 'M'}${xAt(i)},${yAt(v)}`)
    drawing = true
  })
  return parts.join(' ')
}

export const IndexLineChart = ({
  categories,
  series,
  xAxisLabel,
}: IndexLineChartProps) => {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = categories.length

  const indexed = useMemo(
    () => series.map((s) => ({ ...s, index: toIndexSeries(s.raw) })),
    [series],
  )

  const { min: niceMin, max: niceMax, ticks } = useMemo(() => {
    const values = indexed.flatMap((s) =>
      s.index.filter((v): v is number => v != null),
    )
    if (values.length === 0) return niceRange(0, 200)
    return niceRange(Math.min(...values), Math.max(...values))
  }, [indexed])

  if (n === 0 || series.length === 0) {
    return (
      <div className="index-line-chart index-line-chart--empty">
        지표를 선택하면 그래프가 표시됩니다.
      </div>
    )
  }

  const PLOT_W = VB_W - MARGIN_LEFT - MARGIN_RIGHT
  const PLOT_H = VB_H - MARGIN_TOP - MARGIN_BOTTOM
  const bandW = PLOT_W / n
  const xCenter = (i: number) => MARGIN_LEFT + bandW * i + bandW / 2
  const yFor = (v: number) =>
    MARGIN_TOP + PLOT_H - ((v - niceMin) / (niceMax - niceMin)) * PLOT_H

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

  // 툴팁은 호버된 x에서 가장 높이 있는(가장 작은 y) 점 바로 위에 띄운다.
  const hoverTopY =
    hover != null
      ? Math.min(
          ...indexed.map((s) =>
            s.index[hover] != null ? yFor(s.index[hover] as number) : Infinity,
          ),
        )
      : null

  return (
    <div className="index-line-chart" ref={wrapRef}>
      <svg
        className="index-line-chart__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="지표 비교 그래프 (지수)"
      >
        <text x={4} y={14} textAnchor="start" fontSize={10} fill={MUTED}>
          (지수, 시작일=100)
        </text>
        {xAxisLabel && (
          <text
            x={MARGIN_LEFT + PLOT_W / 2}
            y={VB_H - 6}
            textAnchor="middle"
            fontSize={10}
            fill={MUTED}
          >
            {xAxisLabel}
          </text>
        )}

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

        {/* 기준선(100) — 점선으로 다른 그리드와 구분 */}
        <line
          x1={MARGIN_LEFT}
          x2={VB_W - MARGIN_RIGHT}
          y1={yFor(100)}
          y2={yFor(100)}
          stroke={REFERENCE}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* x축 라벨 */}
        {categories.map((c, i) =>
          i % labelStride === 0 || i === n - 1 ? (
            <text
              key={`x-${i}`}
              x={xCenter(i)}
              y={MARGIN_TOP + PLOT_H + 18}
              textAnchor="middle"
              fontSize={10}
              fill={MUTED}
            >
              {c}
            </text>
          ) : null,
        )}

        {/* 선 */}
        {indexed.map((s) => (
          <path
            key={s.key}
            d={buildLinePath(s.index, xCenter, yFor)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* 마커 */}
        {indexed.map((s) =>
          s.index.map((v, i) => {
            if (v == null) return null
            const isHover = hover === i
            return (
              <g key={`${s.key}-${i}`}>
                <circle
                  cx={xCenter(i)}
                  cy={yFor(v)}
                  r={isHover ? 6 : 5}
                  fill={SURFACE}
                />
                <circle
                  cx={xCenter(i)}
                  cy={yFor(v)}
                  r={isHover ? 4.5 : 3.5}
                  fill={s.color}
                />
              </g>
            )
          }),
        )}

        {/* 크로스헤어 */}
        {hover != null && (
          <line
            x1={xCenter(hover)}
            x2={xCenter(hover)}
            y1={MARGIN_TOP}
            y2={MARGIN_TOP + PLOT_H}
            stroke={GRID}
            strokeWidth={1}
          />
        )}

        {/* 히트 타깃 — 전체 시리즈가 x를 공유하므로 영역 하나로 처리 */}
        <rect
          x={MARGIN_LEFT}
          y={MARGIN_TOP}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hover != null && hoverTopY != null && (
        <div
          className="index-line-chart__tooltip"
          style={{
            left: `${(xCenter(hover) / VB_W) * 100}%`,
            top: `${(Math.max(hoverTopY - 8, MARGIN_TOP) / VB_H) * 100}%`,
          }}
        >
          <div className="index-line-chart__tooltip-label">
            {categories[hover]}
          </div>
          {indexed.map((s) => {
            const v = s.index[hover]
            return (
              <div key={s.key} className="index-line-chart__tooltip-row">
                <span
                  className="index-line-chart__tooltip-key"
                  style={{ background: s.color }}
                />
                <span className="index-line-chart__tooltip-name">
                  {s.label}
                </span>
                <span className="index-line-chart__tooltip-value">
                  {v == null ? '—' : `${s.format(s.raw[hover])} (${v.toFixed(1)})`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="index-line-chart__legend">
        {series.map((s) => (
          <span key={s.key} className="index-line-chart__legend-item">
            <span
              className="index-line-chart__legend-key"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
