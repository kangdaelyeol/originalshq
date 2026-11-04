import { round3, since, waterClock } from './motion'
import { WATER_RIPPLE, createRippleLayer, drawRipple, sizeRipple, type RippleLayer } from './ripple'

// 물방울·물결(D7) — 고를 때 표시 알약 윗변에서 물방울이 튀어 올랐다 떨어져 두 번 통통 튀거나(bounce), 위에서
// 떨어져 작은 방울 아홉 알로 흩어지고(splash), 닿은 자리의 유리에 물결이 두 겹 퍼진다. 값은 영상 px
// (lab/showcase/design7/liquid-menu-data.ts) — 표시 알약 높이 50.5px 기준이라, 작은 부품은 scale로 줄인다
// (거리·빠르기·중력이 같이 줄어 시간표는 그대로).

export type WaterDropEffect = 'bounce' | 'splash'

export const WATER_DROP = {
  /** 고른 뒤 물방울이 나오기까지 — 한 칸 0.15s, 한 칸 더 갈 때마다 +32ms(F+4.5 → 네 칸 F+7.4) */
  delay: { base: 0.15, perStep: 0.032 },
  gravity: 4600,
  /** 표시 알약 윗변에서 534px/s로 튀어 올라 19px 아래(아이콘 위)에 앉아 두 번 통통(300·100px/s) */
  bounce: { launch: 534, sink: 19, rebound: 300, rebound2: 100, offsetX: 1.5 },
  /** 윗변 45px 위에 나타나 400px/s·중력 600으로 떨어지고, 윗변에서 0.05초 미끄러져 22px 아래에 부딪힌다 */
  splash: { above: 45, speed: 400, gravity: 600, impact: 22, slide: 0.05, lead: 0.03 },
  /** 물결 두 겹 — 반지름 22에서 초속 525px, 22px 간격, 0.3초. 어두운 고리는 밝은 고리 11px 안쪽(ripple.ts) */
  ripple: WATER_RIPPLE,
} as const

/** 튀는 방울 하나(각도 °, 0 = 오른쪽·-90 = 위, 거리 px, 반지름, 수명 s) — F402~F407 */
const PARTICLES = [
  { angle: -162, dist: 40, size: 2.4, life: 0.3 },
  { angle: -128, dist: 32, size: 2.6, life: 0.22 },
  { angle: -100, dist: 28, size: 2.3, life: 0.2 },
  { angle: -72, dist: 30, size: 2.8, life: 0.24 },
  { angle: -44, dist: 34, size: 2.5, life: 0.21 },
  { angle: -14, dist: 42, size: 2.7, life: 0.26 },
  { angle: 22, dist: 36, size: 2.3, life: 0.3 },
  { angle: 150, dist: 28, size: 2.1, life: 0.19 },
  { angle: 178, dist: 38, size: 2.2, life: 0.23 },
] as const

export interface WaterDropOptions {
  effect?: WaterDropEffect
  /** 고른 칸 가운데 x, px(층 기준) — splash는 여기로 떨어진다 */
  x: number
  /**
   * 지금 표시 알약 가운데 x(스프링으로 움직이는 중인 값) — bounce 방울은 이걸 따라간다(D7: 알약이 아직 넘쳐
   * 있을 때 솟아오른다). 없으면 x
   */
  follow?: (now: number) => number
  /** 표시 알약 윗변 y — bounce는 여기서 튀어 오르고 splash는 여기로 떨어진다 */
  surface: number
  /** 물결 가운데 y(보통 표시 알약 가운데) */
  rippleY: number
  /** 크기 배율 — 표시 알약 높이 / 50.5 */
  scale?: number
  /** 몇 칸 옮겼는지 — 물방울이 늦게 나오는 정도(D7 DROP_DELAY) */
  steps?: number
  /** 물결이 보일 유리 영역(이 밖으로는 안 퍼진다) — 없으면 층 전체 */
  clip?: { x: number; y: number; width: number; height: number; radius: number }
  /** 누른 시각(waterClock) */
  at?: number
}

interface Event extends Required<Omit<WaterDropOptions, 'clip' | 'at' | 'follow'>> {
  follow: ((now: number) => number) | null
  start: number
}

const NS = 'http://www.w3.org/2000/svg'
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

/** 물방울 한 알(반지름 5.5 유리구슬) — 아래쪽 밝은 초승달, 왼쪽 위 반짝임, 옅게 어두운 가장자리 */
function bead(g: SVGGElement) {
  g.append(
    el('circle', { r: 5.5, fill: '#fff', 'fill-opacity': 0.16, stroke: '#2a282d', 'stroke-opacity': 0.42, 'stroke-width': 0.9 }),
    el('path', { d: 'M-4.9 1.1A5 5 0 0 0 4.9 1.1A6.8 6.8 0 0 1-4.9 1.1Z', fill: '#fff', 'fill-opacity': 0.92 }),
    el('ellipse', { cx: -1.9, cy: -2.4, rx: 1.6, ry: 1.3, fill: '#fff', 'fill-opacity': 0.95 }),
  )
}

let uid = 0

/**
 * 물방울·물결을 그리는 엔진 — 부품 위에 겹친 SVG 한 장(px 단위, overflow visible)을 받아 그 안에 방울·
 * 튀는 방울·물결을 만들어 두고, trigger 때마다 rAF로 그린다. 끝나면 rAF가 멈추고 모두 숨는다.
 */
export class WaterFxEngine {
  private svg: SVGSVGElement
  private drop: SVGGElement
  private particles: SVGGElement[]
  /** 물결 고리(ripple.ts — WaterRipple과 같은 그리기) */
  private rip: RippleLayer
  private ev: Event | null = null
  private rippleAt = -Infinity
  private rippleX = 0
  private raf = 0

  constructor(svg: SVGSVGElement) {
    this.svg = svg
    // 차례: defs · 물결 무리(water-fx__rings) · 물방울(water-fx__drop) · 튀는 방울(water-fx__splash × 9) —
    // 부품이 클래스로 한쪽만 보이게 할 수 있다(고르기는 물결을 표시 알약 밑, 물방울을 위에 둔다)
    this.rip = createRippleLayer(`ohq-water-fx-${++uid}`)
    this.drop = el('g', { class: 'water-fx__drop', opacity: 0 })
    bead(this.drop)
    this.particles = PARTICLES.map(() => {
      const g = el('g', { class: 'water-fx__splash', opacity: 0 })
      bead(g)
      return g
    })
    svg.append(this.rip.defs, this.rip.group, this.drop, ...this.particles)
  }

  /** 물방울 하나 — 앞의 것이 아직 움직이면 새 것으로 바꾼다 */
  trigger(o: WaterDropOptions) {
    const now = waterClock()
    const at = since(o.at, now)
    const effect = o.effect ?? 'bounce'
    const steps = Math.max(1, o.steps ?? 1)
    const delay = WATER_DROP.delay.base + WATER_DROP.delay.perStep * (steps - 1)
    this.ev = {
      effect,
      x: o.x,
      follow: o.follow ?? null,
      surface: o.surface,
      rippleY: o.rippleY,
      scale: o.scale ?? 1,
      steps,
      start: at + delay - (effect === 'splash' ? WATER_DROP.splash.lead : 0),
    }
    this.rippleAt = -Infinity
    sizeRipple(this.rip, this.ev.scale, o.clip)
    this.kick()
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.svg.replaceChildren()
  }

  private kick() {
    if (this.raf) return
    const tick = () => {
      this.raf = 0
      if (this.frame(waterClock())) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  private frame(now: number): boolean {
    const dropBusy = this.ev ? this.renderDrop(now, this.ev) : false
    const rippleBusy = this.renderRipple(now)
    if (!dropBusy && !rippleBusy) this.ev = null
    return dropBusy || rippleBusy
  }

  private hideParticles() {
    this.particles.forEach((g) => g.setAttribute('opacity', '0'))
  }

  private place(g: SVGGElement, x: number, y: number, sx: number, sy: number, opacity: number) {
    g.setAttribute('transform', `translate(${round3(x)} ${round3(y)}) scale(${round3(sx)} ${round3(sy)})`)
    g.setAttribute('opacity', String(round3(opacity)))
  }

  private renderDrop(now: number, ev: Event): boolean {
    const tau = now - ev.start
    const k = ev.scale
    if (tau < 0) {
      this.drop.setAttribute('opacity', '0')
      this.hideParticles()
      return true
    }
    const g = WATER_DROP.gravity * k
    if (ev.effect === 'bounce') {
      const b = WATER_DROP.bounce
      const top = ev.surface
      const rest = ev.surface + b.sink * k
      const launch = b.launch * k
      const ix = ev.follow ? ev.follow(now) : ev.x
      const land = (launch + Math.sqrt(launch * launch + 2 * g * (rest - top))) / g
      let y: number
      let vy: number
      if (tau < land) {
        y = top - launch * tau + (g / 2) * tau * tau
        vy = -launch + g * tau
      } else {
        // 아이콘 위에 앉아 두 번 통통(F247 624 → F249 614 → F252 625)
        const s = tau - land
        const r1 = b.rebound * k
        const r2 = b.rebound2 * k
        const b1 = (2 * r1) / g
        const b2 = (2 * r2) / g
        if (s < b1) {
          y = rest - r1 * s + (g / 2) * s * s
          vy = -r1 + g * s
        } else if (s < b1 + b2) {
          const u = s - b1
          y = rest - r2 * u + (g / 2) * u * u
          vy = -r2 + g * u
        } else {
          y = rest
          vy = 0
        }
        if (this.rippleAt === -Infinity) {
          this.rippleAt = ev.start + land
          this.rippleX = ix
        }
      }
      const s = tau - land
      const opacity = s < 0.2 ? 1 : Math.max(0, 1 - (s - 0.2) / 0.09)
      // 표면에서 솟아날 때 작게 시작하고(F115), 빠를수록 세로로 늘어난다(F246)
      const grow = Math.min(1, 0.45 + tau / 0.045)
      const stretch = 1 + 0.25 * Math.min(1, Math.abs(vy) / (650 * k))
      this.place(this.drop, ix + b.offsetX * k, y, (k * grow) / Math.sqrt(stretch), k * grow * stretch, opacity)
      this.hideParticles()
      return s < 0.3
    }

    // splash — 위에서 떨어져 부딪힌다
    const sp = WATER_DROP.splash
    const spawn = ev.surface - sp.above * k
    const speed = sp.speed * k
    const gs = sp.gravity * k
    const impact = ev.surface + sp.impact * k
    const reachTop = (-speed + Math.sqrt(speed * speed + 2 * gs * (ev.surface - spawn))) / gs
    const hit = reachTop + sp.slide
    if (tau < hit) {
      let y: number
      if (tau < reachTop) y = spawn + speed * tau + (gs / 2) * tau * tau
      else {
        const u = (tau - reachTop) / sp.slide
        y = ev.surface + (impact - ev.surface) * (1 - (1 - u) * (1 - u))
      }
      const falling = tau < reachTop ? 1 : 1 - (tau - reachTop) / sp.slide
      const stretch = 1 + 0.35 * falling
      this.place(this.drop, ev.x, y, k / Math.sqrt(stretch), k * stretch, Math.min(1, tau / 0.02))
      this.hideParticles()
      return true
    }
    this.drop.setAttribute('opacity', '0')
    if (this.rippleAt === -Infinity) {
      this.rippleAt = ev.start + hit
      this.rippleX = ev.x
    }
    // 둘레로 튀는 작은 방울(F401 무더기 → F403 반지름 25~35 → F405 45, F407에 마지막 한두 알)
    const s = tau - hit
    let alive = false
    PARTICLES.forEach((p, i) => {
      const node = this.particles[i]
      const out = 1 - Math.exp(-s / 0.07)
      const rad = (p.angle * Math.PI) / 180
      const o = s < p.life * 0.55 ? 1 : Math.max(0, 1 - (s - p.life * 0.55) / (p.life * 0.45))
      if (o > 0) alive = true
      const sc = (p.size / 5.5) * Math.min(1, 0.4 + s / 0.03) * k
      this.place(node, ev.x + Math.cos(rad) * p.dist * k * out, impact + Math.sin(rad) * p.dist * k * out, sc, sc, o)
    })
    return alive
  }

  /** 물결 두 겹 — 물방울이 닿은 자리에서(ripple.ts drawRipple) */
  private renderRipple(now: number): boolean {
    const ev = this.ev
    const rho = now - this.rippleAt
    if (!ev || !(rho >= 0 && rho < WATER_RIPPLE.life)) {
      this.rip.group.setAttribute('opacity', '0')
      return ev !== null && this.rippleAt === -Infinity
    }
    return drawRipple(this.rip, rho, ev.scale, this.rippleX, ev.rippleY)
  }
}
