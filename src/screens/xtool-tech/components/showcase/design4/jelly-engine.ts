// 젤리 슬라이더의 움직임 — 캔버스 하나에 렌더러·줄 물리·포인터 해석·영상 끌기 재생을 묶는다.
// React와 상관없는 클래스라 컴포넌트(jelly-slider.tsx)는 이벤트를 넘기고 값만 받는다.

import { projectToCanvas, trackXAt } from './jelly-camera'
import { DEMO_FIRST_FRAME, DEMO_KNOB_PATH, DEMO_LAST_FRAME, DEMO_REST_VALUE, demoKnobAt, demoPercentAt } from './jelly-demo'
import { loadJellyFonts } from './jelly-digits'
import { ALL_LAYERS, JellyRenderer, type JellyLayers } from './jelly-renderer'
import { JellyRope, ROPE_KNOB_Y, ROPE_MAX_X } from './jelly-rope'

/** 물리 한 걸음(초) — 화면 주사율과 상관없이 1/60로 고정(영상에 맞춘 물리 값도 이 걸음으로 골랐다) */
export const PHYSICS_STEP = 1 / 60
/** 손잡이가 목표를 따라가는 비율(원본 MOUSE_SMOOTHING) — 한 걸음마다 남은 거리의 8% */
const SMOOTHING = 0.08
const VIDEO_FPS = 30
/** 멈춘 뒤 TAA가 가라앉을 때까지 더 그리는 장수(0.9^30 ≈ 4%) */
const SETTLE_FRAMES = 30
/** 손잡이를 잡았다고 볼 거리(세계 x) — 둥근 끝 반지름 0.17 남짓 */
const GRAB_RADIUS = 0.16

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi)

// 값 ↔ 손잡이 x — 영상에서 48%로 멈춘 손잡이(0.1628)와 오른쪽 끝(0.9 = 100%)을 잇는 직선.
// 0%는 -0.524(영상에서 가장 왼쪽까지 민 -0.229가 숫자로는 30% 남짓).
const REST_KNOB_X = DEMO_KNOB_PATH[0]
const KNOB_PER_VALUE = (ROPE_MAX_X - REST_KNOB_X) / (100 - DEMO_REST_VALUE - 0.5)

/** 값(0~100) → 손잡이 x — 그 값 구간의 가운데. 100은 끝까지. */
export const knobXForValue = (value: number) =>
  value >= 100 ? ROPE_MAX_X : REST_KNOB_X + (value - DEMO_REST_VALUE) * KNOB_PER_VALUE

/** 손잡이 x → 연속 값(구간 가운데에서 .5) */
const valueAt = (x: number) => (x - REST_KNOB_X) / KNOB_PER_VALUE + DEMO_REST_VALUE + 0.5

/** 손잡이 x → 값(0~100 정수) */
export const valueForKnobX = (x: number) => clamp(Math.floor(valueAt(x)), 0, 100)

/** 바닥 숫자가 손잡이를 늦게 따라오는 시간(초) — 영상에서 숫자가 손잡이보다 2~4프레임 늦다 */
const LABEL_LAG = 0.09

export const KNOB_MIN_X = knobXForValue(0)

/** 100%에서 그 값까지 끌어다 놓고 4초 기다린 줄 — 영상 첫 장면(48%)과 같은 혹 모양이 된다 */
export function settledRope(value: number): JellyRope {
  const rope = new JellyRope()
  const target = knobXForValue(value)
  let knob = ROPE_MAX_X
  for (let i = 0; i < 240; i++) {
    knob += (target - knob) * SMOOTHING
    rope.target = knob
    rope.update(PHYSICS_STEP)
  }
  return rope
}

const restCache = new Map<number, JellyRope>()
const restRope = (value: number) => {
  let rope = restCache.get(value)
  if (!rope) {
    rope = settledRope(value)
    restCache.set(value, rope)
  }
  return rope
}

/** 영상 프레임까지 끌기를 따라간 줄(정지 화면·되감기용) — `onStep`은 마지막 몇 걸음을 그릴 때 */
export function demoRopeAt(
  frame: number,
  onStep?: (rope: JellyRope, stepsLeft: number, frame: number) => void,
): JellyRope {
  const rope = new JellyRope()
  rope.copyFrom(restRope(DEMO_REST_VALUE))
  const steps = Math.max(0, Math.round(((frame - DEMO_FIRST_FRAME) / VIDEO_FPS) / PHYSICS_STEP))
  for (let i = 1; i <= steps; i++) {
    const f = DEMO_FIRST_FRAME + i * PHYSICS_STEP * VIDEO_FPS
    rope.target = demoKnobAt(f)
    rope.update(PHYSICS_STEP)
    onStep?.(rope, steps - i, f)
  }
  return rope
}

export interface JellyEngineOptions {
  value: number
  /** 값이 바뀌면(끌기·키보드·영상 재생) */
  onValue: (value: number) => void
  /** 영상 끌기 재생이 시작·끝날 때 */
  onDemo?: (playing: boolean) => void
  layers?: JellyLayers
  /** 레이마칭 해상도(화면 CSS 1px당 픽셀) — 1이면 영상처럼 부드럽고, 높일수록 선명·무거움 */
  resolution?: number
  /** WebGL2를 못 쓸 때 */
  onError?: (message: string) => void
}

export class JellyEngine {
  readonly #canvas: HTMLCanvasElement
  readonly #opts: JellyEngineOptions
  #renderer: JellyRenderer | null = null
  #rope: JellyRope
  #knob: number
  #target: number
  #value: number
  #dragging = false
  #grabOffset = 0
  #demoTime: number | null = null
  /** 바닥에 새긴 숫자(손잡이를 늦게 따라오는 연속 값) */
  #shown: number
  #acc = 0
  #last = 0
  #raf = 0
  #idle = 0
  #visible = true
  #cssW = 0
  readonly #resize: ResizeObserver
  readonly #intersect: IntersectionObserver
  #disposed = false

  constructor(canvas: HTMLCanvasElement, opts: JellyEngineOptions) {
    this.#canvas = canvas
    this.#opts = opts
    this.#value = clamp(Math.round(opts.value), 0, 100)
    this.#rope = new JellyRope()
    this.#rope.copyFrom(restRope(this.#value))
    this.#knob = this.#target = this.#rope.target
    this.#shown = this.#value + 0.5
    this.#createRenderer()

    canvas.addEventListener('webglcontextlost', this.#onLost)
    canvas.addEventListener('webglcontextrestored', this.#onRestored)
    this.#resize = new ResizeObserver(() => this.#measure())
    this.#resize.observe(canvas)
    this.#intersect = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting
      if (this.#visible) this.#kick()
    })
    this.#intersect.observe(canvas)
    void loadJellyFonts().then(() => {
      this.#renderer?.invalidateDigits()
      this.#kick()
    })
  }

  get value() {
    return this.#value
  }

  get playingDemo() {
    return this.#demoTime !== null
  }

  /** 밖에서 값을 정할 때(키보드·controlled value) — 손잡이는 부드럽게 따라간다 */
  setValue(value: number, notify = false) {
    const v = clamp(Math.round(value), 0, 100)
    this.#stopDemo()
    this.#target = knobXForValue(v)
    this.#commit(v, notify)
    this.#kick()
  }

  /** 포인터를 눌렀을 때(캔버스 안 비율 0~1) — 손잡이 위면 잡고, 아니면 그 자리로 보낸다 */
  pointerDown(u: number, v: number) {
    this.#stopDemo()
    const x = trackXAt(u, v, this.#view())
    this.#grabOffset = this.isOverKnob(u, v) ? this.#target - x : 0.01
    this.#dragging = true
    this.#setTarget(x + this.#grabOffset)
  }

  pointerMove(u: number, v: number) {
    if (!this.#dragging) return
    this.#setTarget(trackXAt(u, v, this.#view()) + this.#grabOffset)
  }

  /** 놓으면 손잡이를 그 값의 자리로 맞춘다(바닥 숫자 = 값) */
  pointerUp() {
    if (!this.#dragging) return
    this.#dragging = false
    this.#target = knobXForValue(this.#value)
    this.#kick()
  }

  /** 포인터가 둥근 끝(손잡이) 위인지 — 커서 모양(grab)용 */
  isOverKnob(u: number, v: number) {
    const view = this.#view()
    const x = trackXAt(u, v, view)
    const knob = projectToCanvas({ x: this.#rope.capX + 0.09, y: ROPE_KNOB_Y, z: 0 }, view)
    return Math.abs(x - (this.#rope.capX + 0.09)) < GRAB_RADIUS && Math.abs(v - knob.v) < 0.12
  }

  /** 영상 속 끌기를 처음부터 — 48%에 멈춘 젤리에서 시작한다 */
  playDemo() {
    this.#dragging = false
    this.#rope.copyFrom(restRope(DEMO_REST_VALUE))
    this.#knob = this.#target = this.#rope.target
    this.#demoTime = 0
    this.#acc = 0
    this.#shown = DEMO_REST_VALUE + 0.5
    this.#commit(DEMO_REST_VALUE, true)
    this.#opts.onDemo?.(true)
    this.#kick()
  }

  stopDemo() {
    this.#stopDemo()
  }

  /**
   * 영상의 한 프레임으로 맞춰 그린다(영상과 나란히 비교할 때). 실제 재생처럼 마지막 16걸음은
   * 한 걸음마다 그려 TAA 잔상까지 같게 만든다. 그 뒤로는 멈춰 있다.
   */
  seekDemo(frame: number) {
    const r = this.#renderer
    this.#stopDemo()
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    r?.resetHistory()
    const rope = demoRopeAt(frame, (state, left, f) => {
      if (left < 16) r?.render(state, { percent: demoPercentAt(f), layers: this.#layers() })
    })
    this.#rope = rope
    this.#knob = this.#target = rope.target
    this.#value = demoPercentAt(frame)
    this.#shown = this.#value + 0.5
  }

  dispose() {
    this.#disposed = true
    cancelAnimationFrame(this.#raf)
    this.#resize.disconnect()
    this.#intersect.disconnect()
    this.#canvas.removeEventListener('webglcontextlost', this.#onLost)
    this.#canvas.removeEventListener('webglcontextrestored', this.#onRestored)
    this.#renderer?.dispose()
    this.#renderer = null
  }

  /** 바닥에 새길 숫자 */
  #percent() {
    return clamp(Math.floor(this.#shown), 0, 100)
  }

  #layers() {
    return this.#opts.layers ?? ALL_LAYERS
  }

  #view() {
    return this.#renderer?.view ?? { left: -1, right: 1, bottom: -1, top: 1 }
  }

  #createRenderer() {
    try {
      this.#renderer = new JellyRenderer(this.#canvas)
    } catch (e) {
      this.#renderer = null
      // 컴포넌트 effect 안에서 바로 setState가 불리지 않게 한 박자 늦춘다
      const message = e instanceof Error ? e.message : String(e)
      queueMicrotask(() => {
        if (!this.#disposed) this.#opts.onError?.(message)
      })
    }
  }

  #onLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    this.#renderer = null
  }

  #onRestored = () => {
    this.#createRenderer()
    this.#measure()
  }

  #measure() {
    const rect = this.#canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1 || !this.#renderer) return
    this.#cssW = rect.width
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const res = this.#opts.resolution ?? 1
    this.#renderer.resize(rect.width * dpr, rect.height * dpr, rect.width * res, rect.height * res)
    this.#kick()
  }

  #setTarget(x: number) {
    this.#target = clamp(x, KNOB_MIN_X, ROPE_MAX_X)
    this.#commit(valueForKnobX(this.#target), true)
    this.#kick()
  }

  #commit(value: number, notify: boolean) {
    if (value === this.#value) return
    this.#value = value
    if (notify) this.#opts.onValue(value)
  }

  #stopDemo() {
    if (this.#demoTime === null) return
    this.#demoTime = null
    this.#target = this.#knob
    this.#opts.onDemo?.(false)
  }

  /** 그리기 고리를 깨운다 — 멈춰 있어도 TAA가 다시 가라앉을 때까지(SETTLE_FRAMES) 그린다 */
  #kick() {
    this.#idle = 0
    if (this.#disposed || this.#raf || !this.#visible || !this.#renderer || this.#cssW < 1) return
    this.#last = performance.now()
    this.#raf = requestAnimationFrame(this.#tick)
  }

  #tick = (now: number) => {
    this.#raf = 0
    const dt = clamp((now - this.#last) / 1000, 0, 0.1)
    this.#last = now
    this.#acc += dt
    let steps = 0
    while (this.#acc >= PHYSICS_STEP && steps < 6) {
      this.#step()
      this.#acc -= PHYSICS_STEP
      steps++
    }
    if (steps === 6) this.#acc = 0
    this.#renderer?.render(this.#rope, { percent: this.#percent(), layers: this.#layers() })

    const still =
      this.#demoTime === null &&
      !this.#dragging &&
      Math.abs(this.#target - this.#knob) < 1e-5 &&
      Math.abs(this.#shown - valueAt(this.#knob)) < 0.01 &&
      this.#rope.motion < 2e-6
    this.#idle = still ? this.#idle + 1 : 0
    if (this.#idle < SETTLE_FRAMES && this.#visible && this.#renderer) {
      this.#raf = requestAnimationFrame(this.#tick)
    }
  }

  #step() {
    if (this.#demoTime !== null) {
      this.#demoTime += PHYSICS_STEP
      const frame = DEMO_FIRST_FRAME + this.#demoTime * VIDEO_FPS
      this.#knob = this.#target = demoKnobAt(frame)
      this.#shown = demoPercentAt(frame) + 0.5
      this.#commit(demoPercentAt(frame), true)
      if (frame >= DEMO_LAST_FRAME) {
        this.#demoTime = null
        this.#target = knobXForValue(DEMO_REST_VALUE)
        this.#commit(DEMO_REST_VALUE, true)
        this.#opts.onDemo?.(false)
      }
    } else {
      this.#knob += (this.#target - this.#knob) * SMOOTHING
      this.#shown += (valueAt(this.#knob) - this.#shown) * (1 - Math.exp(-PHYSICS_STEP / LABEL_LAG))
    }
    this.#rope.target = this.#knob
    this.#rope.update(PHYSICS_STEP)
  }
}
