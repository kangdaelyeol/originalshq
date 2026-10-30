import { useSyncExternalStore } from 'react'
import { GATE, LOOP, type CaseDef } from './data'
import { pathOf } from './geometry'

// 시계 하나로 모든 움직임을 정한다 — 케이스 하나 4.5초, 6개를 돌아 27초.
// 화면 조각마다 시간에서 상태를 계산하므로(이벤트를 주고받지 않는다) 어느
// 시점이든 바로 그려 볼 수 있다(?t=12.3 으로 그 시점에서 시작).

export const CASE_LEN = 4.5
export const LOOP_LEN = CASE_LEN * LOOP.length

const ENTER_END = 0.3
/** 카드에 닿은 뒤 떠나기까지 — 첫 카드는 빛 점이 카드를 가로지르느라 조금 길다. */
const DWELL = 0.22
const FIRST_DWELL = 0.33
export const FADE_START = 3.9
export const FADE_END = 4.2
const CONF_LEN = 0.45
const ASSEMBLE_STEP = 0.06

export interface Step {
  col: number
  id: string
}

export interface Hop {
  from: number
  to: number
  start: number
  end: number
}

export interface CaseTimeline {
  steps: Step[]
  /** 단계마다 빛 점이 닿아 카드가 켜지는 때. */
  at: number[]
  hops: Hop[]
  confStart: number
  confEnd: number
  verdictAt: number
  /** 제목 밑 줄 4조각이 붙는 때. */
  subtitleAt: number[]
  /** 원형 링이 생기는 단계(은닉 인코더·마지막 노드). */
  rings: { step: number; at: number }[]
  assembleStart: number
}

export const buildTimeline = (c: CaseDef): CaseTimeline => {
  const steps = c.path.flatMap((id, col) => (id ? [{ col, id }] : []))
  const at = [ENTER_END]
  const hops: Hop[] = []
  for (let i = 1; i < steps.length; i++) {
    // 건너가는 시간은 길이에 비례 — 영상에서 같은 줄은 0.25초, 여섯 줄 아래는 0.53초.
    const dur = 0.2 + pathOf(steps[i - 1].id, steps[i].id).total * 0.00038
    const start = at[i - 1] + (i === 1 ? FIRST_DWELL : DWELL)
    hops.push({ from: i - 1, to: i, start, end: start + dur })
    at.push(start + dur)
  }
  const hidden = steps.findIndex((s) => s.col === 2)
  const gate = steps.findIndex((s) => s.col === 3)
  const last = steps.length - 1
  // 신뢰도는 은닉층(인코더)에서 나온다 — 건너뛰면 그 기둥을 지나는 중간에.
  const confStart =
    hidden >= 0
      ? at[hidden] + 0.05
      : (() => {
          const h = hops.find((x) => steps[x.to].col > 2)!
          return (h.start + h.end) / 2
        })()
  const confEnd = confStart + CONF_LEN
  return {
    steps,
    at,
    hops,
    confStart,
    confEnd,
    verdictAt: at[gate] + 0.08,
    subtitleAt: [at[1] - 0.25, confEnd, at[gate], at[last] + 0.25],
    rings: [
      ...(hidden >= 0 ? [{ step: hidden, at: at[hidden] }] : []),
      { step: last, at: at[last] },
    ],
    assembleStart: at[last] + 0.15,
  }
}

export const TIMELINES = LOOP.map(buildTimeline)

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
  /** 출력 노드에서 조립된 칸 수(0~8). */
  assembled: number
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3

const snapshotAt = (slot: number, tau: number): Snapshot => {
  const c = LOOP[slot]
  const tl = TIMELINES[slot]
  const stepOn = tl.at.filter((a) => tau >= a).length
  const counting = tau >= tl.confStart && tau < tl.confEnd
  const confPhase =
    tau < tl.confStart ? 'pending' : counting ? 'counting' : 'final'
  const value =
    confPhase === 'counting'
      ? c.confidence *
        easeOutCubic((tau - tl.confStart) / (tl.confEnd - tl.confStart))
      : c.confidence
  const fading = tau >= FADE_START
  return {
    slot,
    stepOn,
    fading,
    confPhase: fading ? 'pending' : confPhase,
    confText: confPhase === 'pending' || fading ? '- . --' : value.toFixed(2),
    verdict:
      tau >= tl.verdictAt && !fading
        ? c.confidence >= GATE
          ? 'pass'
          : 'hold'
        : null,
    subtitleCount: tl.subtitleAt.filter((a) => tau >= a).length,
    assembled:
      tau < tl.assembleStart
        ? 0
        : Math.min(8, Math.floor((tau - tl.assembleStart) / ASSEMBLE_STEP) + 1),
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
  a.assembled === b.assembled

export interface Frame {
  /** 반복 안에서의 초(0~27). */
  t: number
  slot: number
  /** 케이스 안에서의 초(0~4.5). */
  tau: number
  /** 지난 프레임과의 간격(초). */
  dt: number
}

type FrameCallback = (f: Frame) => void

/**
 * 시계 — requestAnimationFrame 하나로 돌고, 프레임마다 그리는 쪽(캔버스·카메라)
 * 에 시간을 넘기고, 바뀐 상태만 React 쪽에 알린다.
 */
export class Engine {
  private offset = 0
  private startMs = 0
  private paused = false
  private raf = 0
  private lastMs = 0
  private snap: Snapshot
  private listeners = new Set<() => void>()
  private frames = new Set<FrameCallback>()
  frame: Frame = { t: 0, slot: 0, tau: 0, dt: 0 }

  constructor(startAt = 0, paused = false) {
    this.offset = startAt
    this.paused = paused
    const t = ((startAt % LOOP_LEN) + LOOP_LEN) % LOOP_LEN
    this.snap = snapshotAt(Math.floor(t / CASE_LEN), t % CASE_LEN)
  }

  start() {
    this.startMs = performance.now()
    this.lastMs = this.startMs
    const loop = (now: number) => {
      this.tick(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  /** 시험용 — 그 시점으로 옮기고(멈춤이면 거기 멈춘다). */
  seek(t: number, paused = this.paused) {
    this.offset = t
    this.paused = paused
    this.startMs = performance.now()
  }

  /** 시험용 — from에서 to까지 1/60초씩 돌려(카메라처럼 따라오는 것까지 맞춘
   * 뒤) to에 멈춘다. */
  simulate(from: number, to: number) {
    const step = 1 / 60
    for (let t = from; t < to; t += step) this.apply(t, step)
    this.seek(to, true)
  }

  private tick(now: number) {
    const dt = Math.min(0.1, (now - this.lastMs) / 1000)
    this.lastMs = now
    const elapsed = this.paused ? 0 : (now - this.startMs) / 1000
    this.apply(this.offset + elapsed, this.paused ? 0 : dt)
  }

  private apply(time: number, dt: number) {
    const t = ((time % LOOP_LEN) + LOOP_LEN) % LOOP_LEN
    const slot = Math.floor(t / CASE_LEN)
    const tau = t - slot * CASE_LEN
    this.frame = { t, slot, tau, dt }
    for (const cb of this.frames) cb(this.frame)
    const next = snapshotAt(slot, tau)
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
