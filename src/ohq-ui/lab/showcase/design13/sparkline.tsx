import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Frame } from './d13-clock'
import { SPARK_PERIOD } from './d13-timeline'

interface SparklineProps {
  /** 마디(출렁임 0) 자리 — 선 왼쪽부터 영상 px(0~39). 없으면 평평한 선(PROSE) */
  node?: number
  /** 출렁임 위상(라디안) */
  phase?: number
  className?: string
}

// 영상 꼬마 선: 39 × 14px(TRADER x 82~120). 열마다 세로 자리가 0.906초 주기로 출렁이고(다섯 칸 모두 같은 주기),
// 출렁임 세기는 가로로 |sin| 꼴(마디 사이 25px, 가장 셀 때 ±3px), 위상은 오른쪽으로 0.36rad/px씩 늘어 물결이 왼쪽으로 흐른다.
const W = 39
const H = 14
const MID = 6.6
const AMP = 3
const NODE_GAP = 25
const WAVE_K = 0.36
/** 꺾은선 점 수(2px 남짓마다) */
const POINTS = 20

function sparkPath(t: number, node: number | undefined, phase: number) {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const x = (W * i) / POINTS
    const y =
      node === undefined
        ? MID + 0.4
        : MID +
          AMP *
            Math.sin((Math.PI * (x - node)) / NODE_GAP) *
            Math.sin(WAVE_K * x + (2 * Math.PI * t) / SPARK_PERIOD + phase)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(2)}`
  }
  return d
}

/** 숫자 칸 오른쪽 위 꼬마 선 — 매 프레임 path만 고친다(평평한 선은 한 번만) */
export function Sparkline({ node, phase = 0, className }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  const draw = useCallback(
    (t: number) => {
      const path = pathRef.current
      if (!path || (node === undefined && path.hasAttribute('d'))) return
      path.setAttribute('d', sparkPath(t, node, phase))
    },
    [node, phase],
  )
  useD13Frame(svgRef, draw)

  return (
    <svg ref={svgRef} className={cx('d13-spark', className)} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path ref={pathRef} />
    </svg>
  )
}
