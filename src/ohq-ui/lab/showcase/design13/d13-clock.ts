import { createContext, useContext, useEffect, type RefObject } from 'react'
import { STILL_T } from './d13-timeline'

/** 그리기 — t: 장면 시작부터 초, still: 움직임 줄이기(한 장면만 그린다) */
export type D13Draw = (t: number, still: boolean) => void

interface Sub {
  draw: D13Draw
  visible: boolean
}

const REDUCE = '(prefers-reduced-motion: reduce)'

/** 시계 — document.timeline(= rAF 시각)을 쓴다. 개발 도구에서 애니메이션을 느리게 하면 CSS 애니메이션과 같이 느려진다. */
const timelineMs = () => {
  const t = document.timeline?.currentTime
  return typeof t === 'number' ? t : performance.now()
}

/**
 * D13 부품들이 같이 쓰는 시계. rAF 하나로 화면에 보이는 부품만 그린다(IntersectionObserver) — 화면 밖이거나
 * 탭이 숨으면 쉰다. 그리기는 t만 보고 DOM·캔버스를 직접 고친다(React는 다시 그리지 않는다).
 * 움직임 줄이기면 rAF를 돌리지 않고 STILL_T 한 장면만 그린다. 관찰자·미디어 쿼리는 첫 부품이 붙을 때 만들고
 * 마지막 부품이 떨어질 때 걷는다(StrictMode가 효과를 두 번 돌려도 그대로 산다).
 */
export class D13Clock {
  #origin = timelineMs()
  #subs = new Map<Element, Sub>()
  #raf = 0
  #io: IntersectionObserver | null = null
  #mq: MediaQueryList | null = null
  #reduced = false

  /** 장면 시작부터 초 */
  now() {
    return (timelineMs() - this.#origin) / 1000
  }

  /** 처음부터 다시(숫자 오르기·막대 차오르기도 다시) */
  restart() {
    this.#origin = timelineMs()
    const t = this.#time()
    for (const sub of this.#subs.values()) if (sub.visible || this.#reduced) sub.draw(t, this.#reduced)
  }

  subscribe(el: Element, draw: D13Draw) {
    this.#setup()
    const sub: Sub = { draw, visible: !this.#io }
    this.#subs.set(el, sub)
    this.#io?.observe(el)
    draw(this.#time(), this.#reduced)
    this.#kick()
    return () => {
      this.#subs.delete(el)
      this.#io?.unobserve(el)
      if (this.#subs.size === 0) this.#teardown()
    }
  }

  /** 크기가 바뀌었을 때 그 부품만 다시(움직임 줄이기에서도) */
  redraw(el: Element) {
    this.#subs.get(el)?.draw(this.#time(), this.#reduced)
  }

  #time() {
    return this.#reduced ? STILL_T : this.now()
  }

  #setup() {
    if (!this.#mq && typeof matchMedia === 'function') {
      this.#mq = matchMedia(REDUCE)
      this.#reduced = this.#mq.matches
      this.#mq.addEventListener('change', this.#onMotion)
    }
    if (!this.#io && typeof IntersectionObserver === 'function') {
      this.#io = new IntersectionObserver(this.#onIntersect, { rootMargin: '120px' })
    }
  }

  #teardown() {
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    this.#io?.disconnect()
    this.#io = null
    this.#mq?.removeEventListener('change', this.#onMotion)
    this.#mq = null
  }

  #kick() {
    if (this.#raf || this.#reduced) return
    for (const sub of this.#subs.values()) {
      if (sub.visible) {
        this.#raf = requestAnimationFrame(this.#tick)
        return
      }
    }
  }

  #tick = () => {
    this.#raf = 0
    const t = this.now()
    let any = false
    for (const sub of this.#subs.values()) {
      if (!sub.visible) continue
      any = true
      sub.draw(t, false)
    }
    if (any && !this.#reduced) this.#raf = requestAnimationFrame(this.#tick)
  }

  #onIntersect = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const sub = this.#subs.get(entry.target)
      if (!sub) continue
      const was = sub.visible
      sub.visible = entry.isIntersecting
      if (sub.visible && !was) sub.draw(this.#time(), this.#reduced)
    }
    this.#kick()
  }

  #onMotion = () => {
    this.#reduced = this.#mq?.matches ?? false
    if (this.#reduced) {
      cancelAnimationFrame(this.#raf)
      this.#raf = 0
    }
    const t = this.#time()
    for (const sub of this.#subs.values()) if (sub.visible || this.#reduced) sub.draw(t, this.#reduced)
    this.#kick()
  }
}

let shared: D13Clock | null = null
/** Provider 밖(부품을 따로 쓸 때)의 공용 시계 — 처음 쓸 때 만든다 */
const sharedClock = () => (shared ??= new D13Clock())

/** 장면 하나가 같이 쓰는 시계 — 견본은 자기 시계를 넣어 "다시 재생"으로 처음부터 돌린다 */
export const D13ClockContext = createContext<D13Clock | null>(null)

export function useD13Clock(): D13Clock {
  return useContext(D13ClockContext) ?? sharedClock()
}

/** 요소가 보이는 동안 매 프레임 draw(t, still). draw가 바뀌면 다시 붙는다(바깥에서 useCallback으로 고정). */
export function useD13Frame(ref: RefObject<Element | null>, draw: D13Draw) {
  const clock = useD13Clock()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return clock.subscribe(el, draw)
  }, [clock, ref, draw])
}
