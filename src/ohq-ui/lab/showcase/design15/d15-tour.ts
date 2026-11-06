import {
  CAMERA_IN_MS,
  CAMERA_OUT_MS,
  CAPTION_IN_MS,
  CAPTION_OUT_MS,
  EASE_IN_CUBIC,
  EASE_IN_OUT_CUBIC,
  EASE_OUT_CUBIC,
  EASE_STANDARD,
  easeInOutCubic,
  prefersReducedMotion,
  TYPE_MS,
} from './d15-motion'
import { D15_CAPTIONS } from './design15-data'

// 둘러보기 — 영상(30초)의 차례를 그대로 다시 한다. 시각(초)은 영상 시각, 주석의 F는 그 프레임.
// 화살표·누름 물결·카메라 확대·자막은 화면 녹화/편집에서 온 것(앱 UI가 아니다)이라 이 엔진만 그린다.
// 누름·끌기·올리기는 화살표 끝 자리의 요소에 진짜 포인터 이벤트를 보내서 앱이 사람이 한 것처럼 움직인다.

type Target = string | { sel: string; fx: number; fy: number }

interface Zoom {
  sel: string
  scale: number
}

/** 카메라 확대(영상 편집) — 시간 기록 5.44배(F137), 처리량 2.23배, 모양 1.9배 */
const ZOOMS = {
  tracker: { sel: '.d15-tracker', scale: 5.44 },
  throughput: { sel: '[data-tour="throughput"]', scale: 2.23 },
  appearance: { sel: '[data-tour="appearance"]', scale: 1.9 },
} satisfies Record<string, Zoom>

/** 처리량 그림판의 날 → 가로 비율(90일, Jul 12 = 0) */
const day = (i: number, fy = 0.42): Target => ({ sel: '[data-tour="throughput"] .d15-tp__hit', fx: i / 89, fy })

/** 영상 시작 화살표 자리(F30 x374 y212) — 무대(72em × 39em) 좌표 em */
const CURSOR_HOME = { x: 37.4, y: 21.2 }
/** 끝난 뒤 다시 시작까지(영상 30초 + 쉼) */
const LOOP_S = 32.5
/** 영상은 첫 장면이 떠오르기 시작하고 0.3초 뒤부터 찍혔다(Total 카드 시작 F-8.25) — 앱을 붙이는 때를 영상 -0.27초(F-8)로 */
const MOUNT_AT = -0.27

class Aborted extends Error {}

interface TourOptions {
  /** 72em × 39em 무대(크기 기준·보임 관찰) */
  frame: HTMLElement
  /** 카메라 층(창·화살표가 들어 있다) */
  camera: HTMLElement
  cursor: HTMLElement
  caption: HTMLElement
  /** 앱을 처음 상태로(다시 붙인다) */
  reset: () => void
}

export class D15Tour {
  #o: TourOptions
  #t = 0
  #raf = 0
  #last = -1
  #visible = true
  #running = false
  #run = 0
  #waiters: { t: number; resolve: () => void; reject: (e: Error) => void }[] = []
  #io: IntersectionObserver
  #cursor = { ...CURSOR_HOME }
  #hoverEl: Element | null = null
  #hoverBtn: Element | null = null
  #zoomed = false
  #target: Target | null = null

  constructor(options: TourOptions) {
    this.#o = options
    this.#io = new IntersectionObserver(
      ([e]) => {
        this.#visible = e.isIntersecting
      },
      { threshold: 0.25 },
    )
    this.#io.observe(options.frame)
  }

  get running() {
    return this.#running
  }

  start() {
    this.stop(false)
    this.#running = true
    const id = ++this.#run
    this.#t = MOUNT_AT
    this.#last = -1
    this.#raf = requestAnimationFrame(this.#tick)
    this.#loop(id).catch((e) => {
      if (!(e instanceof Aborted)) throw e
    })
  }

  /** 멈추기 — 확대·자막·화살표를 걷는다(animate면 확대를 부드럽게 푼다) */
  stop(animate = true) {
    this.#running = false
    this.#run++
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    const waiters = this.#waiters
    this.#waiters = []
    waiters.forEach((w) => w.reject(new Aborted()))
    this.#setHover(null)
    if (this.#zoomed) this.#zoom(null, animate)
    this.#caption(null, animate)
    this.#o.cursor.style.opacity = '0'
  }

  dispose() {
    this.stop(false)
    this.#io.disconnect()
  }

  // ── 시계(보일 때만 흐른다) ────────────────────────────────────────────────
  // 프레임이 늦게 와도(무거운 화면) 벽시계를 따라간다 — 숨었다 돌아온 첫 프레임만 건너뛴다(#last = -1)
  #tick = (now: number) => {
    const live = this.#visible && !document.hidden
    if (this.#last >= 0 && live) this.#t += Math.min(0.5, (now - this.#last) / 1000)
    this.#last = live ? now : -1
    const due = this.#waiters.filter((w) => w.t <= this.#t)
    if (due.length) {
      this.#waiters = this.#waiters.filter((w) => w.t > this.#t)
      due.forEach((w) => w.resolve())
    }
    if (this.#running) this.#raf = requestAnimationFrame(this.#tick)
  }

  #at(t: number, id: number) {
    if (id !== this.#run) return Promise.reject(new Aborted())
    if (this.#t >= t) return Promise.resolve()
    return new Promise<void>((resolve, reject) => this.#waiters.push({ t, resolve, reject }))
  }

  // ── 좌표 ──────────────────────────────────────────────────────────────────
  /** 카메라 층 안 em 좌표 ↔ 화면 좌표 */
  #space() {
    const cam = this.#o.camera
    const r = cam.getBoundingClientRect()
    const scale = r.width / cam.offsetWidth || 1
    const em = parseFloat(getComputedStyle(cam).fontSize) || 10
    return { r, scale, em }
  }

  #toClient(p: { x: number; y: number }) {
    const { r, scale, em } = this.#space()
    return { x: r.left + p.x * em * scale, y: r.top + p.y * em * scale }
  }

  #point(target: Target) {
    const sel = typeof target === 'string' ? target : target.sel
    const el = this.#o.camera.querySelector<HTMLElement>(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    const fx = typeof target === 'string' ? 0.5 : target.fx
    const fy = typeof target === 'string' ? 0.5 : target.fy
    const { r, scale, em } = this.#space()
    return { x: (b.left + b.width * fx - r.left) / scale / em, y: (b.top + b.height * fy - r.top) / scale / em }
  }

  #place() {
    this.#o.cursor.style.transform = `translate(${this.#cursor.x}em, ${this.#cursor.y}em)`
  }

  // ── 포인터 이벤트 ─────────────────────────────────────────────────────────
  #fire(type: string, el: Element, c: { x: number; y: number }, extra: PointerEventInit = {}) {
    const init: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: c.x,
      clientY: c.y,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      view: window,
      ...extra,
    }
    el.dispatchEvent(type === 'click' ? new MouseEvent(type, init) : new PointerEvent(type, init))
  }

  #underCursor() {
    const c = this.#toClient(this.#cursor)
    return { el: document.elementFromPoint(c.x, c.y), c }
  }

  #setHover(el: Element | null) {
    const btn = el?.closest('button, [role="tab"], .d15-task, .d15-bars__col') ?? null
    if (btn !== this.#hoverBtn) {
      this.#hoverBtn?.classList.remove('is-hover')
      btn?.classList.add('is-hover')
      this.#hoverBtn = btn
    }
  }

  /** 화살표가 움직일 때마다 — 그 아래 요소에 pointermove(·over/out)를 보낸다(말풍선·끄는 카드가 따라온다) */
  #moved(buttons: number) {
    const { el, c } = this.#underCursor()
    if (!el) return
    if (el !== this.#hoverEl) {
      if (this.#hoverEl) this.#fire('pointerout', this.#hoverEl, c, { relatedTarget: el, buttons })
      this.#fire('pointerover', el, c, { relatedTarget: this.#hoverEl, buttons })
      this.#hoverEl = el
    }
    this.#fire('pointermove', el, c, { buttons })
    if (!buttons) this.#setHover(el)
  }

  // ── 동작 ──────────────────────────────────────────────────────────────────
  /** 화살표를 대상까지 — 대상이 아직 떠오르는 중이면(쪽 들어옴) 프레임마다 자리를 다시 재서 따라간다 */
  async #move(id: number, target: Target, ms: number, buttons = 0) {
    if (!this.#point(target)) return
    this.#target = target
    const from = { ...this.#cursor }
    const t0 = this.#t
    const dur = ms / 1000
    for (;;) {
      const u = Math.min(1, (this.#t - t0) / dur)
      const e = easeInOutCubic(u)
      const to = this.#point(target) ?? from
      this.#cursor = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
      this.#place()
      this.#moved(buttons)
      if (u >= 1) return
      await this.#at(this.#t + 1 / 120, id)
    }
  }

  #ripple() {
    const ring = this.#o.cursor.querySelector('.d15-cursor__ring')
    ring?.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.45)', opacity: 0.75 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ],
      { duration: 380, easing: EASE_OUT_CUBIC },
    )
  }

  #click() {
    // 마지막 대상이 그사이 움직였으면(떠오름 끝) 그 자리로 붙여서 누른다
    const p = this.#target ? this.#point(this.#target) : null
    if (p) {
      this.#cursor = p
      this.#place()
    }
    const { el, c } = this.#underCursor()
    if (!el) return
    this.#ripple()
    this.#fire('pointerdown', el, c, { buttons: 1 })
    this.#fire('pointerup', el, c)
    this.#fire('click', el, c)
  }

  async #type(id: number, sel: string, text: string) {
    const input = this.#o.camera.querySelector<HTMLInputElement>(sel)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (!input || !setter) return
    for (let i = 1; i <= text.length; i++) {
      setter.call(input, text.slice(0, i))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await this.#at(this.#t + TYPE_MS / 1000, id)
    }
  }

  async #drag(id: number, path: readonly [Target, number][]) {
    const { el, c } = this.#underCursor()
    if (!el) return
    this.#ripple()
    this.#fire('pointerdown', el, c, { buttons: 1 })
    for (const [target, ms] of path) await this.#move(id, target, ms, 1)
    const end = this.#underCursor()
    this.#fire('pointerup', end.el ?? el, end.c)
  }

  #zoom(zoom: Zoom | null, animate = true) {
    const cam = this.#o.camera
    let to = 'none'
    if (zoom) {
      // 확대를 풀고 잰 자리(카메라 층 좌표) — 그 가운데를 무대 가운데(36em, 19.5em)로
      const prev = cam.style.transform
      cam.style.transform = 'none'
      const p = this.#point(zoom.sel)
      cam.style.transform = prev
      if (!p) return
      to = `translate(${36 - zoom.scale * p.x}em, ${19.5 - zoom.scale * p.y}em) scale(${zoom.scale})`
    }
    this.#zoomed = !!zoom
    const from = getComputedStyle(cam).transform
    cam.getAnimations().forEach((a) => a.cancel())
    cam.style.transform = to
    if (!animate || prefersReducedMotion()) return
    cam.animate([{ transform: from === 'none' ? 'none' : from }, { transform: to }], {
      duration: zoom ? CAMERA_IN_MS : CAMERA_OUT_MS,
      easing: zoom ? EASE_STANDARD : EASE_IN_OUT_CUBIC,
    })
  }

  #caption(text: string | null, animate = true) {
    const el = this.#o.caption
    el.getAnimations().forEach((a) => a.cancel())
    if (text) {
      const label = el.querySelector('.d15-caption__text')
      if (label) label.textContent = text
      el.style.opacity = '1'
      if (animate)
        el.animate(
          [
            { opacity: 0, transform: 'translateY(0.8em)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: CAPTION_IN_MS, easing: EASE_OUT_CUBIC },
        )
      return
    }
    if (el.style.opacity !== '1') return
    el.style.opacity = '0'
    if (animate)
      el.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateY(-0.2em)' },
        ],
        { duration: CAPTION_OUT_MS, easing: EASE_IN_CUBIC },
      )
  }

  // ── 차례(영상 시각) ───────────────────────────────────────────────────────
  async #loop(id: number) {
    for (;;) {
      this.#t = MOUNT_AT
      await this.#script(id)
      await this.#at(LOOP_S, id)
    }
  }

  async #script(id: number) {
    const at = (t: number) => this.#at(t, id)
    const move = (target: Target, ms: number) => this.#move(id, target, ms)

    // F0 — 처음 상태로(앱을 다시 붙이면 대시보드가 떠오른다)
    this.#zoom(null, false)
    this.#caption(null, false)
    this.#o.reset()
    this.#target = null
    this.#cursor = { ...CURSOR_HOME }
    this.#place()
    this.#o.cursor.style.opacity = '1'

    // 프로젝트 더하기 — F41 누름, F52~F68 치기, F86.5 Add project
    await at(1.0)
    await move('[data-tour="add-project"]', 350)
    await at(1.38)
    this.#click()
    await at(1.73)
    await this.#type(id, '[data-tour="project-name"]', 'Payment Gateway')
    await at(2.33)
    await move('[data-tour="project-create"]', 450)
    await at(2.55)
    this.#caption(D15_CAPTIONS.add)
    await at(2.88)
    this.#click()
    await at(3.72)
    this.#caption(null)

    // 시간 기록 확대(F118.75~F141) → 재생(F149) → 풀기(F180)
    await at(3.96)
    this.#zoom(ZOOMS.tracker)
    await at(4.55)
    await move('[data-tour="tracker-play"]', 380)
    await at(4.97)
    this.#click()
    await at(6.01)
    this.#zoom(null)

    // 할 일 — F222 누름, F257 들기, To do → Done(F282 놓기)
    await at(6.95)
    await move('[data-tour="nav-tasks"]', 420)
    await at(7.4)
    this.#click()
    await at(8.15)
    await move({ sel: '[data-task="t-saved"]', fx: 0.62, fy: 0.42 }, 380)
    await at(8.57)
    // F258~F266 To do 안에서 조금 움직이다가 F270 In progress → F273 In review → F278 Done, F282 놓기
    const drag = this.#drag(id, [
      [{ sel: '[data-tour="col-todo"]', fx: 0.82, fy: 0.13 }, 330],
      [{ sel: '[data-tour="col-progress"]', fx: 0.45, fy: 0.12 }, 120],
      [{ sel: '[data-tour="col-review"]', fx: 0.55, fy: 0.12 }, 130],
      [{ sel: '[data-tour="col-done"]', fx: 0.62, fy: 0.12 }, 140],
      [{ sel: '[data-tour="col-done"]', fx: 0.6, fy: 0.14 }, 120],
    ])
    await at(8.63)
    this.#caption(D15_CAPTIONS.drag)
    await drag
    await at(10.23)
    this.#caption(null)

    // 팀 — F335 누름, F362 Design, F396.5 Profile, F438.5 닫기
    await at(10.75)
    await move('[data-tour="nav-team"]', 400)
    await at(11.17)
    this.#click()
    await at(11.7)
    this.#caption(D15_CAPTIONS.team)
    await move('[data-tour="team-tab-Design"]', 320)
    await at(12.07)
    this.#click()
    await at(12.85)
    await move('[data-tour="profile-pr"]', 330)
    await at(13.2)
    this.#click()
    await at(13.33)
    this.#caption(null)
    await at(14.25)
    await move('[data-tour="drawer-close"]', 340)
    await at(14.62)
    this.#click()

    // 달력 — F462 누름, F497.5 다음 달, F526.5 Today
    await at(15.0)
    await move('[data-tour="nav-calendar"]', 380)
    await at(15.4)
    this.#click()
    await at(16.2)
    await move('[data-tour="cal-next"]', 350)
    await at(16.57)
    this.#click()
    await at(17.15)
    await move('[data-tour="cal-today"]', 360)
    await at(17.53)
    this.#click()

    // 분석 — F563 누름, F597 90D, 처리량 확대(F602~F672)와 말풍선
    await at(18.35)
    await move('[data-tour="nav-analytics"]', 400)
    await at(18.77)
    this.#click()
    await at(19.55)
    await move('[data-tour="range-90D"]', 330)
    await at(19.9)
    this.#click()
    await at(20.07)
    this.#zoom(ZOOMS.throughput)
    // 말풍선 차례(F614 Aug 24 → F620 Jul 27 → F630 Jul 28 → F640 Aug 23 → F648 Sep 17 → F660 Sep 26)
    await at(20.3)
    await move(day(43), 170)
    await at(20.5)
    await move(day(15), 170)
    await at(20.9)
    await move(day(16), 100)
    await at(21.05)
    await move(day(42, 0.55), 280)
    await at(21.4)
    await move(day(67, 0.5), 200)
    await at(21.7)
    await move(day(76, 0.5), 300)
    await at(22.4)
    this.#zoom(null)
    await at(23.15)
    await move(day(45), 300)
    await at(23.45)
    await move(day(58), 250)

    // 설정 — F721 누름, 모양 확대(F748~F803), F776 Plum
    await at(23.62)
    await move('[data-tour="nav-settings"]', 380)
    await at(24.03)
    this.#click()
    // 처음 Profile이 열린다 — F740.5에 Appearance 갈래를 누른다
    await at(24.3)
    await move('[data-tour="settings-appearance"]', 330)
    await at(24.68)
    this.#click()
    await at(25.0)
    this.#zoom(ZOOMS.appearance)
    await at(25.5)
    await move('[data-tour="accent-plum"]', 340)
    await at(25.87)
    this.#click()
    await at(26.77)
    this.#zoom(null)
    await at(27.53)
    this.#caption(D15_CAPTIONS.accent)

    // 대시보드로 — F855 누름, 보라로 다시 떠오른다
    await at(28.1)
    await move('[data-tour="nav-dashboard"]', 380)
    await at(28.5)
    this.#click()
    await at(29.87)
    this.#caption(null)
  }
}
