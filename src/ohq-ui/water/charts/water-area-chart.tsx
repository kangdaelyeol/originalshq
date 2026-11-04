import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ChartSeries } from '../../charts/area-chart'
import { monotonePath, niceTicks } from '../../charts/chart-utils'
import { cx } from '../../lib/cx'
import { compact, formatInt } from '../../lib/format'
import { useElementSize } from '../../lib/use-element-size'
import { useReducedMotion } from '../hooks'
import { WATER_REVEAL, WATER_SPRING, round3 } from '../motion'
import { runSpring, type SpringRun } from '../spring-run'
import { WaterGlide } from '../glide'
import { WATER_RING } from './palette'
import { WaterSlosh, type SloshLevels } from './slosh'

interface WaterAreaChartProps {
  labels: readonly string[]
  series: readonly ChartSeries[]
  ariaLabel: string
  /** 그림 + x축 글자 띠까지 포함한 높이(계열이 둘 이상이면 그 아래 범례 한 줄이 더 붙는다) */
  height?: number
  /** 개수처럼 정수만 있는 값이면 눈금도 정수로 */
  integer?: boolean
  /** y축 눈금 표기 */
  formatTick?: (value: number) => string
  /** 툴팁·표 보기의 값 표기 */
  formatValue?: (value: number) => string
}

const PAD = { top: 12, right: 14, bottom: 30, left: 44 }
// 계열이 이만큼이면 선 끝에 이름표를 단다(dataviz: 넷부터 직접 이름표) — 오른쪽에 이름표 자리
const DIRECT_LABELS = 4
const END_LABEL_W = 72
// 이름표 사이 최소 간격(px) — 가까우면 쌓지 않고 끌어 잇는 선으로 떼어 놓는다
const END_LABEL_GAP = 13

/**
 * 면 진하기 — 흰 견줄 계열은 회색 벽 위에서 옅어 30%, 색 계열은 dataviz 물빛(약 10%): 하나·둘이면 12%,
 * 셋 넘게 겹치면 6%(아래가 탁해지지 않게)
 */
const washOf = (color: string, count: number) => (/^#f{3}(f{3})?$/i.test(color) ? 0.3 : count >= 3 ? 0.06 : 0.12)

/** 선 끝 이름표 자리 — 위에서부터 겹치지 않게 내리고, 아래로 넘치면 아래에서부터 올린다 */
function spreadEnds(ys: number[], min: number, max: number): number[] {
  const order = ys.map((y, k) => ({ y, k })).sort((a, b) => a.y - b.y)
  const placed = order.map((o) => o.y)
  for (let i = 0; i < placed.length; i++) placed[i] = Math.max(placed[i], i ? placed[i - 1] + END_LABEL_GAP : min)
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i] = Math.min(placed[i], i < placed.length - 1 ? placed[i + 1] - END_LABEL_GAP : max)
  }
  const out = new Array<number>(ys.length)
  order.forEach((o, i) => (out[o.k] = placed[i]))
  return out
}
// x축 글자 사이 최소 간격 — 칸이 많으면(30일 등) 이 간격이 되게 건너뛰며 찍는다
const MIN_LABEL_GAP = 54
// 칸이 이보다 많으면 모든 점 대신 마지막 점과 고른 점만
const MAX_DOTS = 14
// 툴팁과 기준선 사이
const TIP_GAP = 14

const washPath = (line: string, x0: number, x1: number, base: number) =>
  `${line} L${round3(x1)},${round3(base)} L${round3(x0)},${round3(base)} Z`

const sameShape = (a: SloshLevels, b: SloshLevels) =>
  a.length === b.length && a.every((row, k) => row.length === b[k].length)
const sameLevels = (a: SloshLevels, b: SloshLevels) =>
  sameShape(a, b) && a.every((row, k) => row.every((y, i) => Math.abs(y - b[k][i]) < 0.01))

/**
 * 선 + 면 차트(D7) — AreaChart와 같은 props. 회색 벽 위 흰 실선 격자, 2px 선과 옅은 물빛 면(washOf — 색 계열
 * 12%·셋 넘으면 6%, 흰 계열 30%에서 바닥으로 옅어짐).
 * - 처음 나타날 때: 계열마다 물 높이가 바닥에서 차오른다(extend 스프링 16% 넘침, 계열 사이 21ms).
 * - 값이 바뀌면: 점마다 지난 높이에서 새 높이로 출렁이며(같은 스프링), 왼쪽 점부터 21ms 간격으로 번진다.
 * - 고르기(마우스·←/→): x축의 어두운 표시 알약(D7 고른 표시)이 그 칸으로 미끄러지며(ζ0.65·ω30.5 + 늘어남),
 *   흰 기준선과 작은 유리 판(툴팁)이 같이 따라간다. 툴팁은 고른 점을 가리지 않게 늘 기준선 옆(왼쪽 절반이면
 *   오른쪽)이고, 옆을 바꿀 때도 같은 스프링으로 미끄러진다.
 * 계열이 둘 이상이면 범례, 넷 이상이면 선 끝 이름표(가까우면 끌어 잇는 선), 화면 낭독기용 표가 늘 있다. 동작 줄이기면 차오름·출렁임·미끄러짐 없이 바로 놓는다.
 */
export function WaterAreaChart({
  labels,
  series,
  ariaLabel,
  height = 240,
  integer = false,
  formatTick = compact,
  formatValue = formatInt,
}: WaterAreaChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [containerRef, { width }] = useElementSize<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  // 사라지는 동안(30ms)에도 마지막 내용을 보여 준다
  const [last, setLast] = useState<number | null>(null)
  if (active !== null && active !== last) setLast(active)
  const shownIndex = active ?? last
  const reduced = useReducedMotion()

  const n = labels.length
  const ready = width > 0
  const direct = series.length >= DIRECT_LABELS
  const padRight = PAD.right + (direct ? END_LABEL_W : 0)
  const plotW = Math.max(0, width - PAD.left - padRight)
  const plotH = height - PAD.top - PAD.bottom
  const baseY = PAD.top + plotH
  const ticks = niceTicks(Math.max(0, ...series.flatMap((s) => s.values)), 4, integer)
  const top = ticks[ticks.length - 1]
  const xAt = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const yAt = (v: number) => PAD.top + plotH - (v / top) * plotH
  const step = n <= 1 ? plotW : plotW / (n - 1)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / MIN_LABEL_GAP))))
  const showAllDots = n <= MAX_DOTS
  const activeX = active === null ? null : xAt(active)

  const xs = useMemo(
    () => Array.from({ length: n }, (_, i) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1))),
    [n, plotW],
  )
  const levels: SloshLevels = useMemo(
    () => series.map((s) => s.values.map((v) => PAD.top + plotH - (v / top) * plotH)),
    [series, plotH, top],
  )

  const seriesEls = useRef<(SVGSVGElement | null)[]>([])
  const crossRef = useRef<HTMLSpanElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  // rAF 안에서 쓰는 크기 — 레이아웃을 읽지 않게 미리 재 둔다
  const measure = useRef({ pillW: 0 })
  const geo = useRef({ xs: [] as number[], baseY: 0 })
  const glide = useRef<WaterGlide | null>(null)
  const tipGlide = useRef<WaterGlide | null>(null)
  const slosh = useRef<WaterSlosh | null>(null)
  const shownLevels = useRef<SloshLevels | null>(null)
  const rose = useRef(false)
  const riseRuns = useRef<SpringRun[]>([])
  const lastWidth = useRef(0)

  // 미끄러지는 표시 알약·기준선(늘어남까지), 그리고 툴팁(제 자리로 — 기준선 왼쪽·오른쪽을 바꿀 때도 미끄러진다).
  // 움직임은 WAAPI 키프레임(합성 단계) — 프레임마다 메인 스레드가 일하지 않는다
  useLayoutEffect(() => {
    const g = new WaterGlide([
      { el: () => crossRef.current, frame: (pos) => ({ transform: `translateX(${round3(pos)}px)` }) },
      {
        el: () => pillRef.current,
        frame: (pos, along, across) => ({
          transform: `translateX(${round3(pos - measure.current.pillW / 2)}px) scale(${round3(along)}, ${round3(across)})`,
        }),
      },
    ])
    const t = new WaterGlide([
      { el: () => tipRef.current, frame: (pos) => ({ transform: `translateX(${round3(pos)}px)` }) },
    ])
    glide.current = g
    tipGlide.current = t
    return () => {
      g.destroy()
      t.destroy()
      glide.current = null
      tipGlide.current = null
    }
  }, [])

  // 출렁임 — 선·면·점 높이를 직접 고친다(React가 그린 끝 모양은 그대로 두고)
  useLayoutEffect(() => {
    const s = new WaterSlosh(
      (lv) => {
        const { xs: gx, baseY: gb } = geo.current
        seriesEls.current.forEach((svg, k) => {
          const ys = lv[k]
          if (!svg || !ys || ys.length !== gx.length) return
          const line = monotonePath(ys.map((y, i) => [gx[i], y] as const))
          svg.querySelector('.water-area__wash')?.setAttribute('d', washPath(line, gx[0], gx[gx.length - 1], gb))
          svg.querySelector('.water-area__line')?.setAttribute('d', line)
          svg.querySelectorAll<SVGCircleElement>('circle[data-i]').forEach((c) => {
            const y = ys[Number(c.dataset.i)]
            if (y !== undefined) c.setAttribute('cy', String(round3(y)))
          })
        })
      },
      (busy) => {
        // 출렁이는 동안만 계열 SVG를 제 층에 — 선 모양을 다시 칠할 때 뒤 유리 판(흐린 그림자)까지 다시 칠하지 않게
        seriesEls.current.forEach((svg) => {
          if (svg) svg.style.willChange = busy ? 'transform' : ''
        })
      },
    )
    slosh.current = s
    return () => {
      s.stop()
      slosh.current = null
    }
  }, [])

  // 처음 나타날 때 — 계열마다 물 높이가 바닥에서 차오른다. 한 번만: 너비가 잠깐 0이 됐다 돌아와도(숨겼다
  // 보이기·캡처 도구의 창 크기 바꾸기) 다시 차오르지 않는다
  useLayoutEffect(() => {
    if (!ready || rose.current) return
    rose.current = true
    if (reduced) return
    riseRuns.current = seriesEls.current.flatMap((el, k) =>
      el
        ? [
            runSpring(el, {
              from: 0,
              to: 1,
              spec: WATER_SPRING.extend,
              delay: k * WATER_REVEAL.stagger,
              frame: (x) => ({ transform: `scaleY(${round3(x)})` }),
            }),
          ]
        : [],
    )
  }, [ready, reduced])

  // 떼어질 때 — 차오름을 멈추고, 개발 모드(StrictMode)에서 곧바로 다시 붙으면 다시 차오르게
  useLayoutEffect(
    () => () => {
      riseRuns.current.forEach((r) => r.cancel())
      riseRuns.current = []
      rose.current = false
    },
    [],
  )

  // 값이 바뀌면 출렁이며 새 높이로
  useLayoutEffect(() => {
    geo.current = { xs, baseY }
    if (!ready) return
    const prev = shownLevels.current
    shownLevels.current = levels
    if (!prev || sameLevels(prev, levels)) return
    if (reduced || !sameShape(prev, levels)) {
      slosh.current?.stop()
      return
    }
    slosh.current?.run(prev, levels)
  }, [ready, levels, xs, baseY, reduced])

  // 고른 칸으로 미끄러진다(처음 나타날 때·창 크기가 바뀌면 바로 놓는다). 크기는 여기서(커밋 뒤 한 번) 잰다
  useLayoutEffect(() => {
    const g = glide.current
    const t = tipGlide.current
    if (!g || !t) return
    if (activeX === null) {
      g.reset()
      t.reset()
      return
    }
    measure.current = { pillW: pillRef.current?.offsetWidth ?? 0 }
    const tipW = tipRef.current?.offsetWidth ?? 0
    // 툴팁은 기준선 옆 — 왼쪽 절반에서는 오른쪽에, 오른쪽 절반에서는 왼쪽에(고른 점을 가리지 않게), 판 안으로
    const right = activeX - PAD.left <= plotW / 2
    const tipX = Math.min(Math.max(0, right ? activeX + TIP_GAP : activeX - TIP_GAP - tipW), Math.max(0, width - tipW))
    const resized = lastWidth.current !== width
    lastWidth.current = width
    g.set(activeX, { instant: resized || reduced, step })
    t.set(tipX, { instant: resized || reduced, step })
  }, [activeX, shownIndex, width, plotW, step, reduced])

  const indexAt = (offsetX: number) => {
    if (n <= 1 || plotW <= 0) return 0
    const ratio = (offsetX - PAD.left) / plotW
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    setActive(indexAt(e.clientX - e.currentTarget.getBoundingClientRect().left))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? n - 1
    const next =
      e.key === 'ArrowLeft'
        ? current - 1
        : e.key === 'ArrowRight'
          ? current + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null
    if (next === null) return
    e.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, next)))
  }

  const on = active !== null

  return (
    <div className="water-area">
      <div
        ref={containerRef}
        className="water-area__box"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel} — 좌우 화살표로 값을 볼 수 있어요`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
      >
        {ready && (
          <>
            <svg className="water-area__grid" width={width} height={height} aria-hidden>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - padRight} y1={yAt(t)} y2={yAt(t)} />
                  <text x={PAD.left - 10} y={yAt(t)} dy="0.32em" textAnchor="end">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              <g className="water-area__x">
                {labels.map((label, i) =>
                  (n - 1 - i) % labelEvery === 0 ? (
                    <text
                      key={`${label}-${i}`}
                      className={cx(i === active && 'is-under')}
                      x={xAt(i)}
                      y={height - 9}
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  ) : null,
                )}
              </g>
              {direct && n > 0 && (
                <g className="water-area__ends">
                  {spreadEnds(
                    series.map((s) => yAt(s.values[n - 1] ?? 0)),
                    PAD.top + 4,
                    baseY - 4,
                  ).map((ly, k) => (
                    <g key={series[k].key}>
                      <line
                        x1={xAt(n - 1) + 6}
                        y1={yAt(series[k].values[n - 1] ?? 0)}
                        x2={width - padRight + 14}
                        y2={ly}
                        stroke={series[k].color}
                      />
                      <text x={width - padRight + 18} y={ly} dy="0.32em">
                        {series[k].label}
                      </text>
                    </g>
                  ))}
                </g>
              )}
            </svg>

            <span
              ref={crossRef}
              className={cx('water-area__cross', on && 'is-on')}
              style={{ top: PAD.top, height: plotH }}
              aria-hidden
            />

            {series.map((s, k) => {
              const line = monotonePath(s.values.map((v, i) => [xAt(i), yAt(v)] as const))
              return (
                <svg
                  key={s.key}
                  ref={(el) => {
                    seriesEls.current[k] = el
                  }}
                  className="water-area__series"
                  width={width}
                  height={height}
                  style={{ transformOrigin: `0 ${baseY}px` }}
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={`${uid}-wash-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={washOf(s.color, series.length)} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path
                    className="water-area__wash"
                    d={washPath(line, xAt(0), xAt(n - 1), baseY)}
                    fill={`url(#${uid}-wash-${k})`}
                  />
                  <path className="water-area__line" d={line} stroke={s.color} />
                  {s.values.map((v, i) =>
                    showAllDots || i === active || i === n - 1 ? (
                      <circle
                        key={i}
                        data-i={i}
                        className="water-area__dot"
                        cx={xAt(i)}
                        cy={yAt(v)}
                        r={i === active ? 5.5 : 4}
                        fill={s.color}
                        stroke={WATER_RING}
                        strokeWidth={2}
                      />
                    ) : null,
                  )}
                </svg>
              )
            })}

            <span
              ref={pillRef}
              className={cx('water-area__pill', on && 'is-on')}
              style={{ top: height - 25 }}
              aria-hidden
            >
              {shownIndex !== null ? labels[shownIndex] : ''}
            </span>

            <div ref={tipRef} className={cx('water-tip', on && 'is-on')} style={{ top: PAD.top }} aria-hidden>
              {shownIndex !== null && (
                <>
                  <p className="water-tip__label">{labels[shownIndex]}</p>
                  {series.map((s) => (
                    <p key={s.key} className="water-tip__row">
                      <span className="water-tip__key water-tip__key--line" style={{ background: s.color }} />
                      <strong>{formatValue(s.values[shownIndex])}</strong>
                      <span>{s.label}</span>
                    </p>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* 표 보기 — 화면 낭독기용(툴팁 없이도 모든 값을 읽을 수 있게) */}
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

      {series.length > 1 && (
        <ul className="water-area__legend" aria-hidden>
          {series.map((s) => (
            <li key={s.key}>
              <span className="water-tip__key water-tip__key--line" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
