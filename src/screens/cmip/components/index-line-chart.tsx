import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import '../styles/index-line-chart.scss'

export interface IndexSeries {
  key: string
  label: string
  color: string
  /** 그래프 좌상단 단위 표기용("지표명(단위)"). */
  unit: string
  /** 카테고리(x) 순서에 맞춘 원본 값. */
  raw: readonly number[]
  /** 툴팁에 원본 값을 보여줄 때 쓰는 포맷터(단위 포함). */
  format: (v: number) => string
  /** y축 눈금용 — 단위 없이 간결하게. */
  formatCompact: (v: number) => string
}

interface IndexLineChartProps {
  categories: readonly string[]
  series: readonly IndexSeries[]
  xAxisLabel?: string
  /** 툴팁의 "이전 대비" 문구 — 뷰에 맞게 부모가 지정(예: '전일 대비', '전주 대비'). */
  deltaLabel?: string
}

// viewBox 기준 좌표계 — SVG가 컨테이너 폭에 맞춰 그대로 스케일된다.
const VB_W = 720
const VB_H = 300
const MARGIN_TOP = 30
const MARGIN_RIGHT = 16
const MARGIN_BOTTOM = 44
// 지표별 독립 축이라 눈금 라벨이 실제 값(원/회 등)으로 길어질 수 있어 여유를 둔다.
const MARGIN_LEFT = 64

const SURFACE = '#161b22'
const GRID = '#21262d'
const MUTED = '#8b949e'
const UP = '#3fb950'
const DOWN = '#ff7b72'

const DIM_OPACITY = 0.22

/** roughStep 이상인 가장 가까운 "깔끔한" 스텝(1/2/5 × 10^n). */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1
  const exp = Math.floor(Math.log10(roughStep))
  const base = roughStep / 10 ** exp
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return niceBase * 10 ** exp
}

/**
 * 한 지표의 값 범위를 감싸는 "깔끔한" y축 구간. 0을 강제하지 않는다 — 지표별 독립 축의
 * 목적이 각 선을 자기 변화폭만큼 플롯 높이에 펼쳐 보는 것이라, 0부터 그리면 그 변화가
 * 눌려 보인다. 다만 값이 모두 0 이상인데 패딩 때문에 하한이 음수로 내려가면 0으로 자른다.
 */
function niceRange(
  minV: number,
  maxV: number,
  count = 5,
): { min: number; max: number; ticks: number[] } {
  let lo = minV
  let hi = maxV
  if (lo === hi) {
    const spread = Math.abs(lo) * 0.1 || 1
    lo -= spread
    hi += spread
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const step = niceStep((hi - lo) / count)
  let niceMin = Math.floor(lo / step) * step
  const niceMax = Math.ceil(hi / step) * step
  if (minV >= 0 && niceMin < 0) niceMin = 0
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000)
  }
  return { min: niceMin, max: niceMax, ticks }
}

/** null(빠진 값) 구간을 건너뛰며 이어진 구간마다 별도 서브패스를 그리는 라인 path. */
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
  deltaLabel = '이전 대비',
}: IndexLineChartProps) => {
  const [hover, setHover] = useState<{
    index: number
    seriesKey: string | null
  } | null>(null)
  // 범례에 마우스를 올리면 크로스헤어/툴팁 없이 그 지표만 "포커스"한다.
  const [legendHoverKey, setLegendHoverKey] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = categories.length

  // 각 지표를 자기 min~max 범위로 독립 스케일한다 — 그래야 여러 지표를 겹쳐도
  // 첫 컬럼이 한 점에 몰리지 않고 각 선이 제 변화폭만큼 펼쳐진다.
  const prepared = useMemo(
    () =>
      series.map((s) => {
        const nums = s.raw.filter((v): v is number => Number.isFinite(v))
        const range =
          nums.length === 0
            ? niceRange(0, 1)
            : niceRange(Math.min(...nums), Math.max(...nums))
        return { ...s, range }
      }),
    [series],
  )

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
  const yIn = (range: { min: number; max: number }, v: number) =>
    MARGIN_TOP + PLOT_H - ((v - range.min) / (range.max - range.min)) * PLOT_H

  const labelStride = Math.max(1, Math.ceil(n / 8))

  const handlePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const xFraction = (e.clientX - rect.left) / rect.width
    const yFraction = (e.clientY - rect.top) / rect.height
    const vbX = xFraction * VB_W
    const vbY = yFraction * VB_H
    const index = Math.min(
      n - 1,
      Math.max(0, Math.round((vbX - MARGIN_LEFT - bandW / 2) / bandW)),
    )

    // 포인터에서 세로로 가장 가까운 선을 "포커스"할 지표로 고른다(각 선의 독립 축 기준).
    let seriesKey: string | null = null
    let nearestDist = Infinity
    for (const s of prepared) {
      const v = s.raw[index]
      if (v == null) continue
      const d = Math.abs(yIn(s.range, v) - vbY)
      if (d < nearestDist) {
        nearestDist = d
        seriesKey = s.key
      }
    }
    setHover({ index, seriesKey })
  }

  // 크로스헤어로 잡힌 선이 우선이고, 없으면 범례 호버로 지정한 지표를 포커스한다.
  const focusedKey = hover?.seriesKey ?? legendHoverKey
  const focused = focusedKey
    ? prepared.find((s) => s.key === focusedKey)
    : null

  // 왼쪽 y축은 한 번에 하나의 지표만 라벨링한다 — 포커스된 지표, 없으면 첫 번째 지표.
  // (나머지 선은 자기 축으로 스케일되지만 눈금은 표시하지 않는다.)
  const axisSeries = focused ?? prepared[0]
  const axisColor = series.length > 1 ? axisSeries.color : MUTED

  return (
    <div className="index-line-chart" ref={wrapRef}>
      <svg
        className="index-line-chart__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="지표 비교 그래프"
      >
        <text x={4} y={14} textAnchor="start" fontSize={10} fill={axisColor}>
          {series.length > 1
            ? `${axisSeries.label} (${axisSeries.unit})`
            : `${axisSeries.label} (${axisSeries.unit})`}
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

        {/* 그리드 + y축 눈금 — 라벨링 중인 지표(axisSeries)의 실제값 기준 */}
        {axisSeries.range.ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN_LEFT}
              x2={VB_W - MARGIN_RIGHT}
              y1={yIn(axisSeries.range, t)}
              y2={yIn(axisSeries.range, t)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={MARGIN_LEFT - 8}
              y={yIn(axisSeries.range, t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={axisColor}
            >
              {axisSeries.formatCompact(t)}
            </text>
          </g>
        ))}

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

        {/* 선 — 포커스된 지표만 도드라지고 나머지는 은은하게 죽는다 */}
        {prepared.map((s) => {
          const isFocused = focused?.key === s.key
          const dimmed = focused != null && !isFocused
          return (
            <path
              key={s.key}
              d={buildLinePath(s.raw, xCenter, (v) => yIn(s.range, v))}
              fill="none"
              stroke={s.color}
              strokeWidth={isFocused ? 3 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={dimmed ? DIM_OPACITY : 1}
            />
          )
        })}

        {/* 마커 */}
        {prepared.map((s) => {
          const isFocused = focused?.key === s.key
          const dimmed = focused != null && !isFocused
          return s.raw.map((v, i) => {
            if (v == null) return null
            const isHoverX = hover?.index === i
            return (
              <g key={`${s.key}-${i}`} opacity={dimmed ? DIM_OPACITY : 1}>
                <circle
                  cx={xCenter(i)}
                  cy={yIn(s.range, v)}
                  r={isHoverX ? 6 : 5}
                  fill={SURFACE}
                />
                <circle
                  cx={xCenter(i)}
                  cy={yIn(s.range, v)}
                  r={isHoverX ? 4.5 : 3.5}
                  fill={s.color}
                />
              </g>
            )
          })
        })}

        {/* 크로스헤어 */}
        {hover != null && (
          <line
            x1={xCenter(hover.index)}
            x2={xCenter(hover.index)}
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

      {hover != null && (
        <div
          className={`index-line-chart__tooltip is-align-${
            n <= 1
              ? 'center'
              : hover.index / (n - 1) < 0.15
                ? 'left'
                : hover.index / (n - 1) > 0.85
                  ? 'right'
                  : 'center'
          }`}
          style={{
            left: `${(xCenter(hover.index) / VB_W) * 100}%`,
            // 시리즈가 많으면 툴팁이 길어져서, 호버된 점 바로 위에 띄우면 위쪽(체크박스
            // 영역)을 침범할 수 있다. 그래서 항상 차트 상단에 고정하고 아래로만 자란다.
            top: `${(MARGIN_TOP / VB_H) * 100}%`,
          }}
        >
          <div className="index-line-chart__tooltip-label">
            {categories[hover.index]} · {deltaLabel}
          </div>
          {prepared.map((s) => {
            const rawNow = s.raw[hover.index]
            const rawPrev = hover.index > 0 ? s.raw[hover.index - 1] : null
            const deltaRaw = rawPrev != null ? rawNow - rawPrev : null
            const deltaPct =
              deltaRaw != null && rawPrev != null && rawPrev !== 0
                ? (deltaRaw / Math.abs(rawPrev)) * 100
                : null
            const deltaDir =
              deltaRaw == null || deltaRaw === 0
                ? 'flat'
                : deltaRaw > 0
                  ? 'up'
                  : 'down'
            const deltaColor =
              deltaDir === 'up' ? UP : deltaDir === 'down' ? DOWN : MUTED

            return (
              <div
                key={s.key}
                className={`index-line-chart__tooltip-row${
                  focused?.key === s.key
                    ? ' is-focused'
                    : focused
                      ? ' is-dimmed'
                      : ''
                }`}
              >
                <span
                  className="index-line-chart__tooltip-key"
                  style={{ background: s.color }}
                />
                <span className="index-line-chart__tooltip-name">
                  {s.label}
                </span>
                <span className="index-line-chart__tooltip-values">
                  <span className="index-line-chart__tooltip-value">
                    {rawNow == null ? '—' : s.format(rawNow)}
                  </span>
                  {deltaRaw != null && (
                    <span
                      className="index-line-chart__tooltip-delta"
                      style={{ color: deltaColor }}
                    >
                      {deltaDir === 'up'
                        ? '▲'
                        : deltaDir === 'down'
                          ? '▼'
                          : '—'}{' '}
                      {s.format(Math.abs(deltaRaw))}
                      {deltaPct != null &&
                        ` (${deltaRaw >= 0 ? '+' : '-'}${Math.abs(deltaPct).toFixed(1)}%)`}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="index-line-chart__legend">
        {series.map((s) => (
          <span
            key={s.key}
            className={`index-line-chart__legend-item${
              focused?.key === s.key ? ' is-focused' : ''
            }`}
            onPointerEnter={() => setLegendHoverKey(s.key)}
            onPointerLeave={() => setLegendHoverKey(null)}
          >
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
