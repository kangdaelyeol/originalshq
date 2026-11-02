import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { MORPH_DEFAULT_SHAPES, MORPH_DEFAULT_STOPS, morphPath, type MorphShapeName } from './morph-shapes'
import { useLoopClock } from './use-loop-clock'

interface MorphShapeProps {
  /** 차례로 바뀔 모양 — 마지막 다음엔 첫 모양으로 돌아온다(영상: 원 → X → 별) */
  shapes?: readonly MorphShapeName[]
  /** 각 모양에 다다르는 시각(초, 한 바퀴 2초) — shapes와 개수가 같아야 한다 */
  stops?: readonly number[]
  className?: string
}

/**
 * 04 모핑 — 점 360개로 된 윤곽이 원 → X(네 잎) → 네 꼭지 별 → 원으로 쉼 없이 바뀐다.
 * 사이 모양(꽃잎 8개, 마름모)은 따로 그린 게 아니라 점끼리 섞이며 저절로 생긴다.
 */
export function MorphShape({ shapes = MORPH_DEFAULT_SHAPES, stops = MORPH_DEFAULT_STOPS, className }: MorphShapeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  const draw = useCallback((t: number) => pathRef.current?.setAttribute('d', morphPath(shapes, stops, t)), [shapes, stops])
  useLoopClock(svgRef, draw)

  return (
    <svg ref={svgRef} className={cx('d10-morph', className)} viewBox="-80 -80 160 160" aria-hidden>
      <path ref={pathRef} d={morphPath(shapes, stops, 0)} />
    </svg>
  )
}
