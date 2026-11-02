import { useMemo } from 'react'
import { demoRopeAt } from './jelly-engine'
import { ROPE_ANCHOR_X, ROPE_BASE_Y, ROPE_POINTS } from './jelly-rope'

interface JellyRopeDiagramProps {
  /** 영상 프레임 — 그 순간의 줄 모양 */
  frame: number
  label: string
}

// 옆에서 본 단면(세계 x -1.08~1.0, y -0.1~0.62)을 SVG 좌표로
const X0 = -1.08
const X1 = 1.0
const Y0 = -0.1
const Y1 = 0.62
const W = 260
const H = Math.round((W * (Y1 - Y0)) / (X1 - X0))
const sx = (x: number) => ((x - X0) / (X1 - X0)) * W
const sy = (y: number) => ((Y1 - y) / (Y1 - Y0)) * H

/**
 * 젤리 뼈대(견본용) — 물리가 움직이는 점 17개와, 그 점들을 잇는 이차 베지어 16개를 옆에서 본 그림.
 * 렌더러는 이 곡선까지의 거리로 띠를 만든다(jelly-shaders.ts BEZIER_FS).
 */
export function JellyRopeDiagram({ frame, label }: JellyRopeDiagramProps) {
  const { d, points } = useMemo(() => {
    const rope = demoRopeAt(frame)
    const p = rope.pos
    const c = rope.controls
    let path = `M${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`
    for (let i = 0; i < ROPE_POINTS - 1; i++) {
      path += ` Q${sx(c[i * 2]).toFixed(1)} ${sy(c[i * 2 + 1]).toFixed(1)} ${sx(p[i * 2 + 2]).toFixed(1)} ${sy(p[i * 2 + 3]).toFixed(1)}`
    }
    const pts = Array.from({ length: ROPE_POINTS }, (_, i) => ({ x: sx(p[i * 2]), y: sy(p[i * 2 + 1]) }))
    return { d: path, points: pts }
  }, [frame])

  const floor = sy(ROPE_BASE_Y)
  return (
    <svg className="d4-rope" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line className="d4-rope__floor" x1={sx(ROPE_ANCHOR_X)} x2={W} y1={floor} y2={floor} />
      <path className="d4-rope__curve" d={d} />
      {points.map((pt, i) => (
        <circle
          key={i}
          className={i === 0 ? 'd4-rope__anchor' : i === ROPE_POINTS - 1 ? 'd4-rope__knob' : 'd4-rope__point'}
          cx={pt.x}
          cy={pt.y}
          r={i === 0 || i === ROPE_POINTS - 1 ? 3.2 : 2.1}
        />
      ))}
    </svg>
  )
}
