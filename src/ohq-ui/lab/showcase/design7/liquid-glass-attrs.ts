import { CLOSED_R, PILL_HALF_H, TRACK_H, TRACK_INSET, TRACK_TOP, type LiquidGeometry, type LiquidPose } from './liquid-menu-data'

/**
 * 그릴 때 보정 — 물 필터는 원을 σ²/2r ≈ 0.8px 깎지만, 채널을 꺼낼 때 가장자리 반투명 픽셀이 꽉 차서
 * 모양이 0.5~1px 커진다. 둘을 더해 원은 0.2px 작게, 알약 위쪽은 0.5px 내려 그린다(F1 단면 맞춤).
 */
const GOO_GROW = -0.2
export const PILL_TOP_INSET = 0.5

/** 모양(pose) → 유리 몸 SVG 속성. 첫 렌더와 엔진이 같이 쓴다 */
export function glassAttrs(pose: LiquidPose, geo: LiquidGeometry) {
  const left = Math.min(pose.pillL, pose.pillR)
  const pillW = Math.abs(pose.pillR - pose.pillL)
  const trackFull = geo.pillLen - TRACK_INSET * 2
  let trackW = trackFull * pose.track
  // 홈이 제 높이보다 짧아지면 점처럼 통째로 작아진다(F26 짧은 알약 → F27 점)
  const trackH = TRACK_H * Math.min(1, trackW / TRACK_H)
  trackW = Math.max(trackW, trackH)
  const mid = (pose.pillL + pose.pillR) / 2
  return {
    cx: pose.cx,
    r: pose.r + GOO_GROW,
    pillX: left,
    pillW,
    pillRx: Math.min(PILL_HALF_H, pillW / 2),
    pillFill: `rgb(0,${Math.round(255 * Math.min(1, Math.max(0, pose.pillOn)))},0)`,
    pillDisplay: pose.pillOn > 0.002 && pillW > 0.5 ? 'inline' : 'none',
    solidOpacity: Math.max(0, Math.min(1, pose.solid)),
    trackX: mid - trackW / 2,
    trackY: TRACK_TOP + (TRACK_H - trackH) / 2,
    trackW,
    trackH,
    trackDisplay: trackH > 0.6 ? 'inline' : 'none',
  }
}

/** 버튼 장식(반사광·윤광)은 원 크기를 따라 줄고 는다 */
export function buttonScale(pose: LiquidPose) {
  return pose.r / CLOSED_R
}
