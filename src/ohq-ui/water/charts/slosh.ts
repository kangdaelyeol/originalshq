import { WATER_REVEAL, WATER_SPRING, springAt, springSettle, waterClock } from '../motion'

/** 계열마다 점 높이(px) */
export type SloshLevels = readonly (readonly number[])[]

/**
 * 물 높이 바뀜 — 차트 값이 바뀌면 점마다 지난 높이에서 새 높이로 D7 extend 스프링(ζ0.5·ω34, 16% 넘쳤다
 * 돌아옴)으로 옮긴다. 쉬다가 바뀌면 왼쪽 점부터 WATER_REVEAL.stagger(21ms) 간격으로 출발해 물결이 오른쪽으로
 * 번지고(D7 아이콘이 왼쪽부터 차례로 — 점이 많으면 물결이 0.25초 안에 건너가게 간격을 줄인다), 움직이는 도중 다시
 * 바뀌면 그 순간 높이·빠르기에서 한꺼번에 이어 간다.
 * 선 모양(path d)이 바뀌어 그 SVG는 프레임마다 다시 칠한다 — 값이 바뀔 때 0.5초 남짓만, 그동안 그리는 쪽이 SVG를
 * 제 층에 올려(onBusy) 유리 판까지 다시 칠하지 않게 한다. 멈추면 rAF도 멈춘다.
 */
export class WaterSlosh {
  private draw: (levels: SloshLevels) => void
  private onBusy: (busy: boolean) => void
  private from: number[][] = []
  private vel: number[][] = []
  private to: number[][] = []
  private start = -Infinity
  private stagger = 0
  private raf = 0

  /** onBusy — 출렁이기 시작·끝(그리는 쪽이 그동안만 제 층에 올려 둔다) */
  constructor(draw: (levels: SloshLevels) => void, onBusy: (busy: boolean) => void = () => {}) {
    this.draw = draw
    this.onBusy = onBusy
  }

  /** shown(지금 보이는 높이)에서 to로 — 움직이는 중이면 shown 대신 그 순간 값에서 이어 간다 */
  run(shown: SloshLevels, to: SloshLevels) {
    const now = waterClock()
    if (this.raf) {
      const cur = this.sampleAll(now)
      this.from = cur.ys
      this.vel = cur.vs
      this.stagger = 0
    } else {
      this.from = shown.map((row) => [...row])
      this.vel = shown.map((row) => row.map(() => 0))
      // 점 사이 21ms(D7 아이콘 차례) — 점이 많으면(30일) 물결이 0.25초 안에 건너가게 줄인다
      const n = Math.max(0, ...to.map((row) => row.length))
      this.stagger = Math.min(WATER_REVEAL.stagger, 0.25 / Math.max(1, n - 1))
    }
    this.to = to.map((row) => [...row])
    this.start = now
    if (!this.raf) this.onBusy(true)
    // 첫 화면부터 지난 높이로(React가 그린 새 모양이 한 프레임 비치지 않게)
    this.draw(this.sampleAll(now).ys)
    if (!this.raf) {
      const tick = () => {
        this.raf = 0
        if (this.frame(waterClock())) this.raf = requestAnimationFrame(tick)
        else this.onBusy(false)
      }
      this.raf = requestAnimationFrame(tick)
    }
  }

  stop() {
    if (!this.raf) return
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.onBusy(false)
  }

  private sampleAll(now: number) {
    const spec = WATER_SPRING.extend
    const settle = springSettle(spec)
    const ys: number[][] = []
    const vs: number[][] = []
    this.to.forEach((row, k) => {
      const yr: number[] = []
      const vr: number[] = []
      row.forEach((target, i) => {
        const y0 = this.from[k]?.[i] ?? target
        const v0 = this.vel[k]?.[i] ?? 0
        const t = now - this.start - i * this.stagger
        if (t <= 0) {
          yr.push(y0)
          vr.push(v0)
        } else if (t >= settle) {
          yr.push(target)
          vr.push(0)
        } else {
          const p = springAt(y0, v0, target, t, spec)
          yr.push(p.x)
          vr.push(p.v)
        }
      })
      ys.push(yr)
      vs.push(vr)
    })
    return { ys, vs }
  }

  /** 한 프레임 — 아직 움직이면 true */
  private frame(now: number): boolean {
    const n = Math.max(0, ...this.to.map((row) => row.length))
    const end = springSettle(WATER_SPRING.extend) + this.stagger * Math.max(0, n - 1)
    if (now - this.start >= end) {
      this.draw(this.to)
      return false
    }
    this.draw(this.sampleAll(now).ys)
    return true
  }
}
