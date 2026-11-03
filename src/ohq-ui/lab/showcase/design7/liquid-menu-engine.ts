import { buttonScale, glassAttrs } from './liquid-glass-attrs'
import {
  BOUNCE_DROP,
  CLOSE_SETTLE,
  DROP_DELAY,
  DROP_GRAVITY,
  ICON_STEP,
  INDICATOR_SPRING,
  INDICATOR_STRETCH,
  OPEN_SETTLE,
  RIPPLE,
  SPLASH_DROP,
  SPLASH_PARTICLES,
  closePose,
  mixPose,
  openPose,
  restPose,
  type LiquidEffect,
  type LiquidGeometry,
  type LiquidPose,
} from './liquid-menu-data'

/** 엔진이 직접 고치는 DOM — 매 프레임 React를 다시 그리지 않으려고 */
export interface LiquidMenuDom {
  circle: SVGCircleElement
  /** 따로 선 버튼의 불투명 유리(장식 안) */
  solid: HTMLElement
  pill: SVGRectElement
  track: SVGRectElement
  rings: SVGGElement
  button: HTMLElement
  decor: HTMLElement
  indicator: HTMLElement
  icons: HTMLElement[]
  label: HTMLElement
  drop: SVGGElement
  particles: SVGGElement[]
}

/**
 * 시계 — rAF 시각(= document.timeline)을 쓴다. 개발 도구에서 애니메이션을 느리게 돌리면
 * CSS 애니메이션과 함께 이 시계도 느려져서, 영상과 프레임 단위로 견줄 수 있다.
 */
export const liquidClock = () => {
  const t = document.timeline?.currentTime
  return (typeof t === 'number' ? t : performance.now()) / 1000
}
const nowSec = liquidClock

/** 누른 시각을 넘겨받으면 그때부터 잰다 — React가 효과를 늦게 돌려도(느린 기기) 움직임 시간이 어긋나지 않게 */
const since = (at: number | undefined, now: number) => (at === undefined ? now : Math.min(now, Math.max(at, now - 0.12)))

const smooth = (v: number) => {
  const c = v < 0 ? 0 : v > 1 ? 1 : v
  return c * c * (3 - 2 * c)
}
const round = (v: number) => Math.round(v * 1000) / 1000

/** 처음 속도가 있는 감쇠 스프링의 위치·속도(움직이는 도중 다시 골라도 끊기지 않게) */
function springAt(x0: number, v0: number, target: number, t: number) {
  const { zeta, omega } = INDICATOR_SPRING
  const root = Math.sqrt(1 - zeta * zeta)
  const wd = omega * root
  const a = x0 - target
  const b = (v0 + zeta * omega * a) / wd
  const e = Math.exp(-zeta * omega * t)
  const c = Math.cos(wd * t)
  const s = Math.sin(wd * t)
  return {
    x: target + e * (a * c + b * s),
    v: e * ((-zeta * omega * a + wd * b) * c + (-zeta * omega * b - wd * a) * s),
  }
}

interface DropEvent {
  effect: LiquidEffect
  x: number
  /** Bounce = 튀어 오르는 순간, Splash = 위에 나타나는 순간 */
  start: number
}

/** Bounce 물방울: 윗변에서 다시 아이콘 높이(-23)까지 떨어지는 데 걸리는 시간 */
const BOUNCE_LAND = (() => {
  const { launch, top, rest } = BOUNCE_DROP
  return (launch + Math.sqrt(launch * launch + 2 * DROP_GRAVITY * (rest - top))) / DROP_GRAVITY
})()
/** Splash 물방울: 윗변까지 떨어지는 시간 → 그 뒤 0.05초 동안 아이콘 위로 미끄러져 부딪힌다 */
const SPLASH_TOP = (() => {
  const { speed, gravity, top, spawn } = SPLASH_DROP
  return (-speed + Math.sqrt(speed * speed + 2 * gravity * (top - spawn))) / gravity
})()
const SPLASH_IMPACT = SPLASH_TOP + 0.05

export class LiquidMenuEngine {
  private dom: LiquidMenuDom
  private geo: LiquidGeometry
  private open: boolean
  private morphStart = -Infinity
  private morphFrom: LiquidPose | null = null
  private pose: LiquidPose
  private index: number
  private ind = { x0: 0, v0: 0, target: 0, start: -Infinity, span: ICON_STEP, s: 0 }
  private drop: DropEvent | null = null
  private rippleAt = -Infinity
  private rippleX = 0
  private rings: SVGCircleElement[][]
  private raf = 0
  private last = 0

  constructor(dom: LiquidMenuDom, geo: LiquidGeometry, open: boolean, index: number) {
    this.dom = dom
    this.geo = geo
    this.open = open
    this.index = index
    this.pose = restPose(open, geo)
    const x = geo.iconX(index)
    this.ind = { x0: x, v0: 0, target: x, start: -Infinity, span: ICON_STEP, s: 0 }
    this.rings = Array.from(dom.rings.querySelectorAll('[data-ring]'), (g) => Array.from(g.querySelectorAll('circle')))
    this.render(nowSec())
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  setOpen(open: boolean, at?: number) {
    if (open === this.open) return
    const now = since(at, nowSec())
    // 움직이는 도중이면 지금 모양에서 출발하도록 기억해 둔다
    this.morphFrom = this.morphing(now) ? this.pose : null
    this.open = open
    this.morphStart = now
    if (!open) this.drop = null
    this.kick()
  }

  setIndex(index: number, effect: LiquidEffect, at?: number) {
    if (index === this.index) return
    const steps = Math.abs(index - this.index)
    this.index = index
    const now = since(at, nowSec())
    const target = this.geo.iconX(index)
    if (!this.open) {
      // 닫힌 채로 바뀌면 자리만 옮긴다
      this.ind = { x0: target, v0: 0, target, start: -Infinity, span: ICON_STEP, s: 0 }
      this.kick()
      return
    }
    const cur = this.indicatorAt(now)
    this.ind = { x0: cur.x, v0: cur.v, target, start: now, span: Math.max(ICON_STEP, Math.abs(target - cur.x)), s: this.ind.s }
    const delay = DROP_DELAY.base + DROP_DELAY.perStep * (steps - 1)
    this.drop = { effect, x: target, start: now + delay - (effect === 'splash' ? SPLASH_DROP.lead : 0) }
    this.rippleAt = -Infinity
    this.kick()
  }

  private morphing(now: number) {
    return now - this.morphStart < (this.open ? OPEN_SETTLE : CLOSE_SETTLE)
  }

  private indicatorAt(now: number) {
    const t = now - this.ind.start
    if (!Number.isFinite(t) || t > 2) return { x: this.ind.target, v: 0 }
    return springAt(this.ind.x0, this.ind.v0, this.ind.target, t)
  }

  private kick() {
    if (this.raf) return
    this.last = nowSec()
    const tick = () => {
      this.raf = 0
      const now = nowSec()
      if (this.render(now)) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** 한 프레임 그리기 — 아직 움직이는 게 있으면 true */
  private render(now: number): boolean {
    const dt = Math.max(0, Math.min(0.05, now - this.last))
    this.last = now
    let busy = false

    // 1. 펼침·접힘 모양
    const t = now - this.morphStart
    let pose: LiquidPose
    if (this.morphing(now)) {
      busy = true
      pose = this.open ? openPose(t, this.geo) : closePose(t, this.geo)
      if (this.morphFrom && t < 0.15) pose = mixPose(this.morphFrom, pose, smooth(t / 0.15))
    } else {
      pose = restPose(this.open, this.geo)
      this.morphFrom = null
    }
    this.pose = pose
    this.applyPose(pose)

    // 2. 표시 알약 — 스프링 + 속도만큼 가로로 늘고 세로로 준다
    const { x, v } = this.indicatorAt(now)
    const { max, perSpeed, squash, lag } = INDICATOR_STRETCH
    const want = Math.min(max, (perSpeed * Math.abs(v)) / this.ind.span)
    this.ind.s += (want - this.ind.s) * (1 - Math.exp(-dt / lag))
    if (now - this.ind.start < 0.9 || this.ind.s > 0.001) busy = true
    const k = pose.indicatorScale
    const sx = (1 + this.ind.s) * k
    const sy = (1 - squash * this.ind.s) * k
    const ind = this.dom.indicator
    ind.style.transform = `translate(${round(x / 10)}em, 0) scale(${round(sx)}, ${round(sy)})`
    ind.style.opacity = String(round(pose.indicator))

    // 3. 물방울·물결
    if (this.drop && this.renderDrop(now, x)) busy = true
    if (this.renderRipple(now)) busy = true
    return busy
  }

  private applyPose(p: LiquidPose) {
    const a = glassAttrs(p, this.geo)
    const { circle, solid, pill, track, button, decor, icons, label } = this.dom
    circle.setAttribute('cx', String(round(a.cx)))
    circle.setAttribute('r', String(round(a.r)))
    solid.style.opacity = String(round(a.solidOpacity))
    pill.setAttribute('x', String(round(a.pillX)))
    pill.setAttribute('width', String(round(a.pillW)))
    pill.setAttribute('rx', String(round(a.pillRx)))
    pill.setAttribute('fill', a.pillFill)
    pill.setAttribute('display', a.pillDisplay)
    track.setAttribute('x', String(round(a.trackX)))
    track.setAttribute('y', String(round(a.trackY)))
    track.setAttribute('width', String(round(a.trackW)))
    track.setAttribute('height', String(round(a.trackH)))
    track.setAttribute('rx', String(round(a.trackH / 2)))
    track.setAttribute('display', a.trackDisplay)
    button.style.transform = `translate(${round(p.cx / 10)}em, 0)`
    decor.style.transform = `scale(${round(buttonScale(p))})`
    icons.forEach((el, i) => {
      el.style.opacity = String(round(p.icons[i] ?? 0))
    })
    label.style.opacity = String(round(p.label))
  }

  private renderDrop(now: number, indicatorX: number): boolean {
    const ev = this.drop
    if (!ev) return false
    const tau = now - ev.start
    const { drop, particles } = this.dom
    const hideParticles = () => particles.forEach((g) => g.setAttribute('opacity', '0'))
    if (tau < 0) {
      drop.setAttribute('opacity', '0')
      hideParticles()
      return true
    }
    const g = DROP_GRAVITY
    if (ev.effect === 'bounce') {
      const { top, rest, launch, rebound, rebound2 } = BOUNCE_DROP
      const dx = indicatorX + 1.5
      let y: number
      let vy: number
      if (tau < BOUNCE_LAND) {
        y = top - launch * tau + (g / 2) * tau * tau
        vy = -launch + g * tau
      } else {
        // 아이콘 위에 앉아 두 번 통통(F247 624 → F249 614 → F252 625)
        const s = tau - BOUNCE_LAND
        const b1 = (2 * rebound) / g
        const b2 = (2 * rebound2) / g
        if (s < b1) {
          y = rest - rebound * s + (g / 2) * s * s
          vy = -rebound + g * s
        } else if (s < b1 + b2) {
          const u = s - b1
          y = rest - rebound2 * u + (g / 2) * u * u
          vy = -rebound2 + g * u
        } else {
          y = rest
          vy = 0
        }
        if (this.rippleAt === -Infinity) {
          this.rippleAt = ev.start + BOUNCE_LAND
          this.rippleX = indicatorX
        }
      }
      const s = tau - BOUNCE_LAND
      const opacity = s < 0.2 ? 1 : Math.max(0, 1 - (s - 0.2) / 0.09)
      // 표면에서 솟아날 때 작게 시작(F115), 빠를수록 세로로 늘어난다(F246)
      const grow = Math.min(1, 0.45 + tau / 0.045)
      const stretch = 1 + 0.25 * Math.min(1, Math.abs(vy) / 650)
      this.placeDrop(dx, y, grow / Math.sqrt(stretch), grow * stretch, opacity)
      hideParticles()
      return s < 0.3
    }

    // Splash
    const { spawn, speed, gravity, top, impact } = SPLASH_DROP
    if (tau < SPLASH_IMPACT) {
      let y: number
      if (tau < SPLASH_TOP) y = spawn + speed * tau + (gravity / 2) * tau * tau
      else {
        const u = (tau - SPLASH_TOP) / (SPLASH_IMPACT - SPLASH_TOP)
        y = top + (impact - top) * (1 - (1 - u) * (1 - u))
      }
      const falling = tau < SPLASH_TOP ? 1 : 1 - (tau - SPLASH_TOP) / (SPLASH_IMPACT - SPLASH_TOP)
      const stretch = 1 + 0.35 * falling
      this.placeDrop(ev.x, y, 1 / Math.sqrt(stretch), stretch, Math.min(1, tau / 0.02))
      hideParticles()
      return true
    }
    drop.setAttribute('opacity', '0')
    if (this.rippleAt === -Infinity) {
      this.rippleAt = ev.start + SPLASH_IMPACT
      this.rippleX = ev.x
    }
    // 아이콘 둘레로 튀는 작은 방울들(F401 무더기 → F403 반지름 25~35 → F405 45, F407에 마지막 한두 알)
    const s = tau - SPLASH_IMPACT
    let alive = false
    SPLASH_PARTICLES.forEach((p, i) => {
      const el = particles[i]
      if (!el) return
      const out = 1 - Math.exp(-s / 0.07)
      const rad = (p.angle * Math.PI) / 180
      const px = ev.x + Math.cos(rad) * p.dist * out
      const py = impact + Math.sin(rad) * p.dist * out
      const o = s < p.life * 0.55 ? 1 : Math.max(0, 1 - (s - p.life * 0.55) / (p.life * 0.45))
      if (o > 0) alive = true
      const sc = (p.size / 5.5) * Math.min(1, 0.4 + s / 0.03)
      el.setAttribute('transform', `translate(${round(px)} ${round(py)}) scale(${round(sc)})`)
      el.setAttribute('opacity', String(round(o)))
    })
    if (!alive) this.drop = null
    return alive
  }

  private placeDrop(x: number, y: number, sx: number, sy: number, opacity: number) {
    this.dom.drop.setAttribute('transform', `translate(${round(x)} ${round(y)}) scale(${round(sx)} ${round(sy)})`)
    this.dom.drop.setAttribute('opacity', String(round(opacity)))
  }

  /** 물결 두 겹 — 바깥 고리가 앞서고 안쪽이 22px 뒤따른다(F428: 60·72 / 81·93) */
  private renderRipple(now: number): boolean {
    const rho = now - this.rippleAt
    const group = this.dom.rings
    if (!(rho >= 0 && rho < RIPPLE.life)) {
      group.setAttribute('opacity', '0')
      return false
    }
    const fade = rho / RIPPLE.life
    group.setAttribute('opacity', String(round(1 - fade * fade)))
    const lead = RIPPLE.r0 + RIPPLE.speed * rho
    this.rings.forEach(([dark, bright], k) => {
      const r = lead - RIPPLE.gap * k
      const show = r > 6 ? '1' : '0'
      for (const [el, rr] of [
        [bright, r],
        [dark, r - 11],
      ] as const) {
        if (!el) continue
        el.setAttribute('cx', String(round(this.rippleX)))
        el.setAttribute('r', String(round(Math.max(1, rr))))
        el.setAttribute('opacity', show)
      }
    })
    return true
  }
}
