import '../styles/insight-charts.scss'
import '../styles/roas-charts.scss'
import { useId, useState, type CSSProperties, type PointerEvent } from 'react'
import { Segmented, smoothPath, useElementSize } from '@/components/glass'
import {
  CHART_CHANNEL_COLOR,
  compactNumber,
  roundTopBar,
} from './channel-insight/insight-chart-shared'

// ROAS 탭의 그래프들 — 표만 있던 섹션(ROAS 범위·기간별 추이·오프라인·카페24
// 매출)을 한눈에 읽히게. 모양·색은 기간별 성과 그래프(insight-charts.scss)와
// 같은 유리 원칙(선 없이 옅은 눈금, 떠 있는 유리 판).

const won = (v: number) =>
  Number.isFinite(v) ? `${Math.round(v).toLocaleString()}원` : '-'
const pct = (v: number) =>
  Number.isFinite(v)
    ? `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
    : '-'

/** 눈금이 딱 떨어지는 위 끝 — 가장 큰 값보다 조금 위의 "깔끔한" 수. */
const niceMax = (max: number) => {
  if (max <= 0) return 1
  const target = max * 1.12
  const unit = 10 ** Math.floor(Math.log10(target))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return (steps.find((s) => s * unit >= target) ?? 10) * unit
}

// ── ROAS 범위 ────────────────────────────────────────────────────────────

/**
 * ROAS 범위 띠 — 0%부터 눈금 위에 하한(UTM 광고)과 상한(신규 고객)을 찍고 그
 * 사이를 칠한다. 진짜 광고 ROAS는 이 칠한 구간 어딘가에 있다. 100%(손익분기)
 * 금을 같이 그어 두 값이 손익분기 위인지 바로 보이게.
 */
export function RoasRangeGauge({
  lower,
  upper,
}: {
  lower: number
  upper: number
}) {
  const max = niceMax(Math.max(lower, upper, 100))
  const at = (v: number) =>
    `${Math.min(100, Math.max(0, (Number.isFinite(v) ? v : 0) / max) * 100)}%`
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  return (
    <div className="roas-gauge">
      <div className="roas-gauge__track">
        {Number.isFinite(lower) && Number.isFinite(upper) && (
          <span
            className="roas-gauge__band"
            style={{
              left: at(Math.min(lower, upper)),
              width: `calc(${at(Math.max(lower, upper))} - ${at(Math.min(lower, upper))})`,
            }}
          />
        )}
        <span className="roas-gauge__breakeven" style={{ left: at(100) }}>
          <em>손익분기 100%</em>
        </span>
        {[
          { key: 'lower', label: '하한 · UTM 광고', value: lower },
          { key: 'upper', label: '상한 · 신규 고객', value: upper },
        ].map((mark) => (
          <span
            key={mark.key}
            className={`roas-gauge__mark is-${mark.key}`}
            style={{ left: at(mark.value) }}
          >
            <b>{pct(mark.value)}</b>
            <small>{mark.label}</small>
          </span>
        ))}
      </div>
      <div className="roas-gauge__scale" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {Math.round(t).toLocaleString()}%
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 신규 매출의 유입 경로 ────────────────────────────────────────────────

export interface MixRow {
  key: string
  label: string
  revenue: number
  buyers: number
  /** 광고 채널만 — 광고비와 ROAS. */
  spend: number | null
  roas: number | null
}

const MIX_COLOR: Record<string, string> = {
  ...CHART_CHANNEL_COLOR,
  adOutside: 'color-mix(in srgb, var(--glass-text) 42%, transparent)',
  other: 'color-mix(in srgb, var(--glass-text) 24%, transparent)',
  unknown: 'var(--glass-track)',
}

/**
 * 신규 고객 매출이 어디서 왔는지 — 위는 100% 띠(채널별 몫), 아래는 광고 채널
 * 마다 ROAS 막대(100% 금 = 손익분기). 띠의 회색 칸(UTM 없음 등)이 클수록 하한과
 * 상한이 벌어진다.
 */
export function AttributionMix({
  rows,
  total,
}: {
  rows: readonly MixRow[]
  /** 신규 고객 매출 전체. */
  total: number
}) {
  const ad = rows.filter((r) => r.roas !== null)
  const maxRoas = niceMax(Math.max(100, ...ad.map((r) => r.roas ?? 0)))
  return (
    <div className="roas-mix">
      <div
        className="roas-mix__bar"
        role="img"
        aria-label="신규 매출 유입 경로 비중"
      >
        {rows
          .filter((r) => r.revenue > 0)
          .map((r, i) => (
            <span
              key={r.key}
              title={`${r.label} ${won(r.revenue)} · ${pct((r.revenue / total) * 100)}`}
              style={
                {
                  width: `${(r.revenue / total) * 100}%`,
                  background: MIX_COLOR[r.key],
                  '--glass-i': i,
                } as CSSProperties
              }
            />
          ))}
      </div>
      <div className="roas-mix__legend">
        {rows.map((r) => (
          <span key={r.key}>
            <i style={{ background: MIX_COLOR[r.key] }} />
            {r.label}
            <b>{total > 0 ? pct((r.revenue / total) * 100) : '-'}</b>
            <small>
              {r.buyers.toLocaleString()}명 · {won(r.revenue)}
            </small>
          </span>
        ))}
      </div>

      <div className="roas-mix__roas">
        <span className="roas-mix__roas-title">
          광고 채널별 ROAS (하한 기준)
        </span>
        {ad.map((r) => (
          <div key={r.key} className="roas-mix__roas-row">
            <span className="roas-mix__roas-name">
              <i style={{ background: MIX_COLOR[r.key] }} />
              {r.label}
            </span>
            <span className="roas-mix__roas-track">
              <i
                className={(r.roas ?? 0) < 100 ? 'is-low' : undefined}
                style={{
                  width: `${Math.min(100, ((r.roas ?? 0) / maxRoas) * 100)}%`,
                }}
              />
              <em style={{ left: `${(100 / maxRoas) * 100}%` }} />
            </span>
            <b className={(r.roas ?? 0) < 100 ? 'is-low' : undefined}>
              {pct(r.roas ?? 0)}
            </b>
            <small>
              광고비 {won(r.spend ?? 0)} ·{' '}
              {r.buyers > 0 && r.spend
                ? `1명당 ${won(r.spend / r.buyers)}`
                : '구매 고객 없음'}
            </small>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 기간별 막대(쌓기) ────────────────────────────────────────────────────

export interface StackSeries {
  key: string
  label: string
  /** CSS 색(변수 가능). */
  color: string
  values: readonly number[]
}

/** 한 칸에 나란히 서는 막대 하나 — 조각을 아래부터 쌓는다. */
export interface StackGroup {
  key: string
  label: string
  series: readonly StackSeries[]
}

const PAD = { top: 16, right: 14, bottom: 30 }

/**
 * 기간별 막대 — 칸마다 막대 묶음(예: [광고비] [매출 = 신규 + 재구매])을 나란히
 * 세운다. 단위가 같은 값만(모두 원) — 축은 하나. 마우스를 올린 칸은 떠 있는
 * 유리 판에 묶음마다 조각 값과 합계.
 */
export function PeriodStackChart({
  labels,
  groups,
  height = 260,
  note,
  rightAxis,
}: {
  labels: readonly string[]
  groups: readonly StackGroup[]
  height?: number
  /** 유리 판 맨 아래 한 줄(예: 그 칸의 ROAS). */
  note?: (index: number) => string
  /** 이 묶음은 오른쪽 축(제 크기에 맞춘 눈금)으로 — 다른 묶음보다 훨씬 작아
   * 바닥에 붙어 보일 때(매출 옆 광고비 등). 눈금 칸(0·½·끝)은 양쪽이 같아 격자를
   * 같이 쓴다. */
  rightAxis?: string
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  const totalOf = (g: StackGroup, i: number) =>
    g.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
  const maxOf = (gs: readonly StackGroup[]) =>
    niceMax(
      Math.max(0, ...labels.flatMap((_, i) => gs.map((g) => totalOf(g, i)))),
    )
  const max = maxOf(groups.filter((g) => g.key !== rightAxis))
  const rightMax = rightAxis
    ? maxOf(groups.filter((g) => g.key === rightAxis))
    : max
  const ticks = [max, max / 2, 0]
  const right = rightAxis
    ? Math.max(48, compactNumber(rightMax).length * 7 + 16)
    : PAD.right
  const left = Math.max(
    48,
    Math.max(...ticks.map((t) => compactNumber(t).length)) * 7 + 16,
  )
  const width = size.width
  const plotW = Math.max(0, width - left - right)
  const plotH = Math.max(0, height - PAD.top - PAD.bottom)
  const band = n ? plotW / n : 0
  const barW = Math.max(3, Math.min((band * 0.7) / groups.length, 26))
  const gap = Math.min(4, barW * 0.25)
  const cx = (i: number) => left + band * i + band / 2
  const y = (v: number) => PAD.top + (1 - v / max) * plotH
  const yIn = (g: StackGroup) => (v: number) =>
    PAD.top + (1 - v / (g.key === rightAxis ? rightMax : max)) * plotH
  const labelStep = Math.max(
    1,
    Math.ceil(n / Math.max(1, Math.floor(plotW / 60))),
  )

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!n || band === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const i = Math.floor((event.clientX - box.left - left) / band)
    setHover(i >= 0 && i < n ? i : null)
  }
  const ready = width > 0 && n > 0

  return (
    <div className="insight-chart roas-stack">
      <div
        ref={ref}
        className="insight-chart__canvas"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ready && (
          <svg width={width} height={height} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t} className="insight-chart__grid">
                <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
                <text x={left - 8} y={y(t)} dy="0.35em" textAnchor="end">
                  {compactNumber(t)}
                </text>
                {rightAxis && (
                  <text
                    className="roas-stack__right-tick"
                    x={width - right + 8}
                    y={y(t)}
                    dy="0.35em"
                    textAnchor="start"
                  >
                    {compactNumber((t / max) * rightMax)}
                  </text>
                )}
              </g>
            ))}
            {hover !== null && (
              <rect
                className="insight-chart__hover-band"
                x={left + band * hover}
                y={PAD.top}
                width={band}
                height={plotH}
                rx={8}
              />
            )}
            {labels.map((label, i) => {
              const groupW = groups.length * barW + (groups.length - 1) * gap
              return (
                <g
                  key={`${label}:${i}`}
                  className="insight-chart__stack"
                  style={{ '--glass-i': Math.min(i, 24) } as CSSProperties}
                >
                  {groups.map((g, gi) => {
                    const x = cx(i) - groupW / 2 + gi * (barW + gap)
                    const yg = yIn(g)
                    let base = 0
                    const segments = g.series
                      .map((s) => ({ s, v: Math.max(0, s.values[i] ?? 0) }))
                      .filter((seg) => seg.v > 0)
                    return segments.map(({ s, v }, si) => {
                      const bottom = yg(base)
                      base += v
                      const top = yg(base)
                      const h = Math.max(0, bottom - top - (si > 0 ? 1.5 : 0))
                      return si === segments.length - 1 ? (
                        <path
                          key={`${g.key}:${s.key}`}
                          d={roundTopBar(x, top, barW, h)}
                          style={{ fill: s.color }}
                        />
                      ) : (
                        <rect
                          key={`${g.key}:${s.key}`}
                          x={x}
                          y={top}
                          width={barW}
                          height={h}
                          style={{ fill: s.color }}
                        />
                      )
                    })
                  })}
                </g>
              )
            })}
            {labels.map((label, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                n - 1 - i < labelStep * 0.75 && i !== n - 1 ? null : (
                  <text
                    key={`x:${label}:${i}`}
                    className="insight-chart__xlabel"
                    x={cx(i)}
                    y={height - 9}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                )
              ) : null,
            )}
          </svg>
        )}
        {ready && hover !== null && (
          <div
            className="insight-chart__tip"
            style={
              cx(hover) < width / 2
                ? { left: cx(hover) + band / 2 + 6, top: PAD.top }
                : { right: width - cx(hover) + band / 2 + 6, top: PAD.top }
            }
          >
            <span className="insight-chart__tip-label">{labels[hover]}</span>
            {groups.map((g) => (
              <span key={g.key} className="roas-stack__tip-group">
                <strong>
                  {g.label} {won(totalOf(g, hover))}
                </strong>
                {g.series.length > 1 &&
                  g.series.map((s) => (
                    <span key={s.key} className="insight-chart__tip-row">
                      <i style={{ background: s.color }} />
                      {s.label}
                      <b>{won(s.values[hover] ?? 0)}</b>
                    </span>
                  ))}
              </span>
            ))}
            {note && <small>{note(hover)}</small>}
          </div>
        )}
      </div>
      <div className="insight-chart__legend">
        {groups.flatMap((g) =>
          g.series.map((s) => (
            <span key={`${g.key}:${s.key}`}>
              <i style={{ background: s.color }} />
              {s.label}
              {g.key === rightAxis && (
                <small className="roas-stack__axis-note">오른쪽 축</small>
              )}
            </span>
          )),
        )}
      </div>
    </div>
  )
}

// ── 폭포 ────────────────────────────────────────────────────────────────

export interface WaterfallStep {
  key: string
  label: string
  /** total: 0부터 그 값까지(중간 합계). minus/plus: 앞 합계에서 빼고 더한 몫. */
  kind: 'total' | 'minus' | 'plus'
  value: number
  note?: string
}

/** 폭포 막대마다 [아래, 위] — 합계는 바닥부터, 빼고 더하는 몫은 앞 합계에서. */
const stepSpans = (steps: readonly WaterfallStep[]) => {
  const spans: (readonly [number, number])[] = []
  let running = 0
  for (const step of steps) {
    if (step.kind === 'total') {
      running = step.value
      spans.push([0, step.value])
      continue
    }
    const from = running
    running += step.kind === 'minus' ? -step.value : step.value
    spans.push([Math.min(from, running), Math.max(from, running)])
  }
  return spans
}

/**
 * 폭포 — 시작 금액에서 무엇이 얼마나 빠져 마지막 금액이 되는지. 합계 막대는
 * 바닥부터(데이터색), 빠지는 몫은 앞 합계 높이에서 떠 있는 막대(위험색 옅게),
 * 더하는 몫은 링크색. 막대 위에 값, 마우스를 올리면 설명.
 */
export function Waterfall({
  steps: allSteps,
  height = 260,
}: {
  steps: readonly WaterfallStep[]
  height?: number
}) {
  // 0원인 몫(할인이 없던 기간 등)은 막대가 없으니 칸도 비우지 않고 뺀다.
  const steps = allSteps.filter(
    (step) => step.kind === 'total' || Math.abs(step.value) >= 0.5,
  )
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const spans = stepSpans(steps)
  const max = niceMax(Math.max(0, ...spans.map(([, top]) => top)))
  const width = size.width
  const top = 26
  const bottom = 40
  const plotH = Math.max(0, height - top - bottom)
  const n = steps.length
  const band = n ? width / n : 0
  const barW = Math.max(8, Math.min(band * 0.56, 56))
  const y = (v: number) => top + (1 - v / max) * plotH
  const ready = width > 0 && n > 0

  return (
    <div className="roas-waterfall">
      <div
        ref={ref}
        className="insight-chart__canvas roas-waterfall__canvas"
        style={{ height }}
        onPointerLeave={() => setHover(null)}
      >
        {ready && (
          <svg width={width} height={height} aria-hidden="true">
            <line
              className="roas-waterfall__base"
              x1={0}
              x2={width}
              y1={y(0)}
              y2={y(0)}
            />
            {steps.map((step, i) => {
              const [lo, hi] = spans[i]
              const x = band * i + (band - barW) / 2
              const h = Math.max(1, y(lo) - y(hi))
              // 다음 막대로 잇는 점선 — 합계가 어디서 이어지는지.
              const level = step.kind === 'minus' ? lo : hi
              return (
                <g
                  key={step.key}
                  className={`roas-waterfall__step is-${step.kind}`}
                  style={{ '--glass-i': i } as CSSProperties}
                  onPointerEnter={() => setHover(i)}
                >
                  <rect
                    x={band * i}
                    y={0}
                    width={band}
                    height={height}
                    fill="transparent"
                  />
                  <path
                    className="roas-waterfall__bar"
                    d={
                      step.kind === 'total'
                        ? roundTopBar(x, y(hi), barW, h)
                        : `M${x},${y(hi)}h${barW}v${h}h${-barW}z`
                    }
                  />
                  {i < n - 1 && (
                    <line
                      className="roas-waterfall__link"
                      x1={x + barW}
                      x2={band * (i + 1) + (band - barW) / 2}
                      y1={y(level)}
                      y2={y(level)}
                    />
                  )}
                  <text
                    className="roas-waterfall__value"
                    x={x + barW / 2}
                    y={y(hi) - 7}
                    textAnchor="middle"
                  >
                    {step.kind === 'minus'
                      ? '−'
                      : step.kind === 'plus'
                        ? '+'
                        : ''}
                    {compactNumber(step.value)}
                  </text>
                  <text
                    className="insight-chart__xlabel roas-waterfall__label"
                    x={band * i + band / 2}
                    y={height - 22}
                    textAnchor="middle"
                  >
                    {/* 긴 이름은 두 줄로(공백 기준). */}
                    {splitLabel(step.label).map((line, li) => (
                      <tspan key={li} x={band * i + band / 2} dy={li ? 13 : 0}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
        {ready && hover !== null && (
          <div
            className="insight-chart__tip"
            style={
              hover < n / 2
                ? { left: band * (hover + 1) - 4, top: 8 }
                : { right: width - band * hover - 4, top: 8 }
            }
          >
            <span className="insight-chart__tip-label">
              {steps[hover].label}
            </span>
            <strong>
              {steps[hover].kind === 'minus'
                ? '− '
                : steps[hover].kind === 'plus'
                  ? '+ '
                  : ''}
              {won(steps[hover].value)}
            </strong>
            {steps[hover].note && <small>{steps[hover].note}</small>}
          </div>
        )}
      </div>
    </div>
  )
}

/** 이름을 두 줄로 — 가운데에 가까운 공백에서 자른다. */
const splitLabel = (label: string): string[] => {
  if (label.length <= 7 || !label.includes(' ')) return [label]
  const mid = label.length / 2
  let best = -1
  for (let i = 0; i < label.length; i++) {
    if (
      label[i] === ' ' &&
      (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))
    ) {
      best = i
    }
  }
  return [label.slice(0, best), label.slice(best + 1)]
}

/** 작은 숫자 칸 묶음 — 그래프 위에 그 섹션의 비율 지표들. */
export function RatioChips({
  items,
}: {
  items: readonly {
    key: string
    label: string
    value: string
    note?: string
    tone?: 'warn'
  }[]
}) {
  return (
    <div className="roas-chips">
      {items.map((item) => (
        <span
          key={item.key}
          className={`roas-chip${item.tone ? ` is-${item.tone}` : ''}`}
          title={item.note}
        >
          <small>{item.label}</small>
          <b>{item.value}</b>
        </span>
      ))}
    </div>
  )
}

const DISPLAY_LABEL = { chart: '그래프', table: '표' } as const

/** 섹션 머리의 [그래프 | 표]. */
export function DisplayToggle({
  value,
  onChange,
}: {
  value: 'chart' | 'table'
  onChange: (value: 'chart' | 'table') => void
}) {
  return (
    <Segmented
      options={DISPLAY_LABEL}
      value={value}
      onChange={onChange}
      label="그래프 / 표"
    />
  )
}

// ── ROAS 추이 ───────────────────────────────────────────────────────────

export interface RoasTrendPoint {
  key: string
  label: string
  value: number
  /** 유리 판에 같이 보이는 그 칸의 광고비·매출. */
  spend: number
  revenue: number
}

type Dir = 'up' | 'down' | 'flat'
const ARROW: Record<Dir, string> = { up: '▲', down: '▼', flat: '—' }
const deltaOf = (now: number, prev: number) => {
  const delta = now - prev
  const dir: Dir = Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, dir }
}
const deltaText = (d: { delta: number; dir: Dir }) =>
  `${ARROW[d.dir]} ${d.delta >= 0 ? '+' : '−'}${Math.abs(d.delta).toFixed(1)}%p`

const TREND_PAD = { top: 44, right: 16, bottom: 28 }
// 칸이 이만큼 넓으면 막대, 좁으면(일별 몇 달 등) 선으로 — 막대가 바늘처럼
// 가늘어지면 값보다 막대 사이 틈이 더 눈에 띈다.
const BAR_MIN_BAND = 18
// 칸이 이만큼 넓으면 칸마다 값 알약을, 좁으면 최고·최저·마지막만.
const PILL_MIN_BAND = 68

/**
 * ROAS 추이 — 칸이 넉넉하면 막대, 촘촘하면(6개월 일별 등) 선. 100%(손익분기)
 * 점선과 평균 점선, 값은 유리 알약(막대 위 — 칸이 좁으면 최고·최저·마지막만)과
 * 바로 앞 칸 대비(오름 초록·내림 빨강·같음 회색). 마우스를 올리면 그 칸의 값·
 * 대비·광고비·매출이 떠 있는 유리 판에.
 */
export function RoasTrendChart({
  points,
  average,
  label,
  height = 250,
}: {
  points: readonly RoasTrendPoint[]
  average: number
  /** 그린 지표 이름(신규 고객 ROAS 등). */
  label: string
  height?: number
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = `roas-trend-${useId().replace(/[^\w-]/g, '')}`
  const n = points.length
  const width = size.width
  const values = points.map((p) => (Number.isFinite(p.value) ? p.value : 0))
  const max = niceMax(Math.max(100, average, ...values))
  const ticks = [max, max / 2, 0]
  const left = 52
  const plotW = Math.max(0, width - left - TREND_PAD.right)
  const plotH = Math.max(0, height - TREND_PAD.top - TREND_PAD.bottom)
  const base = TREND_PAD.top + plotH
  const band = n ? plotW / n : 0
  const asBars = band >= BAR_MIN_BAND
  const barW = Math.max(3, Math.min(band * 0.56, 34))
  const cx = (i: number) => left + band * i + band / 2
  const y = (v: number) => TREND_PAD.top + (1 - v / max) * plotH
  const labelStep = Math.max(
    1,
    Math.ceil(n / Math.max(1, Math.floor(plotW / 60))),
  )
  const ready = width > 0 && n > 0

  // 알약을 달 칸 — 넉넉하면 전부, 아니면 최고·최저·마지막(겹치지 않게 한 번씩).
  const pillAt = new Set<number>()
  if (band >= PILL_MIN_BAND) points.forEach((_, i) => pillAt.add(i))
  else if (n > 0) {
    // 촘촘하면 최고·마지막만(최저는 0보다 클 때만 — 0%는 바닥이라 알약이 축 글자를
    // 가린다).
    pillAt.add(values.indexOf(Math.max(...values)))
    const low = Math.min(...values)
    if (low > 0) pillAt.add(values.indexOf(low))
    pillAt.add(n - 1)
  }
  const avgY = y(average)
  const breakevenY = y(100)
  const nearMarker = (ty: number) =>
    Math.abs(ty - avgY) < 12 || Math.abs(ty - breakevenY) < 12

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!n || band === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const i = Math.floor((event.clientX - box.left - left) / band)
    setHover(i >= 0 && i < n ? i : null)
  }
  const hovered = hover === null ? null : points[hover]
  const linePoints = values.map((v, i) => [cx(i), y(v)] as [number, number])

  return (
    <div className="insight-chart roas-trend">
      <div className="roas-trend__legend">
        <span className="is-avg">
          {label} 평균 {pct(average)}
        </span>
        <span className="is-breakeven">손익분기 100%</span>
      </div>
      <div
        ref={ref}
        className="insight-chart__canvas"
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ready && (
          <svg width={width} height={height} aria-hidden="true">
            <defs>
              {(['good', 'bad'] as const).map((tone) => (
                <linearGradient
                  key={tone}
                  id={`${gradientId}-${tone}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    className={`roas-trend__stop-top is-${tone}`}
                  />
                  <stop
                    offset="100%"
                    className={`roas-trend__stop-bottom is-${tone}`}
                  />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t) => (
              <g key={t} className="insight-chart__grid">
                <line
                  x1={left}
                  x2={width - TREND_PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                />
                {!nearMarker(y(t)) && (
                  <text x={left - 8} y={y(t)} dy="0.35em" textAnchor="end">
                    {Math.round(t).toLocaleString()}%
                  </text>
                )}
              </g>
            ))}
            {hover !== null && (
              <rect
                className="insight-chart__hover-band"
                x={left + band * hover}
                y={TREND_PAD.top}
                width={band}
                height={plotH}
                rx={8}
              />
            )}

            {asBars ? (
              values.map((v, i) => {
                const top = y(v)
                const h = base - top
                return h > 0 ? (
                  <path
                    key={points[i].key}
                    className="insight-chart__bar roas-trend__bar"
                    d={roundTopBar(cx(i) - barW / 2, top, barW, h)}
                    fill={`url(#${gradientId}-${v < 100 ? 'bad' : 'good'})`}
                    style={{ '--glass-i': Math.min(i, 24) } as CSSProperties}
                  />
                ) : null
              })
            ) : (
              <>
                <path
                  className="roas-trend__area"
                  d={`${smoothPath(linePoints)} L${cx(n - 1)},${base} L${cx(0)},${base} Z`}
                  fill={`url(#${gradientId}-good)`}
                />
                <path className="roas-trend__line" d={smoothPath(linePoints)} />
              </>
            )}

            <line
              className="roas-trend__breakeven"
              x1={left}
              x2={width - TREND_PAD.right}
              y1={breakevenY}
              y2={breakevenY}
            />
            <line
              className="insight-chart__mean"
              x1={left}
              x2={width - TREND_PAD.right}
              y1={avgY}
              y2={avgY}
            />
            <text
              className="roas-trend__axis-mark is-avg"
              x={left - 8}
              y={avgY}
              dy="0.35em"
              textAnchor="end"
            >
              {Math.round(average).toLocaleString()}%
            </text>
            {Math.abs(breakevenY - avgY) >= 12 && (
              <text
                className="roas-trend__axis-mark is-breakeven"
                x={left - 8}
                y={breakevenY}
                dy="0.35em"
                textAnchor="end"
              >
                100%
              </text>
            )}

            {!asBars && hover !== null && (
              <circle
                className="insight-chart__dot"
                cx={cx(hover)}
                cy={y(values[hover])}
                r={4.5}
              />
            )}

            {points.map((p, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                n - 1 - i < labelStep * 0.75 && i !== n - 1 ? null : (
                  <text
                    key={`x:${p.key}`}
                    className="insight-chart__xlabel"
                    x={cx(i)}
                    y={height - 9}
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                )
              ) : null,
            )}
          </svg>
        )}

        {/* 값 알약 — 글자는 유리 판 위에(그림 위 글자 테두리 없이). */}
        {ready &&
          [...pillAt].map((i) => {
            const d = i > 0 ? deltaOf(values[i], values[i - 1]) : null
            return (
              <span
                key={`pill:${points[i].key}`}
                className="roas-trend__pill"
                style={
                  {
                    left: Math.min(Math.max(cx(i), left + 30), width - 34),
                    top: y(values[i]) - 6,
                    '--glass-i': Math.min(i, 24),
                  } as CSSProperties
                }
              >
                <b>{pct(values[i])}</b>
                {d && band >= PILL_MIN_BAND && (
                  <small className={`roas-delta is-${d.dir}`}>
                    {deltaText(d)}
                  </small>
                )}
              </span>
            )
          })}

        {ready && hovered && hover !== null && (
          <div
            className="insight-chart__tip"
            style={
              cx(hover) < width / 2
                ? { left: cx(hover) + band / 2 + 8, top: TREND_PAD.top }
                : {
                    right: width - cx(hover) + band / 2 + 8,
                    top: TREND_PAD.top,
                  }
            }
          >
            <span className="insight-chart__tip-label">{hovered.label}</span>
            <strong>
              {label} {pct(values[hover])}
            </strong>
            {hover > 0 && (
              <span
                className={`roas-delta is-${deltaOf(values[hover], values[hover - 1]).dir}`}
              >
                앞 칸 대비{' '}
                {deltaText(deltaOf(values[hover], values[hover - 1]))}
              </span>
            )}
            <span className="insight-chart__tip-row">
              광고비<b>{won(hovered.spend)}</b>
            </span>
            <span className="insight-chart__tip-row">
              매출<b>{won(hovered.revenue)}</b>
            </span>
            <small>
              평균 대비 {values[hover] - average >= 0 ? '+' : '−'}
              {Math.abs(values[hover] - average).toFixed(1)}%p
            </small>
          </div>
        )}
      </div>
    </div>
  )
}
