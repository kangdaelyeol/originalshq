import { WATER_SPRING, WATER_STRETCH, springAt, type SpringSpec } from './motion'

/** 미끄러지는 요소 하나 — 지금 붙어 있는 요소와, 가운데 자리(px)·늘어남(진행 방향 along ≥ 1, 옆 across ≤ 1) → 키프레임 */
export interface GlidePart {
  el: () => Element | null
  frame: (pos: number, along: number, across: number) => Keyframe
}

/** 키프레임 간격(s) — 출발 직후(가속이 가장 클 때)도 직선 보간 오차가 0.3px 안쪽이게(160px 이동 기준) */
const STEP = 1 / 240
/** 늘어남 지연 필터를 적분하는 간격(s) — 프레임보다 촘촘히 */
const SIM = 1 / 480

interface Run {
  x0: number
  v0: number
  target: number
  /** STEP마다 자리·늘어남 */
  xs: number[]
  ss: number[]
  duration: number
  anims: Animation[]
}

/**
 * 따라 미끄러지기(D7 표시 알약) — 가운데 자리 하나를 표시 알약 스프링(ζ0.65·ω30.5, 7% 넘쳤다가 F+7에 제자리)으로
 * 옮기고, 달리는 빠르기만큼 늘어남(최대 28%·옆은 0.64배, 15ms 늦게 따라감 — F109~F111 폭 91·높이 41.5)을 같이
 * 넘긴다. WaterIndicatorEngine과 같은 식(빠르기를 이동 거리로 나눠 거리와 상관없이 같은 모양)인데, rAF로 프레임마다
 * 쓰는 대신 움직임 전체를 미리 적분해 WAAPI 키프레임으로 넘긴다 — 합성 단계가 그려 프레임마다 메인 스레드 일
 * (스타일 다시 계산)이 없다. 움직이는 도중 다시 고르면 그 순간 자리·빠르기·늘어남에서 이어 간다.
 */
export class WaterGlide {
  private parts: GlidePart[]
  private spec: SpringSpec
  private target = 0
  private placed = false
  private run: Run | null = null

  constructor(parts: GlidePart[], spec: SpringSpec = WATER_SPRING.indicator) {
    this.parts = parts
    this.spec = spec
  }

  /** 새 자리로 — instant면 바로 놓는다(처음 나타날 때·창 크기가 바뀔 때). step은 한 칸 거리(늘어남 기준, D7 ICON_STEP) */
  set(pos: number, opts: { instant?: boolean; step?: number } = {}) {
    if (opts.instant || !this.placed) {
      this.cancel()
      this.target = pos
      this.placed = true
      this.write(pos)
      return
    }
    const cur = this.state()
    this.cancel()
    this.target = pos
    const span = Math.max(Math.abs(pos - cur.x), opts.step ?? 1, 1)
    const { max, perSpeed, squash, lag } = WATER_STRETCH
    // 자리는 스프링 식 그대로, 늘어남은 WaterIndicatorEngine.frame과 같은 1차 지연을 촘촘히 적분한다
    const xs: number[] = []
    const ss: number[] = []
    const every = Math.round(STEP / SIM)
    let s = cur.s
    for (let i = 0; ; i++) {
      const t = i * SIM
      const p = springAt(cur.x, cur.v, pos, t, this.spec)
      if (i % every === 0) {
        xs.push(p.x)
        ss.push(s)
        // 0.3s 뒤로 자리가 0.02px·늘어남이 0.05% 안에 들면 끝(엔진의 0.9s·0.001 기준보다 일찍 멈춰도 같은 모양)
        if (t > 1.2 || (t > 0.3 && Math.abs(p.x - pos) < 0.02 && Math.abs(p.v) < 0.5 && s < 0.0005)) break
      }
      const want = Math.min(max, (perSpeed * Math.abs(p.v)) / span)
      s += (want - s) * (1 - Math.exp(-SIM / lag))
    }
    xs.push(pos)
    ss.push(0)
    const duration = (xs.length - 1) * STEP
    this.write(pos)
    const anims: Animation[] = []
    for (const part of this.parts) {
      const el = part.el()
      if (!el) continue
      const frames = xs.map((x, j) => ({
        ...part.frame(x, 1 + ss[j], 1 - squash * ss[j]),
        offset: j / (xs.length - 1),
      }))
      anims.push(el.animate(frames, { duration: duration * 1000, easing: 'linear', fill: 'backwards' }))
    }
    this.run = { x0: cur.x, v0: cur.v, target: pos, xs, ss, duration, anims }
  }

  /** 숨길 때 — 다음 set은 바로 놓인다 */
  reset() {
    this.cancel()
    this.placed = false
  }

  destroy() {
    this.cancel()
  }

  /** 지금 자리·빠르기·늘어남 — 애니메이션 시각(currentTime)으로 계산한다(레이아웃을 읽지 않는다) */
  private state() {
    const r = this.run
    const ct = r?.anims[0]?.currentTime
    const t = typeof ct === 'number' ? ct / 1000 : Infinity
    if (!r || t >= r.duration) return { x: this.target, v: 0, s: 0 }
    const p = springAt(r.x0, r.v0, r.target, Math.max(0, t), this.spec)
    return { x: p.x, v: p.v, s: r.ss[Math.min(r.ss.length - 1, Math.round(Math.max(0, t) / STEP))] }
  }

  private cancel() {
    this.run?.anims.forEach((a) => a.cancel())
    this.run = null
  }

  /** 멈춘 모양을 style에 — 애니메이션이 끝나면 이 값이 남는다 */
  private write(pos: number) {
    for (const part of this.parts) {
      const el = part.el()
      if (el instanceof HTMLElement || el instanceof SVGElement) Object.assign(el.style, part.frame(pos, 1, 1))
    }
  }
}
