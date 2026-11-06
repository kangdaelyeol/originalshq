import { useId, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { areaPath, monotonePath, toPoints } from './chart-path'
import { D16_T, EASE, play } from './d16-motion'
import type { RangeData } from './design16-data'

// 판(큰 카드) 기준 좌표 — viewBox 346×155가 창 x 130~476 · y 125~280에 놓인다.
// 눈금선 y 142 · 171.25 · 200.5 · 229.75 · 259(창) = 17 … 134, 선은 x 159~466(창) = 29~336.
const BOX = { x0: 29, x1: 336, topY: 17, baseY: 134 }
const GRID_X0 = 25
const LABEL_X = 9
const XLABEL_Y = 143

interface SalesChartProps {
  range: RangeData
  /** 지난 기간 점선 */
  compare?: boolean
  /** 처음 그리기 시작(초) — null이면 다 그려진 채 */
  introDelay?: number | null
  /** 바꾸면 같은 기간이라도 다시 그린다(처음부터 재생) */
  drawKey?: number
  className?: string
}

/**
 * Sales studio 차트 — 눈금 다섯 줄·왼쪽 값·아래 날짜, 강조색 선(단조 3차)·옅은 면·지난 기간 점선.
 * 기간이 바뀌면 축은 바로 바뀌고 선이 왼쪽에서부터 power2.inOut 0.833초로 그려진다(호 길이 비율로 맞춤).
 */
export function SalesChart({ range, compare = true, introDelay = null, drawKey = 0, className }: SalesChartProps) {
  const id = useId()
  const lineRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)
  const prevRef = useRef<SVGGElement>(null)
  // 지난번 그린 (기간, drawKey)와 그때 기다린 시간 — StrictMode가 효과를 두 번 돌려도 처음 지연을 지킨다
  const lastRef = useRef<{ key: string; drawKey: number; delay: number | null } | null>(null)

  const pts = toPoints(range.series, { ...BOX, top: range.top })
  const prevPts = toPoints(range.compare, { ...BOX, top: range.top })
  const n = range.series.length

  useLayoutEffect(() => {
    const last = lastRef.current
    const same = last && last.key === range.key && last.drawKey === drawKey
    const delay = same ? last.delay : last ? D16_T.chartRedrawDelay : introDelay
    lastRef.current = { key: range.key, drawKey, delay }
    if (delay === null) return
    const anims = [
      play(lineRef.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: D16_T.chartDraw,
        delay,
        easing: EASE.quadInOut,
      }),
      play(areaRef.current, [{ opacity: 0 }, { opacity: 1 }], {
        duration: D16_T.areaFade,
        delay: delay + D16_T.chartDraw * D16_T.areaAt,
      }),
      play(prevRef.current, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], {
        duration: D16_T.compareDraw,
        delay: delay + D16_T.compareDelay,
        easing: EASE.quadOut,
      }),
    ]
    return () => anims.forEach((a) => a?.cancel())
  }, [range.key, drawKey, introDelay])

  return (
    <svg className={cx('d16-chart', className)} viewBox="0 0 346 155" aria-label={`Sales, ${range.key}`}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--d16-accent)" stopOpacity="0.34" />
          <stop offset="1" stopColor="var(--d16-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="d16-chart__grid">
        {range.ticks.map((tick, i) => {
          const y = BOX.topY + (i * (BOX.baseY - BOX.topY)) / (range.ticks.length - 1)
          return (
            <g key={i}>
              <line
                x1={GRID_X0}
                x2={BOX.x1}
                y1={y}
                y2={y}
                className={i === range.ticks.length - 1 ? 'is-base' : undefined}
              />
              <text x={LABEL_X} y={y} dominantBaseline="middle">
                {tick}
              </text>
            </g>
          )
        })}
      </g>
      <g className="d16-chart__x">
        {range.xLabels.map(({ i, text }) => (
          <text
            key={text}
            x={BOX.x0 + (n === 1 ? 0 : (i * (BOX.x1 - BOX.x0)) / (n - 1))}
            y={XLABEL_Y}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >
            {text}
          </text>
        ))}
      </g>
      <path ref={areaRef} className="d16-chart__area" d={areaPath(pts, BOX.baseY)} fill={`url(#${id}a)`} />
      <g ref={prevRef} className={cx('d16-chart__prev', !compare && 'is-off')}>
        <path d={monotonePath(prevPts)} />
      </g>
      <path ref={lineRef} className="d16-chart__line" d={monotonePath(pts)} pathLength={1} />
    </svg>
  )
}
