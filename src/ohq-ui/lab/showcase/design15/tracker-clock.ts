import { useSyncExternalStore } from 'react'

/**
 * 시간 기록 시계 — 쪽을 옮겨 대시보드가 떨어져도 시간은 흐른다(영상 F855 다시 왔을 때 01:24:40).
 * 재생 여부만 구독한다(초마다 React를 다시 그리지 않는다 — 숫자는 TimeTracker가 DOM으로 굴린다).
 */
export class TrackerClock {
  #base: number
  #since: number | null = null
  #subs = new Set<() => void>()

  constructor(seconds: number) {
    this.#base = seconds
  }

  /** 지금까지 흐른 초(소수) */
  elapsed(now = performance.now()) {
    return this.#since === null ? this.#base : this.#base + (now - this.#since) / 1000
  }

  get running() {
    return this.#since !== null
  }

  play() {
    if (this.#since !== null) return
    this.#since = performance.now()
    this.#emit()
  }

  pause() {
    if (this.#since === null) return
    this.#base = this.elapsed()
    this.#since = null
    this.#emit()
  }

  toggle() {
    if (this.running) this.pause()
    else this.play()
  }

  /** 멈추고 0으로 */
  stop() {
    this.#base = 0
    this.#since = null
    this.#emit()
  }

  subscribe = (cb: () => void) => {
    this.#subs.add(cb)
    return () => {
      this.#subs.delete(cb)
    }
  }

  #emit() {
    this.#subs.forEach((cb) => cb())
  }
}

export function useTrackerRunning(clock: TrackerClock) {
  return useSyncExternalStore(
    clock.subscribe,
    () => clock.running,
    () => false,
  )
}
