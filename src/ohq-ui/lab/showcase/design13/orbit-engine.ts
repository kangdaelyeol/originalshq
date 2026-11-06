// 궤도 장면 엔진 — t(초)만 보고 한 장면을 그린다. 캔버스(점선·입자·선)는 다시 칠하고, 카드·이름표·판정표·칩 번호는
// DOM의 transform·CSS 변수·글을 직접 고친다(transform 말고는 바뀔 때만). React는 처음 한 번만 그린다.
import type { OrbitAgent, OrbitEvent } from './design13-data'
import { drawDashRing } from './dash-ring'
import { BADGE_FROM, BADGE_TO, HEAT_STEPS, LINK_ARRIVE, eventIndexAt, eventStartAt, linkAt } from './d13-timeline'
import { createTipSprite, drawLinkBeam, drawSpoke, spokeStrength } from './link-beam'
import {
  D13_INNER,
  D13_ORBIT,
  SCENE_W,
  cardScaleOf,
  cardThetaAt,
  depthOf,
  ellipsePoint,
  type Ellipse,
} from './orbit-geometry'
import {
  createParticleField,
  createParticleSprites,
  drawParticleField,
  fitCanvas,
  type ParticleField,
} from './particle-field'

export interface OrbitEngineDom {
  canvas: HTMLCanvasElement
  /** 카드(agents 차례) */
  cards: HTMLElement[]
  /** 카드마다 따라붙는 분홍 네모(없으면 null) */
  tags: (HTMLElement | null)[]
  badge: HTMLElement | null
  badgeText: HTMLElement | null
  serial: HTMLElement | null
}

export interface OrbitEngineOptions {
  agents: readonly OrbitAgent[]
  events: readonly OrbitEvent[]
  particles: number
  orbit?: Ellipse
  inner?: Ellipse
  /** 칩 번호를 고칠지(#001부터 사건마다 +1) */
  serialFrom?: number
}

// 이름표: 카드 각 그대로, 궤도의 1.19배(앞쪽은 1.22배 — 아래에서 카드와 겹치지 않게) 자리. 천천히 떠돌고
// (가로 ±13px·세로 ±4px, 5~7초) 0.97초마다 ±7° 까딱인다.
const TAG_RHO = 1.19
// 초록 판정표: 왼쪽 끝 = 카드 가운데 + 11.5px, 아래 끝 = 카드 위 끝 - 1.5px(카드 절반 높이 16.5px × 크기)
const BADGE_DX = 11.5
const BADGE_GAP = 1.5
const CARD_HALF_H = 16.5

const em = (px: number) => (px / 10).toFixed(3)
const mod = (a: number, n: number) => ((a % n) + n) % n

export class OrbitEngine {
  readonly #dom: OrbitEngineDom
  readonly #opts: Required<Omit<OrbitEngineOptions, 'serialFrom'>> & { serialFrom: number | null }
  readonly #ctx: CanvasRenderingContext2D | null
  readonly #field: ParticleField
  readonly #sprites: HTMLCanvasElement[]
  readonly #tip: HTMLCanvasElement
  #scale = 1
  // 바뀔 때만 쓰려고 기억
  #heat: number[] = []
  #depth: string[] = []
  #z: number[] = []
  #event = Number.NaN
  #badgeOn = false

  constructor(dom: OrbitEngineDom, opts: OrbitEngineOptions) {
    this.#dom = dom
    this.#opts = {
      agents: opts.agents,
      events: opts.events,
      particles: opts.particles,
      orbit: opts.orbit ?? D13_ORBIT,
      inner: opts.inner ?? D13_INNER,
      serialFrom: opts.serialFrom ?? null,
    }
    this.#ctx = dom.canvas.getContext('2d')
    this.#field = createParticleField({ count: opts.particles })
    this.#sprites = createParticleSprites()
    this.#tip = createTipSprite()
    this.resize()
  }

  /** 캔버스 크기를 다시 맞춘다(요소 크기·기기 배율이 바뀔 때) */
  resize() {
    this.#scale = fitCanvas(this.#dom.canvas, SCENE_W)
  }

  draw(t: number, still: boolean) {
    const { agents, events, orbit, inner } = this.#opts
    const n = agents.length
    const k = eventIndexAt(t)
    const u = t - eventStartAt(k)
    const ev = events.length ? events[mod(k, events.length)] : null
    const center: [number, number] = [orbit.cx, orbit.cy]

    // 카드 자리 먼저(선·판정표가 따라간다)
    const pos: [number, number][] = []
    const thetas: number[] = []
    for (let i = 0; i < n; i++) {
      const theta = cardThetaAt(i, n, t)
      thetas.push(theta)
      pos.push(ellipsePoint(orbit, theta))
    }

    // ── 캔버스 ──
    const ctx = this.#ctx
    if (ctx) {
      const { canvas } = this.#dom
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(this.#scale, 0, 0, this.#scale, 0, 0)
      drawDashRing(ctx, inner, t)
      for (let i = 0; i < n; i++) drawSpoke(ctx, center, pos[i], spokeStrength(thetas[i]))
      drawParticleField(ctx, this.#field, this.#sprites, orbit, t)
      if (ev && k >= 0 && !still) {
        const target = agents.findIndex((a) => a.id === ev.agent)
        if (target >= 0) {
          const { head, alpha } = linkAt(u)
          drawLinkBeam(ctx, center, pos[target], head, alpha, this.#tip)
        }
      }
    }

    // ── 카드 ──
    for (let i = 0; i < n; i++) {
      const card = this.#dom.cards[i]
      if (!card) continue
      const theta = thetas[i]
      const d = depthOf(theta)
      const s = cardScaleOf(theta)
      const [x, y] = pos[i]
      card.style.transform = `translate3d(${em(x)}em, ${em(y)}em, 0) translate(-50%, -50%) scale(${s.toFixed(4)})`
      // 뒤로 갈수록 글자만 흐리게(바탕은 불투명해서 입자가 비치지 않는다) — 0.01 단위로 바뀔 때만
      const depth = d.toFixed(2)
      if (this.#depth[i] !== depth) {
        this.#depth[i] = depth
        card.style.setProperty('--d13-depth', depth)
      }
      const z = 1 + Math.round(d * 20)
      if (this.#z[i] !== z) {
        this.#z[i] = z
        card.style.zIndex = String(z)
      }
      const heat = this.#heatOf(agents[i].id, k, u)
      if (this.#heat[i] !== heat) {
        this.#heat[i] = heat
        card.style.setProperty('--d13-heat', String(heat))
        card.style.setProperty('--d13-edge', Math.sqrt(heat).toFixed(3))
      }
      const tag = this.#dom.tags[i]
      if (tag) this.#placeTag(tag, i, theta, d, t)
    }

    // ── 초록 판정표 ──
    const badge = this.#dom.badge
    if (badge) {
      const target = ev ? agents.findIndex((a) => a.id === ev.agent) : -1
      const on = !still && k >= 0 && target >= 0 && u >= BADGE_FROM && u < BADGE_TO
      if (on && ev) {
        const s = cardScaleOf(thetas[target])
        const [x, y] = pos[target]
        badge.style.transform = `translate3d(${em(x + BADGE_DX)}em, ${em(y - CARD_HALF_H * s - BADGE_GAP)}em, 0) translateY(-100%)`
      }
      if (on !== this.#badgeOn) {
        this.#badgeOn = on
        badge.classList.toggle('is-on', on)
      }
    }

    // ── 사건이 바뀔 때만: 판정표 글·칩 번호 ──
    if (k !== this.#event) {
      this.#event = k
      if (ev && this.#dom.badgeText) this.#dom.badgeText.textContent = `p ${ev.p.toFixed(2)} ${ev.word}`
      if (this.#dom.serial && this.#opts.serialFrom !== null) {
        // #001부터 사건마다 +1, #999 다음은 다시 #001
        const serial = ((this.#opts.serialFrom - 1 + Math.max(0, k)) % 999) + 1
        this.#dom.serial.textContent = `#${String(serial).padStart(3, '0')}`
      }
    }
  }

  /** 카드 불빛 — 가장 최근 사건부터 거꾸로: 지금 사건(선이 닿은 뒤) 1, 하나 전 0.48, 둘 전 0.2, 셋 전 0.06 */
  #heatOf(id: string, k: number, u: number) {
    const { events } = this.#opts
    if (!events.length) return 0
    for (let lv = 0; lv < HEAT_STEPS.length; lv++) {
      if (events[mod(k - lv, events.length)].agent !== id) continue
      if (lv === 0 && u < LINK_ARRIVE) continue
      return HEAT_STEPS[lv]
    }
    return 0
  }

  #placeTag(tag: HTMLElement, i: number, theta: number, d: number, t: number) {
    const { orbit } = this.#opts
    const [bx, by] = ellipsePoint(orbit, theta, TAG_RHO + 0.03 * d)
    const ph = i * 1.7
    const dx = 13 * Math.sin((2 * Math.PI * t) / (6.2 + 0.5 * (i % 3)) + ph)
    const dy = 4 * Math.sin((2 * Math.PI * t) / (4.8 + 0.6 * (i % 2)) + ph * 1.3 + 0.5)
    const rot = 7 * Math.sin((2 * Math.PI * t) / (0.97 + 0.03 * (i % 3)) + ph * 0.7)
    const s = 0.86 + 0.14 * d
    tag.style.transform = `translate3d(${em(bx + dx)}em, ${em(by + dy)}em, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(3)})`
    tag.style.opacity = (0.62 + 0.38 * d).toFixed(3)
  }
}
