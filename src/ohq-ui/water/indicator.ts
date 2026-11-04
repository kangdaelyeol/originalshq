import { WATER_SPRING, WATER_STRETCH, round3, since, springAt, waterClock, type SpringSpec } from './motion'

/** 표시 알약이 놓일 자리 — 가운데(pos)와 길이(size), px. axis가 'x'면 가로 자리·폭, 'y'면 세로 자리·높이 */
export interface IndicatorTarget {
  pos: number
  size: number
}

interface Track {
  x0: number
  v0: number
  target: number
  start: number
}

const still = (v: number): Track => ({ x0: v, v0: 0, target: v, start: -Infinity })

/** 한 프레임에 그린 모양 — 가운데·길이(px)와 늘어남(along 진행 방향, across 옆) */
export interface IndicatorPose {
  pos: number
  size: number
  along: number
  across: number
}

export interface WaterIndicatorOptions {
  axis?: 'x' | 'y'
  spring?: SpringSpec
  /**
   * 옆 찌그러짐 배율 — 1(기본)이면 D7 그대로(늘어남 28%일 때 옆이 0.82배). 넓은 줄처럼 옆으로 긴 알약은 작게
   * (예: 800px 줄에 0.06이면 옆으로 9px쯤만 준다)
   */
  squash?: number
  /** 그릴 때마다(같은 rAF 안에서) — 알약을 따라 움직이는 다른 요소를 같은 프레임에 옮길 때 */
  onDraw?: (pose: IndicatorPose) => void
}

/**
 * 고른 표시 알약(D7 LiquidIndicator)의 움직임 — 가운데·길이를 같은 스프링(ζ0.65·ω30.5, 7% 넘침)으로 옮기고,
 * 달리는 빠르기만큼 진행 방향으로 늘고 옆으로 준다(최대 28%·옆은 0.64배, 15ms 늦게 따라감). 거리와 상관없이
 * 같은 모양이 되게 빠르기를 이동 거리로 나눈다. 움직이는 도중 다시 골라도 지금 위치·빠르기에서 이어 간다.
 *
 * 요소는 position:absolute·left/top 0에 두고, 엔진이 style(width|height·transform)을 rAF로 바로 고친다 —
 * React는 고른 값만 가진다. 멈추면 rAF도 멈춘다.
 */
export class WaterIndicatorEngine {
  private el: HTMLElement
  private axis: 'x' | 'y'
  private spec: SpringSpec
  private squash: number
  /** 그릴 때마다 부른다(같은 프레임) — 바꿔 끼울 수 있다 */
  onDraw: ((pose: IndicatorPose) => void) | null
  private pos: Track = still(0)
  private size: Track = still(0)
  /** 늘어남(0~0.28)과 그 기준 거리 */
  private s = 0
  private span = 1
  private raf = 0
  private last = 0
  private placed = false

  constructor(el: HTMLElement, opts: WaterIndicatorOptions = {}) {
    this.el = el
    this.axis = opts.axis ?? 'x'
    this.spec = opts.spring ?? WATER_SPRING.indicator
    this.squash = opts.squash ?? 1
    this.onDraw = opts.onDraw ?? null
  }

  /**
   * 새 자리로 — instant면 바로 놓는다(처음 그릴 때·창 크기 바뀔 때). at은 누른 시각(waterClock), step은 한 칸
   * 거리(D7 ICON_STEP — 늘어남을 재는 기준, 없으면 알약 길이)
   */
  set(target: IndicatorTarget, opts: { instant?: boolean; at?: number; step?: number } = {}) {
    const now = waterClock()
    if (opts.instant || !this.placed) {
      this.pos = still(target.pos)
      this.size = still(target.size)
      this.s = 0
      this.placed = true
      this.draw(target.pos, target.size)
      return
    }
    // 누른 시각부터 잰다 — 다만 너무 옛날이면(느린 기기) 0.12초까지만 거슬러 간다(D7 since)
    const start = since(opts.at, now)
    const p = this.sample(this.pos, start)
    const z = this.sample(this.size, start)
    this.span = Math.max(Math.abs(target.pos - p.x), opts.step ?? target.size, 1)
    this.pos = { x0: p.x, v0: p.v, target: target.pos, start }
    this.size = { x0: z.x, v0: z.v, target: target.size, start }
    this.kick()
  }

  /** 지금 가운데 자리 — 물방울이 움직이는 알약을 따라가게(WaterFxEngine follow) */
  posAt(now: number = waterClock()): number {
    return this.sample(this.pos, now).x
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private sample(track: Track, now: number) {
    const t = now - track.start
    if (!Number.isFinite(t) || t > 2) return { x: track.target, v: 0 }
    if (t <= 0) return { x: track.x0, v: track.v0 }
    return springAt(track.x0, track.v0, track.target, t, this.spec)
  }

  private kick() {
    if (this.raf) return
    this.last = waterClock()
    const tick = () => {
      this.raf = 0
      if (this.frame(waterClock())) this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** 한 프레임 — 아직 움직이면 true */
  private frame(now: number): boolean {
    const dt = Math.max(0, Math.min(0.05, now - this.last))
    this.last = now
    const p = this.sample(this.pos, now)
    const z = this.sample(this.size, now)
    const { max, perSpeed, squash, lag } = WATER_STRETCH
    const want = Math.min(max, (perSpeed * Math.abs(p.v)) / this.span)
    this.s += (want - this.s) * (1 - Math.exp(-dt / lag))
    const sAlong = 1 + this.s
    const sAcross = 1 - squash * this.squash * this.s
    this.draw(p.x, z.x, sAlong, sAcross)
    const moving = now - this.pos.start < 0.9 || this.s > 0.001
    if (!moving) {
      this.s = 0
      this.draw(this.pos.target, this.size.target)
    }
    return moving
  }

  private draw(pos: number, size: number, along = 1, across = 1) {
    const st = this.el.style
    const half = size / 2
    if (this.axis === 'x') {
      st.width = `${round3(size)}px`
      st.transform = `translate(${round3(pos - half)}px, 0) scale(${round3(along)}, ${round3(across)})`
    } else {
      st.height = `${round3(size)}px`
      st.transform = `translate(0, ${round3(pos - half)}px) scale(${round3(across)}, ${round3(along)})`
    }
    this.onDraw?.({ pos, size, along, across })
  }
}
