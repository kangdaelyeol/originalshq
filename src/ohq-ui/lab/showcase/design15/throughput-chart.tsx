import { useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cx } from '../../../lib/cx'
import { cssVars } from './d15-format'
import { easeInOutCubic, prefersReducedMotion, tween } from './d15-motion'
import type { D15ThroughputDay } from './design15-data'

interface ThroughputChartProps {
  days: readonly D15ThroughputDay[]
  title?: string
  sub?: string
  index?: number
}

// 그림판(F600 2배 확대): 카드 x172~487 · 그림 x189~479(290px) · y193(12)~328(0). viewBox는 그림판 + 왼쪽 눈금 칸.
const PX = 12 // 그림 왼쪽(눈금 글자 자리)
const PW = 290
const PH = 135
const VW = PX + PW
const VH = PH + 14
const MAX = 12
const N = 90 // 기간이 바뀌어도 같은 수로 다시 뽑아 모양을 이어 바꾼다
const MORPH_MS = 600

const yOf = (v: number) => PH - (v / MAX) * PH
const xOf = (k: number, n: number) => PX + (n <= 1 ? 0 : (k / (n - 1)) * PW)

function resample(values: readonly number[]) {
  const n = values.length
  return Array.from({ length: N }, (_, k) => {
    const t = (k / (N - 1)) * (n - 1)
    const i = Math.min(n - 2, Math.floor(t))
    if (n === 1) return values[0]
    const f = t - i
    return values[i] * (1 - f) + values[i + 1] * f
  })
}

const linePath = (vals: readonly number[]) =>
  vals.map((v, k) => `${k ? 'L' : 'M'}${xOf(k, N).toFixed(2)} ${yOf(v).toFixed(2)}`).join(' ')

const areaPath = (vals: readonly number[]) => `${linePath(vals)} L${PX + PW} ${PH} L${PX} ${PH} Z`

/** 아래 날짜 이름 — 90일이면 Jul 12·Aug 3·Aug 26·Sep 17·Oct 9(F614) */
const tickIdx = (n: number) =>
  n <= 7 ? Array.from({ length: n }, (_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((k / 4) * (n - 1)))

/**
 * Throughput(F600·F630) — 이번 기간 7일 평균 면·선, 지난 기간 점선. 열릴 때 바닥에서 자라고(F583~F596
 * cubic-bezier(.4,0,.2,1) 0.45초), 기간을 바꾸면 같은 90점으로 다시 뽑아 0.6초에 모양이 바뀐다.
 * 올리면 세로 점선·점·짙은 말풍선("Jul 28 · 10 tasks · 7-day avg 7.1 · prev. 9", 오른쪽 끝이면 왼쪽으로).
 */
export function ThroughputChart({
  days,
  title = 'Throughput',
  sub = 'Tasks completed per day, 7-day average, against the previous period',
  index = 4,
}: ThroughputChartProps) {
  const grad = `d15-tp-${useId().replace(/:/g, '')}`
  const area = useRef<SVGPathElement>(null)
  const line = useRef<SVGPathElement>(null)
  const prev = useRef<SVGPathElement>(null)
  const shown = useRef<{ avg: number[]; prev: number[] } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const n = days.length
  const avg = days.map((d) => d.avg)
  const prevAvg = days.map((d) => d.prevAvg)
  const key = `${n}:${avg.join(',')}`

  useLayoutEffect(() => {
    const to = { avg: resample(days.map((d) => d.avg)), prev: resample(days.map((d) => d.prevAvg)) }
    const write = (a: number[], p: number[]) => {
      area.current?.setAttribute('d', areaPath(a))
      line.current?.setAttribute('d', linePath(a))
      prev.current?.setAttribute('d', linePath(p))
    }
    const from = shown.current
    if (!from || prefersReducedMotion()) {
      write(to.avg, to.prev)
      shown.current = to
      return
    }
    const now = { avg: [...from.avg], prev: [...from.prev] }
    shown.current = now
    // React가 방금 새 모양을 써 넣었다 — 칠하기 전에 옛 모양으로 되돌려 놓고 거기서 바꾼다
    write(now.avg, now.prev)
    return tween(MORPH_MS, (u) => {
      const e = easeInOutCubic(u)
      for (let k = 0; k < N; k++) {
        now.avg[k] = from.avg[k] + (to.avg[k] - from.avg[k]) * e
        now.prev[k] = from.prev[k] + (to.prev[k] - from.prev[k]) * e
      }
      write(now.avg, now.prev)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const u = (e.clientX - r.left) / r.width
    setHover(Math.max(0, Math.min(n - 1, Math.round(u * (n - 1)))))
  }

  const tip = hover !== null && hover < n ? days[hover] : null
  const tx = hover !== null ? xOf(hover, n) : 0
  const ty = tip ? yOf(avg[hover ?? 0]) : 0
  const flip = hover !== null && hover > (n - 1) * 0.62

  return (
    <section className="d15-card d15-tp d15-rise" style={cssVars({ '--i': index })} data-tour="throughput">
      <header className="d15-tp__head">
        <div>
          <h3 className="d15-card__title">{title}</h3>
          <p className="d15-card__sub">{sub}</p>
        </div>
        <ul className="d15-tp__legend">
          <li>
            <i className="is-now" />
            This period
          </li>
          <li>
            <i className="is-prev" />
            Previous
          </li>
        </ul>
      </header>
      <div className="d15-tp__plot">
        <svg viewBox={`0 0 ${VW} ${VH}`} aria-label={`${title} chart`}>
          <defs>
            <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="d15-tp__fill-top" />
              <stop offset="1" className="d15-tp__fill-bottom" />
            </linearGradient>
          </defs>
          {[0, 3, 6, 9, 12].map((v) => (
            <g key={v} className="d15-tp__grid">
              <line x1={PX} x2={PX + PW} y1={yOf(v)} y2={yOf(v)} />
              <text x={0} y={yOf(v) + 1.6}>
                {v}
              </text>
            </g>
          ))}
          <g className="d15-grow d15-tp__series" style={{ transformOrigin: `0 ${PH}px` }}>
            <path ref={area} className="d15-tp__area" fill={`url(#${grad})`} d={areaPath(resample(avg))} />
            <path ref={prev} className="d15-tp__prev" d={linePath(resample(prevAvg))} />
            <path ref={line} className="d15-tp__line" d={linePath(resample(avg))} />
          </g>
          {tickIdx(n).map((i) => (
            <text
              key={i}
              className="d15-tp__tick"
              x={xOf(i, n)}
              y={VH - 1.5}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {days[i].label}
            </text>
          ))}
          {tip && (
            <g className="d15-tp__hover">
              <line x1={tx} x2={tx} y1={0} y2={PH} />
              <circle cx={tx} cy={ty} r={2.6} />
            </g>
          )}
          <rect
            className="d15-tp__hit"
            x={PX}
            y={0}
            width={PW}
            height={PH}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {tip && (
          <div
            className={cx('d15-tp__tip', flip && 'is-flip')}
            style={cssVars({ '--x': `${(tx / VW) * 100}%`, '--y': `${(ty / VH) * 100}%` })}
          >
            <small>{tip.label}</small>
            <b>{tip.tasks} tasks</b>
            <small>
              7-day avg {tip.avg.toFixed(1)} · prev. {tip.prev}
            </small>
          </div>
        )}
      </div>
    </section>
  )
}
