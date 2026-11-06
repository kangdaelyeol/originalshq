import { useId } from 'react'

interface SparklineProps {
  /** 0~1 값들 */
  points: readonly number[]
  className?: string
}

/** KPI 칸 아래 꼬마 면 그래프(F600: 칸 아래 16px, 선 + 옅은 면) — 장면이 열릴 때 바닥에서 자란다 */
export function Sparkline({ points, className }: SparklineProps) {
  const grad = `d15-spark-${useId().replace(/:/g, '')}`
  const w = 100
  const h = 24
  const step = w / (points.length - 1)
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(2)} ${(h - 2 - p * (h - 6)).toFixed(2)}`)
    .join(' ')
  return (
    <svg className={className ?? 'd15-spark'} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="d15-spark__top" />
          <stop offset="1" className="d15-spark__bottom" />
        </linearGradient>
      </defs>
      <g className="d15-grow">
        <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${grad})`} />
        <path d={line} className="d15-spark__line" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}
