import { useSyncExternalStore } from 'react'
import type { Model } from './model'
import { CASE_LEN, FADE_START } from './timeline'

// 시계 하나로 모든 움직임을 정한다 — 케이스 하나 4.5초, 6개를 돌아 27초.
// 화면 조각마다 시간에서 상태를 계산하므로(이벤트를 주고받지 않는다) 어느
// 시점이든 바로 그려 볼 수 있다(?t=12.3 으로 그 시점에서 시작). 멈춰도 카메라·
// 입자는 계속 움직인다 — clock은 늘 흐르고, 시간표의 t만 선다.

const CONF_EASE = (x: number) => 1 - (1 - x) ** 3
const ASSEMBLE_STEP = 0.06

/** 한 번에 바뀌는 상태 — 바뀔 때만 새 객체가 되어 화면이 다시 그려진다. */
export interface Snapshot {
  slot: number
  /** 빛 점이 닿아 켜진 단계 수. */
  stepOn: number
  fading: boolean
  confPhase: 'pending' | 'counting' | 'final'
  confText: string
  verdict: 'pass' | 'hold' | null
  subtitleCount: number
  /** 출력 노드에서 조립된 칸 수. */
  assembled: number
  playing: boolean
}

const snapshotAt = (
  model: Model,
  slot: number,
  tau: number,
  playing: boolean,
): Snapshot => {
  const { confidence, hold, timeline: tl } = model.cases[slot]
  const stepOn = tl.at.filter((a) => tau >= a).length
  const counting = tau >= tl.confStart && tau < tl.confEnd
  const confPhase =
    tau < tl.confStart ? 'pending' : counting ? 'counting' : 'final'
  const value =
    confPhase === 'counting'
      ? confidence *
        CONF_EASE((tau - tl.confStart) / (tl.confEnd - tl.confStart))
      : confidence
  const fading = tau >= FADE_START
  return {
    slot,
    stepOn,
    fading,
    confPhase: fading ? 'pending' : confPhase,
    confText: confPhase === 'pending' || fading ? '- . --' : value.toFixed(2),
    verdict: tau >= tl.verdictAt && !fading ? (hold ? 'hold' : 'pass') : null,
    subtitleCount: tl.subtitleAt.filter((a) => tau >= a).length,
    assembled:
      tau < tl.assembleStart
        ? 0
        : Math.min(
            model.graph.layers[4].length,
            Math.floor((tau - tl.assembleStart) / ASSEMBLE_STEP) + 1,
          ),
    playing,
  }
}

const same = (a: Snapshot, b: Snapshot) =>
  a.slot === b.slot &&
  a.stepOn === b.stepOn &&
  a.fading === b.fading &&
  a.confPhase === b.confPhase &&
  a.confText === b.confText &&
  a.verdict === b.verdict &&
  a.subtitleCount === b.subtitleCount &&
  a.assembled === b.assembled &&
  a.playing === b.playing

export interface Frame {
  /** 반복 안에서의 초(0~27). */
  t: number
  slot: number
  /** 케이스 안에서의 초(0~4.5). */
  tau: number
  /** 지난 프레임과의 간격(초) — 멈춰 있어도 흐른다. */
  dt: number
  /** 화면을 연 뒤 흐른 초 — 먼지·숨쉬기처럼 늘 움직이는 것에. */
  clock: number
  playing: boolean
}

type FrameCallback = (f: Frame) => void

/**
 * 시계 — requestAnimationFrame 하나로 돌고, 프레임마다 그리는 쪽(캔버스·카메라)
 * 에 시간을 넘기고, 바뀐 상태만 React 쪽에 알린다. 망을 고치면 setModel로 새
 * 모델을 받는다.
 */
export class Engine {
  model: Model
  frame: Frame = { t: 0, slot: 0, tau: 0, dt: 0, clock: 0, playing: true }
  private time: number
  private playing: boolean
  private clock = 0
  private raf = 0
  private lastMs = 0
  private snap: Snapshot
  private listeners = new Set<() => void>()
  private frames = new Set<FrameCallback>()

  constructor(model: Model, startAt = 0, paused = false) {
    this.model = model
    this.time = startAt
    this.playing = !paused
    this.snap = this.snapshot()
  }

  get loopLen() {
    return CASE_LEN * this.model.cases.length
  }

  start() {
    this.lastMs = performance.now()
    const loop = (now: number) => {
      this.tick(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  play() {
    this.playing = true
    this.publish()
  }

  pause() {
    this.playing = false
    this.publish()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  /** 그 시점으로 옮긴다(paused를 주면 재생·멈춤도 같이). */
  seek(t: number, paused?: boolean) {
    this.time = t
    if (paused !== undefined) this.playing = !paused
    this.apply(0)
  }

  /** 그 케이스의 처음으로(앞뒤로 넘기면 한 바퀴 돈다). */
  jump(slot: number) {
    const n = this.model.cases.length
    this.seek((((slot % n) + n) % n) * CASE_LEN)
  }

  /** 망을 고치면 — 시간표가 바뀌었을 수 있으니 상태를 다시 계산해 알린다. */
  setModel(model: Model) {
    this.model = model
    this.snap = this.snapshot()
    for (const fn of this.listeners) fn()
  }

  /** 시험용 — from에서 to까지 1/60초씩 돌려(카메라처럼 따라오는 것까지 맞춘
   * 뒤) to에 멈춘다. */
  simulate(from: number, to: number) {
    const step = 1 / 60
    for (let t = from; t < to; t += step) {
      this.time = t
      this.clock += step
      this.apply(step)
    }
    this.seek(to, true)
  }

  private tick(now: number) {
    const dt = Math.min(0.1, (now - this.lastMs) / 1000)
    this.lastMs = now
    this.clock += dt
    if (this.playing) this.time += dt
    this.apply(dt)
  }

  private where() {
    const len = this.loopLen
    const t = ((this.time % len) + len) % len
    const slot = Math.min(this.model.cases.length - 1, Math.floor(t / CASE_LEN))
    return { t, slot, tau: t - slot * CASE_LEN }
  }

  private snapshot() {
    const { slot, tau } = this.where()
    return snapshotAt(this.model, slot, tau, this.playing)
  }

  private apply(dt: number) {
    const { t, slot, tau } = this.where()
    this.frame = { t, slot, tau, dt, clock: this.clock, playing: this.playing }
    for (const cb of this.frames) cb(this.frame)
    this.publish()
  }

  private publish() {
    const next = this.snapshot()
    if (!same(next, this.snap)) {
      this.snap = next
      for (const fn of this.listeners) fn()
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getSnapshot = () => this.snap

  onFrame(cb: FrameCallback) {
    this.frames.add(cb)
    return () => {
      this.frames.delete(cb)
    }
  }
}

/** 상태의 한 조각만 — 그 조각이 바뀔 때만 다시 그린다(원시값을 고를 것). */
export const useEngine = <T>(engine: Engine, select: (s: Snapshot) => T): T =>
  useSyncExternalStore(engine.subscribe, () => select(engine.getSnapshot()))
