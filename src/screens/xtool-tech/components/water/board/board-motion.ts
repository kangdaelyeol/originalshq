import { springAt, type SpringSpec } from '@/ohq-ui/water/motion'

// tech 물 부품만 쓰는 움직임 도구. 시각·물결·초점·차례 나타나기는 기반(ohq-ui/water — motion·ripple·focus·
// reveal·hooks)으로 옮겼다(2회차).

/**
 * 스프링으로 움직이는 값 하나 — 도중에 목표가 바뀌어도 그 순간의 위치·빠르기에서 이어 간다(D7 표시 알약과
 * 같은 방식, springAt). 시각은 waterClock 초. 서랍(들어옴·나감)과 토스트 자리 옮김(FLIP)이 쓴다.
 */
export class SpringTrack {
  private x0: number
  private v0 = 0
  private start = -Infinity
  target: number
  spec: SpringSpec

  constructor(value: number, spec: SpringSpec) {
    this.x0 = value
    this.target = value
    this.spec = spec
  }

  /** now 시각의 위치·빠르기 */
  at(now: number): { x: number; v: number } {
    const t = now - this.start
    if (!Number.isFinite(t) || t > 3) return { x: this.target, v: 0 }
    if (t <= 0) return { x: this.x0, v: this.v0 }
    return springAt(this.x0, this.v0, this.target, t, this.spec)
  }

  /** 지금(start) 위치·빠르기에서 새 목표로 */
  to(target: number, start: number, spec: SpringSpec = this.spec) {
    const cur = this.at(start)
    this.x0 = cur.x
    this.v0 = cur.v
    this.target = target
    this.start = start
    this.spec = spec
  }

  /** 바로 놓는다 */
  jump(value: number) {
    this.x0 = value
    this.v0 = 0
    this.target = value
    this.start = -Infinity
  }

  /** 목표에 0.1px·빠르기 2px/s 안으로 들어왔는지 */
  settled(now: number): boolean {
    const { x, v } = this.at(now)
    return Math.abs(x - this.target) < 0.1 && Math.abs(v) < 2
  }
}
