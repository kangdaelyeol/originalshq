import { D16_T, EASE, prefersReducedMotion } from './d16-motion'

export type StretchAxis = 'x' | 'y'

/**
 * 늘어나는 고른 표시(사이드바 파란 알약·기간 고르기 밝은 알약) — 앞 모서리가 먼저 가고 뒤 모서리가 따라온다.
 * 사이드바 Dashboard → Orders(F72.8~F85): 아래 모서리 85→102가 6프레임(easeOutQuad), 위 모서리 71→88은
 * 0.1초 늦게 10프레임(easeInOutQuad). 기간 12M → 30D(F31.2~F45)도 같은 값이다.
 * 요소 하나의 top·bottom(가로면 left·right)을 따로 WAAPI로 움직인다 — React는 다시 그리지 않는다.
 */
export class StretchIndicator {
  #el: HTMLElement
  #axis: StretchAxis
  #anims: Animation[] = []
  #a = 0
  #b = 0

  constructor(el: HTMLElement, axis: StretchAxis) {
    this.#el = el
    this.#axis = axis
  }

  get #sides() {
    return this.#axis === 'y' ? (['top', 'bottom'] as const) : (['left', 'right'] as const)
  }

  #size() {
    const parent = this.#el.offsetParent as HTMLElement | null
    if (!parent) return 0
    return this.#axis === 'y' ? parent.clientHeight : parent.clientWidth
  }

  #cancel() {
    for (const a of this.#anims) a.cancel()
    this.#anims = []
  }

  /** 지금 보이는 자리(움직이는 도중이면 그 순간 값) */
  #current() {
    const cs = getComputedStyle(this.#el)
    const [s0, s1] = this.#sides
    const size = this.#size()
    return { a: parseFloat(cs[s0]) || 0, b: size - (parseFloat(cs[s1]) || 0) }
  }

  #write(a: number, b: number) {
    const [s0, s1] = this.#sides
    this.#a = a
    this.#b = b
    this.#el.style[s0] = `${a}px`
    this.#el.style[s1] = `${this.#size() - b}px`
  }

  /** 움직임 없이 놓기(처음·크기가 바뀌었을 때) */
  place(a: number, b: number) {
    this.#cancel()
    this.#write(a, b)
    this.#el.style.opacity = '1'
  }

  /** 늘어나며 옮기기 */
  moveTo(a: number, b: number) {
    if (a === this.#a && b === this.#b) return
    const from = this.#current()
    this.#cancel()
    const size = this.#size()
    this.#write(a, b)
    if (prefersReducedMotion()) return
    const [s0, s1] = this.#sides
    const forward = b > from.b
    const lead = forward ? s1 : s0
    const tail = forward ? s0 : s1
    const leadFrom = forward ? size - from.b : from.a
    const leadTo = forward ? size - b : a
    const tailFrom = forward ? from.a : size - from.b
    const tailTo = forward ? a : size - b
    this.#anims.push(
      this.#el.animate([{ [lead]: `${leadFrom}px` }, { [lead]: `${leadTo}px` }], {
        duration: D16_T.stretchLead * 1000,
        easing: EASE.quadOut,
        fill: 'backwards',
      }),
      this.#el.animate([{ [tail]: `${tailFrom}px` }, { [tail]: `${tailTo}px` }], {
        duration: D16_T.stretchTail * 1000,
        delay: D16_T.stretchTailDelay * 1000,
        easing: EASE.quadInOut,
        fill: 'backwards',
      }),
    )
  }

  /** 처음 들어올 때 — 다른 자리에서 통째로 back.out(2)로 날아와 넘쳤다 돌아온다(F−1.3 ~ F14.5) */
  enterFrom(fromA: number, fromB: number, a: number, b: number, delay: number) {
    this.#cancel()
    const size = this.#size()
    this.#write(a, b)
    this.#el.style.opacity = '1'
    if (prefersReducedMotion()) return
    const [s0, s1] = this.#sides
    const timing = {
      duration: D16_T.navIndicatorIn * 1000,
      delay: delay * 1000,
      easing: EASE.backOut2,
      fill: 'backwards' as const,
    }
    this.#anims.push(
      this.#el.animate([{ [s0]: `${fromA}px` }, { [s0]: `${a}px` }], timing),
      this.#el.animate([{ [s1]: `${size - fromB}px` }, { [s1]: `${size - b}px` }], timing),
      // 처음 두 프레임은 흐릿하다(F0 · F1) — 0.12초에 나타난다
      this.#el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: delay * 1000, fill: 'backwards' }),
    )
  }

  destroy() {
    this.#cancel()
  }
}

/**
 * 표시가 든 상자(container) 안에서 요소의 시작·끝(px) — 표시를 둘 자리.
 * 줄들이 자기 position을 가져도(쌓임 순서) 맞도록 offsetTop 대신 화면 상자로 잰다(들어오는 x 이동은 위·아래에 영향 없음).
 */
export function spanOf(el: HTMLElement, container: HTMLElement, axis: StretchAxis): [number, number] {
  const r = el.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return axis === 'y'
    ? [r.top - c.top - container.clientTop, r.bottom - c.top - container.clientTop]
    : [r.left - c.left - container.clientLeft, r.right - c.left - container.clientLeft]
}
