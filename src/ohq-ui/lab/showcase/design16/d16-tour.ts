import { D16_T } from './d16-motion'
import { D16_TOUR_END, D16_TOUR_EVENTS, D16_TOUR_HOLD, D16_TOUR_PATH, type TourEventType } from './design16-data'

/** 창 폭(영상 px) — 둘러보기 좌표가 이 기준이다 */
const APP_W = 650
/** 둘러보기가 보내는 포인터 번호 — 진짜 마우스(1)와 섞이지 않게 */
export const TOUR_POINTER_ID = 9016

const frameTime = (f: number) => D16_T.videoZero + f / 30

/** 시각 t(초)의 커서 자리 — 경로 표본 사이를 곧게 잇는다 */
function cursorAt(t: number): [number, number] {
  const f = (t - D16_T.videoZero) * 30
  const path = D16_TOUR_PATH
  if (f <= path[0][0]) return [path[0][1], path[0][2]]
  for (let i = 1; i < path.length; i++) {
    const [f1, x1, y1] = path[i]
    if (f <= f1) {
      const [f0, x0, y0] = path[i - 1]
      const u = (f - f0) / (f1 - f0)
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]
    }
  }
  const last = path[path.length - 1]
  return [last[1], last[2]]
}

interface TourDom {
  app: HTMLElement
  cursor: HTMLElement
}

/**
 * 둘러보기 엔진 — 영상의 커서 길을 따라 가짜 커서를 움직이고, 정해진 프레임에 진짜 앱에 포인터 사건을 보낸다
 * (누르기 = pointerdown·pointerup·click, 끌기 = pointerdown → 매 프레임 pointermove → pointerup). 그래서 앱이
 * 사람이 누른 것과 똑같이 움직인다(기간 바꾸기·페이지 넘김·탭·끌어 놓기 코드 그대로).
 * 자기 시계를 쓴다 — 창이 화면 밖이거나 탭이 숨으면 시계가 멈춘다. 올린 요소에는 is-hover를 붙여 :hover처럼 보이게 한다.
 */
export class D16Tour {
  #dom: TourDom
  #onEnd: () => void
  #raf = 0
  #elapsed = 0
  #last = -1
  #next = 0
  #visible = true
  #running = false
  #dragging = false
  #hover: Element | null = null
  #io: IntersectionObserver | null = null

  constructor(dom: TourDom, onEnd: () => void) {
    this.#dom = dom
    this.#onEnd = onEnd
  }

  start() {
    this.#running = true
    this.#elapsed = 0
    this.#next = 0
    this.#last = -1
    this.#dom.cursor.classList.add('is-on')
    this.#io = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting
      this.#kick()
    })
    this.#io.observe(this.#dom.app)
    document.addEventListener('visibilitychange', this.#kick)
    this.#place(cursorAt(0))
    this.#kick()
  }

  stop() {
    this.#running = false
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    this.#io?.disconnect()
    this.#io = null
    document.removeEventListener('visibilitychange', this.#kick)
    if (this.#dragging) {
      this.#dragging = false
      const [x, y] = this.#client(cursorAt(this.#elapsed))
      this.#fire('pointercancel', x, y)
    }
    this.#setHover(null)
    this.#dom.cursor.classList.remove('is-on')
  }

  #kick = () => {
    const go = this.#running && this.#visible && document.visibilityState === 'visible'
    if (go && !this.#raf) {
      this.#last = -1
      this.#raf = requestAnimationFrame(this.#tick)
    } else if (!go && this.#raf) {
      cancelAnimationFrame(this.#raf)
      this.#raf = 0
    }
  }

  #tick = (now: number) => {
    this.#raf = 0
    if (!this.#running) return
    // 실제 시간으로 — 앱의 WAAPI 움직임과 같은 시계(멈췄다 다시 돌 때는 #last = -1이라 빈 시간은 세지 않는다)
    if (this.#last >= 0) this.#elapsed += (now - this.#last) / 1000
    this.#last = now
    const t = this.#elapsed
    const pos = cursorAt(t)
    this.#place(pos)
    const [cx, cy] = this.#client(pos)
    while (this.#next < D16_TOUR_EVENTS.length && frameTime(D16_TOUR_EVENTS[this.#next].f) <= t) {
      this.#event(D16_TOUR_EVENTS[this.#next].type, cx, cy)
      this.#next++
    }
    if (this.#dragging) this.#fire('pointermove', cx, cy)
    this.#setHover(this.#dragging ? null : (document.elementFromPoint(cx, cy)?.closest('.d16-hov') ?? null))
    if (t >= frameTime(D16_TOUR_END) + D16_TOUR_HOLD) {
      this.stop()
      this.#onEnd()
      return
    }
    this.#raf = requestAnimationFrame(this.#tick)
  }

  /** 창 기준 영상 px → 화면 좌표 */
  #client([x, y]: [number, number]): [number, number] {
    const r = this.#dom.app.getBoundingClientRect()
    const k = r.width / APP_W
    return [r.left + x * k, r.top + y * k]
  }

  #place([x, y]: [number, number]) {
    this.#dom.cursor.style.translate = `calc(${x.toFixed(2)} * var(--d16-px)) calc(${y.toFixed(2)} * var(--d16-px))`
  }

  #ring() {
    const ring = this.#dom.cursor
    ring.classList.remove('is-press')
    // 고리 애니메이션을 처음부터 — 클래스를 뗐다 붙이기 전에 한 번 스타일을 읽는다
    void ring.offsetWidth
    ring.classList.add('is-press')
  }

  #event(type: TourEventType, x: number, y: number) {
    if (type === 'click') {
      this.#ring()
      this.#fire('pointerdown', x, y)
      this.#fire('pointerup', x, y)
      const target = document.elementFromPoint(x, y)
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }))
    } else if (type === 'down') {
      this.#ring()
      this.#fire('pointerdown', x, y)
      this.#dragging = true
    } else {
      this.#dragging = false
      this.#fire('pointerup', x, y)
    }
  }

  #fire(type: string, x: number, y: number) {
    const target = document.elementFromPoint(x, y) ?? this.#dom.app
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: TOUR_POINTER_ID,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        buttons: this.#dragging || type === 'pointerdown' ? 1 : 0,
      }),
    )
  }

  #setHover(el: Element | null) {
    // React가 className을 다시 쓰면(고른 칸이 바뀔 때) 클래스가 빠진다 — 같은 요소라도 다시 붙인다
    if (el === this.#hover) {
      el?.classList.add('is-hover')
      return
    }
    this.#hover?.classList.remove('is-hover')
    el?.classList.add('is-hover')
    this.#hover = el
  }
}
