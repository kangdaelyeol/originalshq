import type { CSSProperties } from 'react'

interface GlassPlateProps {
  /** 올라갈 알약 수 — 판 세로 길이가 알약 간격(11em)만큼씩 늘어난다(영상은 3) */
  rows?: number
}

/**
 * 알약을 받치는 유리 판(Design 6) — 두께 2.7em의 둥근 네모 판. 밝은 장면에선 바탕이 비치는 맑은 유리,
 * 어두운 장면에선 검은 판에 가까운 쪽 모서리만 빛난다. 판 평면(.d6-rig) 원점에 가운데를 맞춘다.
 */
export function GlassPlate({ rows = 3 }: GlassPlateProps) {
  return <div className="d6-plate" style={{ '--d6-rows': rows } as CSSProperties} aria-hidden />
}
