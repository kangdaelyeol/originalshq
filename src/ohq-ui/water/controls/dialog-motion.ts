import {
  WATER_REVEAL,
  WATER_SETTLE,
  WATER_SPRING,
  animate,
  clamp01,
  mix,
  round3,
  smooth,
  spring,
  waterClock,
} from '../motion'

// 물 대화상자의 움직임 — D7 펼침·접힘(lab/showcase/design7/liquid-menu-data.ts openPose·closePose)을 판 하나에
// 옮겼다. 펼침: 물방울이 가로로 뻗어(extend ζ0.5·ω34, 16% 넘침) 0.165s 뒤 세로로 떨어져 나가듯 펼쳐지고
// (detach ζ0.45·ω36), 0.247s부터 내용이 21ms 간격으로 55ms 동안 나타난다. 접힘: 내용이 곧바로(15ms 뒤 30ms)
// 사라지고, 세로가 먼저 모이고(gather ζ0.6·ω47, 0.188s) 가로가 넘치지 않고 끌려와(trail ζ1·ω24) 흐려진다.

/** 판 크기(px)·모서리 반지름 */
export interface DialogBox {
  w: number
  h: number
  r: number
}

/** 한 순간의 모양 — 가운데 기준 반폭·반높이(px), 유리 판·바탕 막 불투명도, 내용 차례별 불투명도 */
export interface DialogPose {
  hx: number
  hy: number
  glass: number
  scrim: number
  items: number[]
}

/** 판 모서리 반지름 — _controls.scss .water-dialog__glass와 같다 */
export const DIALOG_RADIUS = 26

/** 처음·끝 물방울 반지름 — 판이 이 크기의 둥근 물방울에서 펼쳐지고 여기로 모인다 */
const dropRadius = (b: DialogBox) => Math.min(26, b.w / 2, b.h / 2)

/** 펼침 시각(D7 openPose) — 알약 왼끝이 떨어지는 때(세로로 펼침 시작), 첫 아이콘이 나타나는 때(F82) */
const OPEN = { detach: 0.165, item: 0.247 }
/** 접힘 시각(D7 closePose) — 1단계(다시 붙음) 길이, 그 뒤 판이 흐려지는 구간(pillOn smooth 0.17~0.30) */
const CLOSE = { gather: 0.188, fadeFrom: 0.17, fadeLen: 0.13 }
const CLOSE_END = CLOSE.gather + CLOSE.fadeFrom + CLOSE.fadeLen
/** 움직이는 도중 바뀌면 지금 모양에서 새 움직임으로 0.15초 동안 넘어간다(D7 mixPose) */
const MIX = 0.15

const fill = (n: number, v: number) => Array.from({ length: n }, () => v)

export function dialogOpenPose(t: number, b: DialogBox, n: number, reduced: boolean): DialogPose {
  if (reduced) {
    // 동작 줄이기 — 제 크기로 0.1초 동안 흐리게 나타난다
    const k = clamp01(t / WATER_REVEAL.indicator)
    return { hx: b.w / 2, hy: b.h / 2, glass: k, scrim: k, items: fill(n, k) }
  }
  const r0 = dropRadius(b)
  const shade = clamp01(t / WATER_REVEAL.indicator)
  return {
    hx: r0 + (b.w / 2 - r0) * spring(t, WATER_SPRING.extend),
    hy: r0 + (b.h / 2 - r0) * spring(t - OPEN.detach, WATER_SPRING.detach),
    // 물방울은 30ms 만에 맺히고, 바탕 막은 0.1초 동안 진해진다(표시 알약 F82 → F85와 같은 1-(1-u)²)
    glass: clamp01(t / WATER_REVEAL.out),
    scrim: 1 - (1 - shade) * (1 - shade),
    items: Array.from({ length: n }, (_, i) => clamp01((t - OPEN.item - i * WATER_REVEAL.stagger) / WATER_REVEAL.fade)),
  }
}

export function dialogClosePose(t: number, b: DialogBox, n: number, reduced: boolean): DialogPose {
  if (reduced) {
    const k = 1 - clamp01(t / WATER_REVEAL.indicator)
    return { hx: b.w / 2, hy: b.h / 2, glass: k, scrim: k, items: fill(n, k) }
  }
  const r0 = dropRadius(b)
  const tb = t - CLOSE.gather
  return {
    hx: b.w / 2 + (r0 - b.w / 2) * spring(tb, WATER_SPRING.trail),
    hy: b.h / 2 + (r0 - b.h / 2) * spring(t, WATER_SPRING.gather),
    glass: 1 - smooth((tb - CLOSE.fadeFrom) / CLOSE.fadeLen),
    scrim: 1 - smooth(t / CLOSE_END),
    // 내용은 곧바로(F23: 15ms 뒤 30ms)
    items: fill(n, 1 - clamp01((t - 0.015) / WATER_REVEAL.out)),
  }
}

function mixPose(a: DialogPose, b: DialogPose, k: number): DialogPose {
  return {
    hx: mix(a.hx, b.hx, k),
    hy: mix(a.hy, b.hy, k),
    glass: mix(a.glass, b.glass, k),
    scrim: mix(a.scrim, b.scrim, k),
    items: b.items.map((v, i) => mix(a.items[i] ?? v, v, k)),
  }
}

/** 엔진이 직접 고치는 요소 — 매 프레임 React를 다시 그리지 않으려고 */
export interface DialogDom {
  /** 판 뒤 유리(absolute, 판 크기) — 움직이는 동안만 폭·높이·자리·모서리를 쓴다 */
  glass: HTMLElement
  scrim: HTMLElement
  /** 차례로 나타나는 내용 */
  items: HTMLElement[]
}

/**
 * 대화상자 유리 판을 펼치고 접는다 — rAF로 style을 바로 고치고, 다 펼쳐지면 유리의 inline 크기를 지워 CSS
 * (판 크기 그대로)에 맡긴 뒤 rAF를 멈춘다. 다 접히면 onClosed를 부른다.
 */
export class WaterDialogEngine {
  private dom: DialogDom
  private box: DialogBox
  private open = false
  private reduced = false
  private start = -Infinity
  private from: DialogPose | null = null
  private pose: DialogPose | null = null
  private busy = false
  private stop: (() => void) | null = null
  private onClosed: (() => void) | undefined

  constructor(dom: DialogDom, box: DialogBox) {
    this.dom = dom
    this.box = box
  }

  /** 열기·닫기 — at은 누른 시각(waterClock). 처음 모양은 바로 그린다(첫 그리기 전에) */
  set(open: boolean, opts: { at?: number; reduced?: boolean; onClosed?: () => void } = {}) {
    if (open === this.open && this.start > -Infinity) return
    const now = waterClock()
    this.from = this.busy && this.pose ? this.pose : null
    this.open = open
    this.reduced = opts.reduced ?? false
    this.onClosed = opts.onClosed
    this.start = opts.at === undefined ? now : Math.min(now, Math.max(opts.at, now - 0.12))
    this.busy = true
    this.draw(now - this.start)
    this.stop?.()
    this.stop = animate((t) => this.draw(t), this.start)
  }

  /** 판 크기가 바뀌면(내용이 바뀜) — 움직이는 중이면 다음 프레임부터 새 크기로 */
  resize(box: DialogBox) {
    this.box = box
  }

  destroy() {
    this.stop?.()
    this.stop = null
  }

  /** 한 프레임 — 아직 움직이면 true */
  private draw(t: number): boolean {
    const n = this.dom.items.length
    const target = this.open
      ? dialogOpenPose(t, this.box, n, this.reduced)
      : dialogClosePose(t, this.box, n, this.reduced)
    const p = this.from && t < MIX ? mixPose(this.from, target, smooth(t / MIX)) : target
    this.pose = p
    const end = this.reduced ? WATER_REVEAL.indicator : this.open ? WATER_SETTLE.open : CLOSE_END
    const done = t >= end
    this.apply(p, done && this.open)
    if (!done) return true
    this.busy = false
    this.from = null
    if (!this.open) this.onClosed?.()
    return false
  }

  private apply(p: DialogPose, rest: boolean) {
    const { glass, scrim, items } = this.dom
    const st = glass.style
    if (rest) {
      // 다 펼쳐짐 — CSS(판 크기 그대로)에 맡긴다
      st.width = st.height = st.transform = st.borderRadius = st.opacity = ''
    } else {
      const hx = Math.max(0.5, p.hx)
      const hy = Math.max(0.5, p.hy)
      st.width = `${round3(hx * 2)}px`
      st.height = `${round3(hy * 2)}px`
      st.transform = `translate(${round3(this.box.w / 2 - hx)}px, ${round3(this.box.h / 2 - hy)}px)`
      st.borderRadius = `${round3(Math.min(this.box.r, hx, hy))}px`
      st.opacity = String(round3(clamp01(p.glass)))
    }
    scrim.style.opacity = String(round3(clamp01(p.scrim)))
    items.forEach((el, i) => {
      el.style.opacity = String(round3(clamp01(p.items[i] ?? 1)))
    })
  }
}
