import type { Layout } from './geometry'

// 케이스 하나의 시간표 — 영상에서 잰 값: 빛 점이 들어오고 0.2초 뒤 첫 카드가
// 켜지고, 건너가는 시간은 길이에 비례하며(같은 줄 0.25초, 여섯 줄 아래 0.53초),
// 마지막 노드에서 1초쯤 머문 뒤 0.3초에 걸쳐 꺼진다.

export const CASE_LEN = 4.5
export const FADE_START = 3.9
export const FADE_END = 4.2
const ENTER_END = 0.3
/** 카드에 닿은 뒤 떠나기까지 — 첫 카드는 빛 점이 카드를 가로지르느라 조금 길다. */
const DWELL = 0.22
const FIRST_DWELL = 0.33
const CONF_LEN = 0.45

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

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 경로(층마다 노드 하나, 5개)의 시간표. */
export const buildTimeline = (path: string[], layout: Layout): CaseTimeline => {
  const steps = path.map((id, col) => ({ col, id }))
  const at = [ENTER_END]
  const hops: Hop[] = []
  for (let i = 1; i < steps.length; i++) {
    const dur =
      0.2 + layout.pathOf(steps[i - 1].id, steps[i].id).total * 0.00038
    const start = at[i - 1] + (i === 1 ? FIRST_DWELL : DWELL)
    hops.push({ from: i - 1, to: i, start, end: start + dur })
    at.push(start + dur)
  }
  // 신뢰도는 은닉층(인코더)에 닿으면 세기 시작해 게이트에서 판정된다.
  const confStart = at[2] + 0.05
  const confEnd = confStart + CONF_LEN
  return {
    steps,
    at,
    hops,
    confStart,
    confEnd,
    verdictAt: at[3] + 0.08,
    subtitleAt: [at[1] - 0.25, confEnd, at[3], at[4] + 0.25],
    rings: [
      { step: 2, at: at[2] },
      { step: 4, at: at[4] },
    ],
    assembleStart: at[4] + 0.15,
  }
}
