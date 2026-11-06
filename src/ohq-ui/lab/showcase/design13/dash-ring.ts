// 안쪽 점선 타원 — 캔버스에 그린다. 점선 48개가 각도로 고르게(한 칸 7.5° = 선 4° + 빈칸 3.5°) 놓인 원을
// 눌러 놓은 모양이라 옆에서는 짧고 아래에서는 길다. 선 굵기는 둘레 어디서나 1.5~2px로 같다.
// 228프레임 동안 48번째 조화의 위상을 따라가니 -1.134°/프레임(= -34°/초, 시계 반대 방향, 10.6초에 한 바퀴).
import { ellipsePoint, type Ellipse } from './orbit-geometry'

export const DASH_COUNT = 48
/** 한 칸 중 선이 차지하는 비율(4° / 7.5°) */
export const DASH_RATIO = 4 / 7.5
/** 도는 빠르기(라디안/초, -는 시계 반대) */
export const DASH_SPEED = (-34 * Math.PI) / 180

export interface DashRingStyle {
  color: string
  width: number
}

export const DASH_STYLE: DashRingStyle = { color: 'rgba(255, 86, 146, 0.21)', width: 1.35 }

/** ctx는 영상 px 좌표로 맞춰 둔 상태 */
export function drawDashRing(
  ctx: CanvasRenderingContext2D,
  ring: Ellipse,
  t: number,
  style: DashRingStyle = DASH_STYLE,
) {
  const step = (2 * Math.PI) / DASH_COUNT
  const span = step * DASH_RATIO
  const offset = DASH_SPEED * t
  ctx.beginPath()
  for (let i = 0; i < DASH_COUNT; i++) {
    const a = offset + i * step
    // 한 칸을 네 토막으로 — 긴 아래쪽 선도 타원을 따라 휜다
    for (let j = 0; j <= 4; j++) {
      const [x, y] = ellipsePoint(ring, a + (span * j) / 4)
      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.lineCap = 'butt'
  ctx.stroke()
}
