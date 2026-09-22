import type { PointerEvent as ReactPointerEvent } from 'react'
import { useIndexLineChartViewModel } from '../view-model/use-index-line-chart-view-model'
import type { IndexSeries, ChartTheme, CompareMode } from './index-line-chart-types'
import '../styles/index-line-chart.scss'

export type { IndexSeriesType, IndexSeries, ChartTheme, CompareMode } from './index-line-chart-types'

interface IndexLineChartProps {
  categories: readonly string[]
  series: readonly IndexSeries[]
  xAxisLabel?: string
  /** 배경·격자·보조 텍스트 색 테마. 기본 'dark'. 겹쳐 보이는 시리즈가 많을 때
   * 같은 색 계열의 어두운 쪽 명도가 다크 배경에 묻힐 수 있어 라이트도 지원한다. */
  theme?: ChartTheme
  /** 기본 'off'. */
  compareMode?: CompareMode
}

const MARGIN_TOP = 30
const MARGIN_RIGHT = 16
const MARGIN_BOTTOM = 44
// 지표별 독립 축이라 눈금 라벨이 실제 값(원/회 등)으로 길어질 수 있어 여유를 둔다.
// spend처럼 억 단위까지 올라가는 지표는 쉼표 포함 10자리 안팎이라, 64px로는
// 라벨이 플롯 밖(x<0)으로 잘려 나간다 — 그 경우까지 안 잘리도록 더 넉넉히 둔다.
const MARGIN_LEFT = 84

// 다크/라이트 2세트 — 둘 다 기존 다크(GitHub Dimmed)와 짝을 이루는 GitHub Light
// 톤이라 나머지 UI(모달 등)의 다크 팔레트와 위화감이 없다.
const PALETTE: Record<
  ChartTheme,
  { surface: string; grid: string; muted: string; up: string; down: string }
> = {
  dark: {
    surface: '#161b22',
    grid: '#21262d',
    muted: '#d0d5dc',
    up: '#3fb950',
    down: '#ff7b72',
  },
  light: {
    surface: '#ffffff',
    grid: '#eaeef2',
    muted: '#656d76',
    up: '#1a7f37',
    down: '#cf222e',
  },
}

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

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** index 지점 값과, refIndex 지점 값 대비 증감(절대값·%·방향)을 계산한다.
 * refIndex가 null이면(비교 대상 없음) delta도 전부 null. 호버 툴팁(직전 지점 대비)과
 * "대비 표시" on-chart 라벨(직전 지점 대비/최근일 대비)이 이 계산을 공유한다. */
function computeDelta(
  raw: readonly number[],
  index: number,
  refIndex: number | null,
): {
  rawNow: number | null
  deltaRaw: number | null
  deltaPct: number | null
  dir: DeltaDir
} {
  const rawNow = raw[index] ?? null
  const rawRef = refIndex != null ? (raw[refIndex] ?? null) : null
  const deltaRaw = rawNow != null && rawRef != null ? rawNow - rawRef : null
  const deltaPct =
    deltaRaw != null && rawRef != null && rawRef !== 0
      ? (deltaRaw / Math.abs(rawRef)) * 100
      : null
  const dir: DeltaDir =
    deltaRaw == null || deltaRaw === 0 ? 'flat' : deltaRaw > 0 ? 'up' : 'down'
  return { rawNow, deltaRaw, deltaPct, dir }
}

/** raw에서 값이 있는(null이 아닌) 마지막 지점의 인덱스 — "최근일" 기준점. */
function lastValidIndex(raw: readonly (number | null)[]): number | null {
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i] != null) return i
  }
  return null
}

/** raw에서 값이 최소/최대인 지점의 인덱스(각각 첫 등장 기준) — "대비 표시"의
 * 최저·최고 값 표시 모드가 어느 점에 라벨을 붙일지 고르는 데 쓴다. */
function minMaxIndices(raw: readonly (number | null)[]): {
  minIndex: number | null
  maxIndex: number | null
} {
  let minIndex: number | null = null
  let maxIndex: number | null = null
  let minV = Infinity
  let maxV = -Infinity
  raw.forEach((v, i) => {
    if (v == null) return
    if (v < minV) {
      minV = v
      minIndex = i
    }
    if (v > maxV) {
      maxV = v
      maxIndex = i
    }
  })
  return { minIndex, maxIndex }
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
  theme = 'dark',
  compareMode = 'off',
}: IndexLineChartProps) => {
  const {
    surface: SURFACE,
    grid: GRID,
    muted: MUTED,
    up: UP,
    down: DOWN,
  } = PALETTE[theme]
  const DELTA_COLOR: Record<DeltaDir, string> = {
    up: UP,
    down: DOWN,
    flat: MUTED,
  }

  const {
    hover,
    setHover,
    legendHoverKey,
    setLegendHoverKey,
    wrapRef,
    vbWidth,
    vbHeight,
    prepared,
  } = useIndexLineChartViewModel(series)

  const n = categories.length

  // 지표가 하나도 없으면 안내 문구만 보여준다 — 다만 이 경우에도 ResizeObserver가
  // 관찰 중인 .index-line-chart__canvas div는 반드시 계속 렌더해야 한다. 예전엔
  // 여기서 완전히 다른(canvas 없는) JSX로 early return을 해서, 지표를 모두
  // 껐다가 다시 켤 때마다 canvas div가 통째로 언마운트·리마운트됐다 — 그런데
  // 아래 useLayoutEffect는 의존성 배열이 []라 "그 컴포넌트가 처음 마운트될 때"
  // 딱 한 번만 ResizeObserver를 붙이고, 이 div가 다시 생겨도 재부착되지 않는다.
  // 그 결과 vbWidth/vbHeight가 예전(혹은 기본값) 크기에 그대로 멈춰버리고,
  // 그 뒤로 실제 렌더 크기와 어긋난 채 preserveAspectRatio="none"이 내용을
  // 세로로 늘리거나 찌그러뜨렸다(글자가 거대해지는 등). 고치는 방법은 이 div를
  // 절대 언마운트하지 않는 것 — 비어있을 때도 같은 div 안에 안내 문구만 넣는다.
  const isEmpty = n === 0 || series.length === 0

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

  return (
    <div className={`index-line-chart${theme === 'light' ? ' is-light' : ''}`}>
      {/* ResizeObserver가 이 div를 계속 관찰해야 하므로, 비어있을 때도 절대
          언마운트하지 않고 안내 문구로 내용만 바꾼다(위 isEmpty 주석 참고). */}
      <div className="index-line-chart__canvas" ref={wrapRef}>
        {isEmpty ? (
          <div className="index-line-chart__empty-message">
            지표를 선택하면 그래프가 표시됩니다.
          </div>
        ) : (
          <>
            <svg
              className="index-line-chart__svg"
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="지표 비교 그래프"
            >
              <text
                x={4}
                y={14}
                textAnchor="start"
                fontSize={17}
                fill={axisColor}
              >
                {series.length > 1
                  ? `${axisSeries.label} (${axisSeries.unit})`
                  : `${axisSeries.label} (${axisSeries.unit})`}
              </text>
              {xAxisLabel && (
                <text
                  x={MARGIN_LEFT + PLOT_W / 2}
                  y={vbHeight - 6}
                  textAnchor="middle"
                  fontSize={12}
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
                    fontSize={12}
                    fill={axisColor}
                  >
                    {axisSeries.formatCompact(t)}
                  </text>
                </g>
              ))}

              {/* 포커스(호버/범례)된 지표의 평균값을 y축 위에 표시 — 평소엔 숨겨서
                  눈금과 섞이지 않다가, 그 지표를 볼 때만 기준값으로 드러난다. */}
              {focused?.avg != null && (
                <g>
                  <line
                    x1={MARGIN_LEFT - 5}
                    x2={MARGIN_LEFT}
                    y1={yIn(focused.range, focused.avg)}
                    y2={yIn(focused.range, focused.avg)}
                    stroke={focused.color}
                    strokeWidth={1.5}
                  />
                  <text
                    x={MARGIN_LEFT - 8}
                    y={yIn(focused.range, focused.avg)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={focused.color}
                  >
                    {focused.formatCompact(focused.avg)}
                  </text>
                </g>
              )}

              {/* x축 라벨 */}
              {categories.map((c, i) =>
                i % labelStride === 0 || i === n - 1 ? (
                  <text
                    key={`x-${i}`}
                    x={xCenter(i)}
                    y={MARGIN_TOP + PLOT_H + 15}
                    textAnchor="middle"
                    fontSize={12}
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
                      fontSize={12}
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

              {/* 대비 표시 — 포커스(호버/범례)된 지표가 있고 compareMode가 켜져 있을 때만,
                  그 지표에 한해 값 라벨 옆에 추가로 증감을 얹는다.
                  - 'minmax': 최저·최고 지점에만, 최근일(마지막 유효 지점) 대비.
                  - 'all': 모든 지점에, 직전 지점 대비(다른 표의 "대비 표시"와 같은 기준). */}
              {focused != null &&
                compareMode !== 'off' &&
                (() => {
                  const isBar = focused.type === 'bar'
                  const si = prepared.findIndex((p) => p.key === focused.key)
                  const lastIdx = lastValidIndex(focused.raw)
                  const targetIndices: number[] =
                    compareMode === 'all'
                      ? focused.raw
                          .map((v, i) => (v == null ? null : i))
                          .filter((i): i is number => i != null)
                      : Array.from(
                          new Set(
                            Object.values(minMaxIndices(focused.raw)).filter(
                              (i): i is number => i != null,
                            ),
                          ),
                        )

                  return targetIndices.map((i) => {
                    const refIndex =
                      compareMode === 'all' ? (i > 0 ? i - 1 : null) : lastIdx
                    if (refIndex == null || refIndex === i) return null
                    const v = focused.raw[i]
                    if (v == null) return null
                    const { deltaRaw, deltaPct, dir } = computeDelta(
                      focused.raw,
                      i,
                      refIndex,
                    )
                    if (deltaRaw == null) return null

                    const y = yIn(focused.range, v)
                    const cx = isBar ? barCenterX(focused.key, i) : xCenter(i)
                    // 값 라벨(above면 y-9/-5, below면 y+16)과 안 겹치도록 한 칸 더 띄운다.
                    const above = isBar || (si % 2 === 0 && y - 12 >= MARGIN_TOP)
                    const labelY = above
                      ? isBar
                        ? y - 18
                        : y - 22
                      : y + 29

                    return (
                      <text
                        key={`compare-${focused.key}-${i}`}
                        x={cx}
                        y={labelY}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill={DELTA_COLOR[dir]}
                        stroke={SURFACE}
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {DELTA_ARROW[dir]} {focused.formatCompact(Math.abs(deltaRaw))}
                        {deltaPct != null &&
                          ` (${deltaRaw >= 0 ? '+' : '-'}${Math.abs(deltaPct).toFixed(1)}%)`}
                      </text>
                    )
                  })
                })()}

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
              // 호버 위치를 따라다니지 않고 차트 우측 상단에 고정 — 점 바로 위에 띄우면
              // 시리즈가 많을 때 다른 요소를 가리거나 차트 밖으로 잘려 나갔다.
              <div className="index-line-chart__tooltip">
                <div className="index-line-chart__tooltip-label">
                  {categories[hover.index]}
                </div>
                {prepared.map((s) => {
                  const { rawNow, deltaRaw, deltaPct, dir } = computeDelta(
                    s.raw,
                    hover.index,
                    hover.index > 0 ? hover.index - 1 : null,
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
          </>
        )}
      </div>

      {!isEmpty && (
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
      )}
    </div>
  )
}
