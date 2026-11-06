// 가운데 칩 → 카드 선. 캔버스에 그린다(칩·카드 DOM이 위에 있어 양 끝은 가려진다).
// · 선: 분홍 2px(가운데 (189,96,129), 가장자리 옅은 번짐). 끝이 easeOutQuad로 0.1초에 카드까지 뻗고,
//   뻗는 동안 끝에 흰 빛 점(지름 5px)이 달린다(카드에 닿으면 사라진다).
// · 앞쪽 카드(아래 60°~135°)로는 늘 아주 옅은 실선이 있다(선 밝기의 5% 남짓, 뒤쪽 카드에는 없다).
import { smoothstep } from './d13-timeline'

const PINK = '255, 79, 139'

export function drawLinkBeam(
  ctx: CanvasRenderingContext2D,
  from: readonly [number, number],
  to: readonly [number, number],
  head: number,
  alpha: number,
  tip: HTMLCanvasElement | null,
) {
  if (alpha <= 0.002 || head <= 0) return
  const x = from[0] + (to[0] - from[0]) * head
  const y = from[1] + (to[1] - from[1]) * head
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from[0], from[1])
  ctx.lineTo(x, y)
  ctx.strokeStyle = `rgba(${PINK}, ${0.12 * alpha})`
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.strokeStyle = `rgba(${PINK}, ${0.8 * alpha})`
  ctx.lineWidth = 1.5
  ctx.stroke()
  // 끝 빛 점 — 닿기 직전부터 사라진다
  const tipAlpha = alpha * (1 - smoothstep(0.86, 1, head))
  if (tip && tipAlpha > 0.01) {
    const r = 7
    ctx.globalAlpha = tipAlpha
    ctx.drawImage(tip, x - r, y - r, r * 2, r * 2)
    ctx.globalAlpha = 1
  }
}

/** 앞쪽 카드로 가는 옅은 실선 — 세기 0~1(깊이로 정한다) */
export function drawSpoke(
  ctx: CanvasRenderingContext2D,
  from: readonly [number, number],
  to: readonly [number, number],
  strength: number,
) {
  if (strength <= 0.01) return
  ctx.beginPath()
  ctx.moveTo(from[0], from[1])
  ctx.lineTo(to[0], to[1])
  ctx.strokeStyle = `rgba(${PINK}, ${0.075 * strength})`
  ctx.lineWidth = 1.1
  ctx.stroke()
}

/** sin θ가 0.62~0.92일 때 0 → 1(아래쪽 60°~135° 남짓에서만 보인다) */
export const spokeStrength = (theta: number) => smoothstep(0.62, 0.92, Math.sin(theta))

/** 선 끝 흰 빛 점(한 번 그려 둔다) */
export function createTipSprite(size = 32) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.3, 'rgba(255, 250, 253, 1)')
  g.addColorStop(0.42, 'rgba(255, 170, 205, 0.55)')
  g.addColorStop(0.7, 'rgba(255, 79, 139, 0.16)')
  g.addColorStop(1, 'rgba(255, 79, 139, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}
