import type { Easing, TargetAndTransition, Transition } from 'motion/react'

/**
 * 키 하나 — [시각(초), 값, 앞 키에서 이 키로 갈 때의 easing].
 * 시각은 재생을 건 순간(영상의 주기 시작)부터 잰 절대 시각이라, 영상 프레임 번호 ÷ 30을 그대로 옮겨 적는다.
 */
export type Key = readonly [time: number, value: number | string, ease?: Easing]

/** 영상 프레임 → 초(30fps) */
export const fr = (frame: number) => frame / 30

/**
 * 값별 키 목록 → motion 키프레임(TargetAndTransition).
 * 첫 키 시각은 delay, 나머지는 times로 바뀐다 — 값마다 따로 시작·끝낼 수 있다.
 */
export function play(tracks: Readonly<Record<string, readonly Key[]>>): TargetAndTransition {
  const target: Record<string, (number | string)[]> = {}
  const transition: Record<string, Transition> = {}
  for (const [prop, keys] of Object.entries(tracks)) {
    const t0 = keys[0][0]
    const duration = Math.max(keys[keys.length - 1][0] - t0, 0.001)
    target[prop] = keys.map((k) => k[1])
    transition[prop] = {
      delay: t0,
      duration,
      times: keys.map((k) => (k[0] - t0) / duration),
      ease: keys.slice(1).map((k) => k[2] ?? 'easeInOut'),
    }
  }
  return { ...target, transition } as TargetAndTransition
}

const REST: Readonly<Record<string, number>> = {
  x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0,
  opacity: 1, pathLength: 1, pathOffset: 0,
}

/**
 * 재생 키프레임에서 쉬는 상태(normal)를 뽑는다 — 마지막 키 값(대부분 원래 자리로 돌아온다).
 * 회전처럼 한 바퀴 돌고 끝나는 값은 360이 남지만 보이는 모양은 같다.
 */
export function restOf(target: TargetAndTransition | undefined): TargetAndTransition {
  const rest: Record<string, number | string> = {}
  if (!target) return { transition: { duration: 0 } }
  for (const [prop, value] of Object.entries(target)) {
    if (prop === 'transition' || prop === 'transitionEnd') continue
    const last = Array.isArray(value) ? value[value.length - 1] : value
    rest[prop] = typeof last === 'number' || typeof last === 'string' ? last : (REST[prop] ?? 0)
  }
  return { ...rest, transition: { duration: 0 } } as TargetAndTransition
}

// ── 공용 시계 ────────────────────────────────────────────────────────────────
// 견본의 150개가 따로 타이머를 돌리면 조금씩 어긋난다. 타이머 하나가 박자를 치고
// 구독한 아이콘이 모두 같은 순간에 재생을 건다(영상 1~5줄 묶음의 주기 70프레임 = 2.333초).

export const LOOP_PERIOD = 70 / 30

const listeners = new Set<() => void>()
let interval: ReturnType<typeof setInterval> | undefined
let kickoff: ReturnType<typeof setTimeout> | undefined

const beat = () => listeners.forEach((listener) => listener())

/** 박자 구독 — 처음 구독이 생기면 곧바로 한 박을 치고(같은 커밋의 아이콘이 다 모인 뒤) 주기마다 친다. */
export function subscribeLoop(listener: () => void): () => void {
  listeners.add(listener)
  if (interval === undefined) {
    kickoff = setTimeout(beat, 0)
    interval = setInterval(beat, LOOP_PERIOD * 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    clearTimeout(kickoff)
    clearInterval(interval)
    interval = undefined
  }
}

/**
 * 영상에서 프레임마다 잰 값을 그대로 키로(선형 보간) — 손으로 곡선을 맞추기 어려운 움직임을 옮겨 적을 때.
 * start는 첫 값의 프레임 번호(줄 묶음 주기 시작 기준), 30fps.
 */
export function trace(start: number, values: readonly (number | string)[]): Key[] {
  return values.map((value, i) => [fr(start + i), value, 'linear'] as const)
}
