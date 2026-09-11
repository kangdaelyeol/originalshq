import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import '../styles/index-line-chart.scss'

export type IndexSeriesType = 'line' | 'bar'

export interface IndexSeries {
  key: string
  label: string
  color: string
  /** 'line'(꺾은선) / 'bar'(막대). 생략하면 'line'. */
  type?: IndexSeriesType
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
}

// viewBox 크기를 실제 렌더 픽셀 크기에 맞춰 1 유닛 = 1px로 둔다. 이렇게 해야 차트
// 컨테이너가 커져도(모달 "크게 보기", flex로 남는 세로 공간 채우기 등) 폰트·마커·여백
// 같은 지표 요소 크기는 그대로 유지되고, 점 사이 간격(bandW)·플롯 높이(PLOT_H)만
// 늘어난다 — 전체가 그대로 확대(zoom)되는 걸 막는다.
// 치수 측정 전(최초 렌더) 잠깐 쓰는 기본값일 뿐, 측정되는 즉시 실제 크기로 바뀐다.
const DEFAULT_VB_W = 960
const DEFAULT_VB_H = 300
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

// 막대 그룹이 한 컬럼(band)에서 차지하는 최대 폭 비율 — 컬럼이 좁아지면(카테고리가
// 많거나 차트가 작을 때) 이 비율까지 줄어든다.
const BAR_GROUP_FRAC = 0.68
// 막대 한 개의 절대 최대 폭(px) — 차트가 넓어져 컬럼(bandW)에 여유가 생겨도 막대
// 자체는 이 폭에서 더 굵어지지 않는다. 남는 공간은 막대 사이 여백으로만 쓰인다
// (폰트·마커와 같은 "절대 크기" 원칙을 막대에도 적용).
const BAR_MAX_WIDTH = 22
const BAR_FILL_OPACITY = 0.85
// 평균선은 실제 값(선/막대)보다 한눈에 옅어 보여야 배경처럼 읽힌다.
const AVG_LINE_OPACITY = 0.45

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_COLOR: Record<DeltaDir, string> = {
  up: UP,
  down: DOWN,
  flat: MUTED,
}
const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** index 지점 값과, 그 직전 지점 대비 증감(절대값·%·방향)을 계산한다.
 * 상단 고정 요약 행과 호버 툴팁이 이 계산을 공유한다. */
function computeDelta(
  raw: readonly number[],
  index: number,
): {
  rawNow: number | null
  deltaRaw: number | null
  deltaPct: number | null
  dir: DeltaDir
} {
  const rawNow = raw[index] ?? null
  const rawPrev = index > 0 ? (raw[index - 1] ?? null) : null
  const deltaRaw = rawNow != null && rawPrev != null ? rawNow - rawPrev : null
  const deltaPct =
    deltaRaw != null && rawPrev != null && rawPrev !== 0
      ? (deltaRaw / Math.abs(rawPrev)) * 100
      : null
  const dir: DeltaDir =
    deltaRaw == null || deltaRaw === 0 ? 'flat' : deltaRaw > 0 ? 'up' : 'down'
  return { rawNow, deltaRaw, deltaPct, dir }
}

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
}: IndexLineChartProps) => {
  const [hover, setHover] = useState<{
    index: number
    seriesKey: string | null
  } | null>(null)
  // 범례에 마우스를 올리면 크로스헤어/툴팁 없이 그 지표만 "포커스"한다.
  const [legendHoverKey, setLegendHoverKey] = useState<string | null>(null)
  // 캔버스(svg + 툴팁) 래퍼 — 범례는 이 밖에 둬서, 측정 대상이 순수하게 svg 영역만
  // 가리키게 한다(범례 높이가 섞여 들어가지 않도록).
  const wrapRef = useRef<HTMLDivElement>(null)
  const [vbWidth, setVbWidth] = useState(DEFAULT_VB_W)
  const [vbHeight, setVbHeight] = useState(DEFAULT_VB_H)

  // 캔버스의 실제 렌더 크기를 측정해 viewBox 크기로 그대로 쓴다(1 유닛 = 1px).
  // "크게 보기"나 flex로 남는 세로 공간을 채울 때처럼 컨테이너가 커지면 이 값이
  // 늘어나 점 간격·플롯 높이만 넓어지고, 폰트·마커 등 절대 크기로 둔 요소는
  // 영향받지 않는다.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0) setVbWidth(rect.width)
      if (rect.height > 0) setVbHeight(rect.height)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = categories.length

  // 각 지표를 자기 min~max 범위로 독립 스케일한다 — 그래야 여러 지표를 겹쳐도
  // 첫 컬럼이 한 점에 몰리지 않고 각 선이 제 변화폭만큼 펼쳐진다.
  const prepared = useMemo(
    () =>
      series.map((s) => {
        const type: IndexSeriesType = s.type ?? 'line'
        const nums = s.raw.filter((v): v is number => Number.isFinite(v))
        let range
        if (nums.length === 0) {
          range = niceRange(0, 1)
        } else {
          const lo = Math.min(...nums)
          const hi = Math.max(...nums)
          // 막대는 0 기준선을 강제한다 — 바닥이 잘린 막대는 길이 비교를 왜곡한다.
          range =
            type === 'bar' ? niceRange(Math.min(0, lo), hi) : niceRange(lo, hi)
        }
        const avg =
          nums.length === 0
            ? null
            : nums.reduce((sum, v) => sum + v, 0) / nums.length
        return { ...s, type, range, avg }
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

  const PLOT_W = vbWidth - MARGIN_LEFT - MARGIN_RIGHT
  const PLOT_H = vbHeight - MARGIN_TOP - MARGIN_BOTTOM
  const bandW = PLOT_W / n
  const xCenter = (i: number) => MARGIN_LEFT + bandW * i + bandW / 2
  const yIn = (range: { min: number; max: number }, v: number) =>
    MARGIN_TOP + PLOT_H - ((v - range.min) / (range.max - range.min)) * PLOT_H

  // 막대는 라인 뒤에 깔고, 같은 컬럼에 여러 개면 폭을 나눠 나란히 놓는다.
  const barSeries = prepared.filter((s) => s.type === 'bar')
  const lineSeries = prepared.filter((s) => s.type === 'line')
  // 컬럼에 여유가 있어도 막대 그룹은 "막대 개수 × 최대 폭"보다 넓어지지 않는다 —
  // 남는 공간은 그룹 전체를 굵게 만드는 대신 컬럼 사이 여백으로 남는다.
  const groupW = Math.min(
    bandW * BAR_GROUP_FRAC,
    barSeries.length * BAR_MAX_WIDTH,
  )
  const slotW = barSeries.length > 0 ? groupW / barSeries.length : 0
  const barSlot = new Map(barSeries.map((s, bi) => [s.key, bi]))
  const barCenterX = (key: string, i: number) => {
    const bi = barSlot.get(key) ?? 0
    return xCenter(i) - groupW / 2 + slotW * bi + slotW / 2
  }

  const labelStride = Math.max(1, Math.ceil(n / 8))

  const handlePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const xFraction = (e.clientX - rect.left) / rect.width
    const yFraction = (e.clientY - rect.top) / rect.height
    const vbX = xFraction * vbWidth
    const vbY = yFraction * vbHeight
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
  const focused = focusedKey ? prepared.find((s) => s.key === focusedKey) : null

  // 왼쪽 y축은 한 번에 하나의 지표만 라벨링한다 — 포커스된 지표, 없으면 첫 번째 지표.
  // (나머지 선은 자기 축으로 스케일되지만 눈금은 표시하지 않는다.)
  const axisSeries = focused ?? prepared[0]
  const axisColor = series.length > 1 ? axisSeries.color : MUTED

  // 상단 고정 요약 행이 가리키는 지점 — 평소엔 마지막(최신) 지점, 차트를 호버하면
  // 그 지점으로 바뀐다(증권 차트 헤더가 크로스헤어를 따라가는 것과 같은 느낌).
  const summaryIndex = hover?.index ?? n - 1

  return (
    <div className="index-line-chart">
      <div className="index-line-chart__summary">
        <span className="index-line-chart__summary-period">
          {categories[summaryIndex]}
        </span>
        {prepared.map((s) => {
          const isFocused = focused?.key === s.key
          const dimmed = focused != null && !isFocused
          const { rawNow, deltaRaw, deltaPct, dir } = computeDelta(
            s.raw,
            summaryIndex,
          )
          return (
            <span
              key={s.key}
              className="index-line-chart__summary-item"
              style={{ opacity: dimmed ? DIM_OPACITY : 1 }}
            >
              <span
                className="index-line-chart__summary-dot"
                style={{ background: s.color }}
              />
              <span className="index-line-chart__summary-name">{s.label}</span>
              <span className="index-line-chart__summary-value">
                {rawNow == null ? '—' : s.format(rawNow)}
              </span>
              {deltaRaw != null && (
                <span
                  className="index-line-chart__summary-delta"
                  style={{ color: DELTA_COLOR[dir] }}
                >
                  {DELTA_ARROW[dir]} {s.format(Math.abs(deltaRaw))}
                  {deltaPct != null &&
                    ` (${deltaRaw >= 0 ? '+' : '-'}${Math.abs(deltaPct).toFixed(1)}%)`}
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div className="index-line-chart__canvas" ref={wrapRef}>
        <svg
          className="index-line-chart__svg"
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
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
              y={vbHeight - 6}
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
                x2={vbWidth - MARGIN_RIGHT}
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
                fontSize={8}
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
                y={MARGIN_TOP + PLOT_H + 13}
                textAnchor="middle"
                fontSize={9}
                fill={MUTED}
              >
                {c}
              </text>
            ) : null,
          )}

          {/* 지표 평균선 — 실제 값(선/막대) 뒤에 옅은 점선으로 깔아 기준점처럼 보이게 한다. */}
          {prepared.map((s) => {
            if (s.avg == null) return null
            const isFocused = focused?.key === s.key
            const dimmed = focused != null && !isFocused
            const y = yIn(s.range, s.avg)
            return (
              <line
                key={`avg-${s.key}`}
                x1={MARGIN_LEFT}
                x2={vbWidth - MARGIN_RIGHT}
                y1={y}
                y2={y}
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={
                  dimmed ? DIM_OPACITY : isFocused ? 0.7 : AVG_LINE_OPACITY
                }
              />
            )
          })}

          {/* 막대 — 라인 뒤에 깔린다. 0 기준선에서 값까지 채우고, 같은 컬럼에
            여러 지표면 slotW 폭으로 나눠 나란히 놓는다. */}
          {barSeries.map((s) => {
            const isFocused = focused?.key === s.key
            const dimmed = focused != null && !isFocused
            const yBase = yIn(s.range, Math.max(s.range.min, 0))
            const w = Math.max(1, slotW - 1.5)
            return s.raw.map((v, i) => {
              if (v == null) return null
              const yv = yIn(s.range, v)
              const top = Math.min(yBase, yv)
              const h = Math.max(1, Math.abs(yBase - yv))
              return (
                <rect
                  key={`bar-${s.key}-${i}`}
                  x={barCenterX(s.key, i) - w / 2}
                  y={top}
                  width={w}
                  height={h}
                  rx={1}
                  fill={s.color}
                  opacity={dimmed ? DIM_OPACITY : BAR_FILL_OPACITY}
                />
              )
            })
          })}

          {/* 선 — 포커스된 지표만 도드라지고 나머지는 은은하게 죽는다 */}
          {lineSeries.map((s) => {
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

          {/* 마커 — 꺾은선만 */}
          {lineSeries.map((s) => {
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

          {/* 점 값 라벨 — 선택한 모든 지표의 모든 점을 표기한다. 지표마다 독립 축이라
            값이 겹칠 수 있어, 시리즈 순서에 따라 점의 위/아래로 번갈아 배치해 충돌을 줄인다. */}
          {prepared.map((s, si) => {
            const isFocused = focused?.key === s.key
            const dimmed = focused != null && !isFocused
            const isBar = s.type === 'bar'
            return s.raw.map((v, i) => {
              if (v == null) return null
              const y = yIn(s.range, v)
              const cx = isBar ? barCenterX(s.key, i) : xCenter(i)
              // 막대는 항상 막대 위. 꺾은선은 시리즈 순서로 위/아래 교대(상단 여백 넘으면 아래).
              const above = isBar || (si % 2 === 0 && y - 12 >= MARGIN_TOP)
              return (
                <text
                  key={`label-${s.key}-${i}`}
                  x={cx}
                  y={above ? (isBar ? y - 5 : y - 9) : y + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill={series.length > 1 ? s.color : MUTED}
                  stroke={SURFACE}
                  strokeWidth={3}
                  paintOrder="stroke"
                  opacity={dimmed ? DIM_OPACITY : 1}
                >
                  {s.formatCompact(v)}
                </text>
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
              left: `${(xCenter(hover.index) / vbWidth) * 100}%`,
              // 시리즈가 많으면 툴팁이 길어져서, 호버된 점 바로 위에 띄우면 위쪽(체크박스
              // 영역)을 침범할 수 있다. 그래서 항상 차트 상단에 고정하고 아래로만 자란다.
              top: `${(MARGIN_TOP / vbHeight) * 100}%`,
            }}
          >
            <div className="index-line-chart__tooltip-label">
              {categories[hover.index]}
            </div>
            {prepared.map((s) => {
              const { rawNow, deltaRaw, deltaPct, dir } = computeDelta(
                s.raw,
                hover.index,
              )

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
                        style={{ color: DELTA_COLOR[dir] }}
                      >
                        {DELTA_ARROW[dir]} {s.format(Math.abs(deltaRaw))}
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
      </div>

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
              className={`index-line-chart__legend-key${
                s.type === 'bar' ? ' is-bar' : ''
              }`}
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
