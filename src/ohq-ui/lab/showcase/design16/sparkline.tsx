import { useId, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { areaPath, monotonePath, toPoints } from './chart-path'
import { EASE, play } from './d16-motion'

interface SparklineProps {
  values: readonly number[]
  /** 영상 px — Orders today 칸은 51×13 */
  width?: number
  height?: number
  /** 그려지기 시작(초) — null이면 바로 다 그려진 채 */
  drawDelay?: number | null
  className?: string
}

/** 꼬마 선 — 강조색 선과 아래로 옅어지는 면 */
export function Sparkline({ values, width = 51, height = 13, drawDelay = null, className }: SparklineProps) {
  const id = useId()
  const lineRef = useRef<SVGPathElement>(null)
  const max = Math.max(...values, 1)
  const pts = toPoints(values, { x0: 0.6, x1: width - 0.6, topY: 1, baseY: height - 1, top: max })

  useLayoutEffect(() => {
    if (drawDelay === null) return
    const a = play(lineRef.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 0.7,
      delay: drawDelay,
      easing: EASE.quadInOut,
    })
    return () => a?.cancel()
  }, [drawDelay])

  return (
    <svg className={cx('d16-spark', className)} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--d16-accent)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--d16-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath(pts, height)} fill={`url(#${id}f)`} />
      <path ref={lineRef} className="d16-spark__line" d={monotonePath(pts)} pathLength={1} />
    </svg>
  )
}
