import './glass-line.scss'
import { useId } from 'react'
import { smoothPath } from './smooth-path'

/**
 * 유리 선 그래프 한 줄 — 점들(px 좌표)을 지나는 굵은 곡선과 그 아래로
 * 옅어지는 면.
 * 좌표는 부르는 쪽이 그 상자의 실제 크기(px)로 준다(useElementSize).
 */
export const GlassLine = ({
  points,
  width,
  height,
  weight = 'md',
}: {
  points: [number, number][]
  width: number
  height: number
  /** 선 굵기 — md(큰 그래프) / sm(작은 추이 그래프). */
  weight?: 'sm' | 'md'
}) => {
  const fillId = `glass-line-fill-${useId().replace(/[^\w-]/g, '')}`
  if (width === 0 || height === 0 || points.length === 0) {
    return <svg className="glass_line" aria-hidden="true" />
  }
  const line = smoothPath(points)
  const first = points[0]
  const last = points[points.length - 1]
  const area = `${line} L${last[0]},${height} L${first[0]},${height} Z`

  return (
    <svg
      className={`glass_line is-${weight}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="glass_line_area_top" />
          <stop offset="100%" className="glass_line_area_bottom" />
        </linearGradient>
      </defs>
      <path className="glass_line_area" d={area} fill={`url(#${fillId})`} />
      <path className="glass_line_stroke" d={line} />
    </svg>
  )
}
