// Design 14 음성 모드 — sample/design14-circle.mp4 8.43~22.67초(F253~F680, 30fps)를 프레임마다 잰 값.
// 시간 0 = 음성 모드가 켜진 첫 프레임 F289(영상 9.633초). 그 앞 F253~F288(1.2초)은 음성 모드 전 SALES 부서
// 화면이 멈춰 있고(녹화가 잘린 자리), F289에는 이미 막대·말풍선 "K"·구슬이 다 떠 있다 — 켜지는 순간은 영상에 없다.
// 글자 수는 프레임마다 커서 오른쪽 끝(한 줄)과 줄별 글자 폭(여러 줄)으로 셌고, 소리 크기는 구슬 셋째 고리 반지름으로 쟀다.

export type VoiceSpeaker = 'you' | 'agent'
export type VoiceViewKind = 'founder' | 'department'
export type VoiceDepartment = 'sales'

export interface VoiceTurn {
  speaker: VoiceSpeaker
  /** 영상 글자 그대로 */
  text: string
  /** 턴 시작(초) — 말풍선이 비고 꼬리표·구슬이 한 프레임에 바뀐다 */
  start: number
  /** 시작에서 첫 글자까지(초) */
  delay: number
  /** 글자/초 — 턴 안에서 고르다(문장 부호에서 쉬지 않는다, 잔차 ±2글자) */
  cps: number
  /** 이 턴의 화면 — 카메라가 그쪽으로 간다 */
  view: VoiceViewKind
  department?: VoiceDepartment
  /** 구슬 소리 크기(0~1, 30fps) — 턴 시작 프레임부터 잰 값 */
  levels: readonly number[]
}

export interface VoiceScript {
  turns: readonly VoiceTurn[]
  /** 음성 모드 전 SALES 부서 화면(초) — 시간 -lead~0 */
  lead: number
  /** 끝(초) — F681에서 다른 장면으로 넘어간다 */
  end: number
  /** levels 표본 빠르기 */
  fps: number
}

// 소리 크기 L = (셋째 고리 반지름 − 46) / 10.7 — 고리 넷이 모두 L에 곧게 따라간다(voice-orb·_design14-voice.scss)
const LEVELS_YOU_1 = [
  0.34, 0.36, 0.36, 0.41, 0.45, 0.61, 0.71, 0.68, 0.47, 0.23, 0.34, 0.63, 0.79, 0.79, 0.58, 0.45, 0.36, 0.35, 0.35,
  0.32, 0.3, 0.11, 0.05, 0, 0, 0, 0.21, 0.42, 0.69, 0.95, 1, 0.85, 0.58, 0.22, 0.23, 0.33, 0.33, 0.32, 0.3, 0.3, 0.39,
  0.45, 0.43, 0.42, 0.37, 0.37, 0.47, 0.51, 0.49, 0.23, 0.23, 0.48, 0.79, 0.93, 0.89, 0.81, 0.47, 0.32,
]
const LEVELS_AGENT_1 = [
  0.56, 0.56, 0.21, 0.33, 0.49, 0.58, 0.58, 0.52, 0.42, 0.41, 0.41, 0.42, 0.42, 0.43, 0.41, 0.33, 0.27, 0.23, 0.23,
  0.23, 0.23, 0.1, 0.23, 0.4, 0.77, 0.96, 1, 0.98, 0.79, 0.52, 0.28, 0.11, 0.09, 0.09, 0.09, 0.09, 0.18, 0.23, 0.33,
  0.37, 0.37, 0.37, 0.41, 0.42, 0.5, 0.62, 0.72, 0.72, 0.63, 0.41, 0.23, 0.41, 0.63, 0.79, 0.81, 0.69, 0.56, 0.43, 0.39,
  0.34, 0.34, 0.34, 0.32, 0.23, 0.09, 0.04, 0.04, 0.04, 0.06, 0.11, 0.26, 0.48, 0.75, 0.96, 0.99, 0.89, 0.65, 0.33,
  0.24, 0.24, 0.33, 0.34, 0.33, 0.32, 0.33, 0.36, 0.42, 0.45, 0.45, 0.43, 0.41, 0.37, 0.39, 0.43, 0.44, 0.45, 0.34,
  0.19, 0.28, 0.52, 0.79, 0.94, 0.97, 0.83, 0.65, 0.39, 0.22, 0.14, 0.14, 0.13, 0.08, 0.05, 0.11, 0.15, 0.21, 0.23,
  0.25, 0.28, 0.35, 0.51, 0.67, 0.79, 0.89, 0.85, 0.65, 0.34, 0.25, 0.46, 0.59, 0.63, 0.57, 0.5, 0.44, 0.4, 0.42, 0.43,
  0.43, 0.4, 0.36, 0.24, 0.22, 0.21, 0.21, 0.21, 0.12, 0.19, 0.41, 0.61, 0.88, 1.02, 1.02, 0.87, 0.61, 0.33, 0.12, 0.12,
  0.13, 0.14, 0.14, 0.15, 0.22, 0.32, 0.36, 0.4, 0.4, 0.4, 0.4, 0.47, 0.56, 0.64, 0.69, 0.64, 0.45, 0.23, 0.39, 0.64,
  0.79, 0.82, 0.75, 0.65, 0.51, 0.39, 0.36, 0.33, 0.31, 0.28, 0.19, 0.1, 0.09, 0.09, 0.09, 0.09, 0.11, 0.21, 0.33, 0.59,
  0.79, 0.98, 0.98, 0.79, 0.51, 0.22, 0.23, 0.33, 0.37, 0.37, 0.34, 0.33, 0.34, 0.37, 0.42, 0.47, 0.46, 0.43, 0.37,
  0.35, 0.39, 0.43, 0.43, 0.35, 0.18, 0.24, 0.51, 0.78, 0.87, 0.98, 0.89, 0.7, 0.5, 0.32, 0.16, 0.13, 0.1, 0.07, 0.09,
  0.09, 0.17, 0.23, 0.26, 0.28, 0.31, 0.33, 0.42, 0.62, 0.79, 0.87, 0.84, 0.65, 0.51, 0.26, 0.36, 0.53, 0.64, 0.64,
  0.54, 0.47, 0.41, 0.41, 0.42, 0.43, 0.4, 0.33, 0.3, 0.22, 0.19, 0.15, 0.15, 0.15, 0.07, 0.24, 0.51, 0.79, 0.98, 1.04,
  0.98, 0.79, 0.5, 0.22, 0.14, 0.14, 0.14, 0.14, 0.18, 0.21, 0.29, 0.34, 0.38, 0.43, 0.43,
]
const LEVELS_YOU_2 = [
  0.43, 0.79, 0.27, 0.44, 0.62, 0.62, 0.44, 0.39, 0.37, 0.26, 0.15, 0.13, 0.09, 0.25, 0.82, 1.03, 0.43,
]
const LEVELS_AGENT_2 = [
  0.51, 0.57, 0.48, 0.25, 0.36, 0.73, 0.87, 0.7, 0.36, 0.26, 0.26, 0.16, 0.05, 0.09, 0.12, 0.14, 0.25, 0.55, 0.97, 0.89,
  0.7, 0.25, 0.44, 0.46, 0.37, 0.37, 0.38,
]

/**
 * 영상의 대화 네 턴. 턴이 바뀌면 그 프레임에 말풍선이 비고(커서만) 꼬리표·구슬 색이 바뀐다.
 * 화면은 턴마다 정해져 있다 — 사용자 → YOU(창업자), Kronos 첫 답 → SALES, 사용자 → YOU, Kronos 둘째 답 → YOU 그대로.
 */
export const VOICE_SCRIPT: VoiceScript = {
  lead: 1.2, // F253~F288
  end: 13.067, // F681
  fps: 30,
  turns: [
    // F289 'K' ~ F338 완성(38글자/49프레임), F347까지 0.28초 머문다
    {
      speaker: 'you',
      text: 'Kronos, where are we at with our deals?',
      start: 0,
      delay: 0,
      cps: 23.1,
      view: 'founder',
      levels: LEVELS_YOU_1,
    },
    // F347 'O' ~ F629.5 완성(186글자/282.5프레임), F636까지 0.21초
    {
      speaker: 'agent',
      text: "One deal closed this morning at full rate. I ran our biggest open proposal through Hormozi's pricing framework. It was five K light, so I repriced it and drafted the email. Can I send it?",
      start: 1.933,
      delay: 0,
      cps: 19.75,
      view: 'department',
      department: 'sales',
      levels: LEVELS_AGENT_1,
    },
    // F636 빈 말풍선, F637 'S' ~ F650 완성
    {
      speaker: 'you',
      text: 'Send it.',
      start: 11.567,
      delay: 0.04,
      cps: 16.5,
      view: 'founder',
      levels: LEVELS_YOU_2,
    },
    // F653 빈 말풍선, F654 'D' ~ F673.5 완성 — 화면은 YOU에 머문다
    {
      speaker: 'agent',
      text: 'Done, sir.',
      start: 12.133,
      delay: 0.035,
      cps: 13.85,
      view: 'founder',
      levels: LEVELS_AGENT_2,
    },
  ],
}

/** t초에 보이는 글자 수(턴 안) */
export function typedAt(turn: VoiceTurn, t: number): number {
  const s = t - turn.start - turn.delay
  if (s < 0) return 0
  return Math.min(turn.text.length, 1 + Math.floor(s * turn.cps + 1e-6))
}

/** 다음 글자가 나타나는 시각(초) — 다 나왔으면 Infinity */
export function nextCharAt(turn: VoiceTurn, typed: number): number {
  if (typed >= turn.text.length) return Infinity
  return turn.start + turn.delay + typed / turn.cps
}

/** t초의 턴 차례(-1 = 첫 턴 전) */
export function turnIndexAt(script: VoiceScript, t: number): number {
  let i = -1
  script.turns.forEach((turn, k) => {
    if (t >= turn.start) i = k
  })
  return i
}

/** 대본을 재생할 때 t초의 소리 크기 — 잰 값을 선형으로 잇는다 */
export function scriptLevelAt(script: VoiceScript, t: number): number {
  const i = turnIndexAt(script, t)
  if (i < 0) return 0
  const { levels, start } = script.turns[i]
  const f = Math.max(0, (t - start) * script.fps)
  const k = Math.floor(f)
  if (k >= levels.length - 1) return levels[levels.length - 1]
  return levels[k] + (levels[k + 1] - levels[k]) * (f - k)
}

// ── 구슬이 스스로 움직일 때(대본 없이) ───────────────────────────────────────────
// Kronos 첫 턴의 소리 크기는 사인 여섯 개의 합으로 거의 그대로 맞는다(잔차 0.042, 신호 표준편차 0.247) —
// 바탕 1.215Hz·1.945Hz와 그 합·차·배음. 실제 음성이 아니라 만든 출렁임이다. 사용자 턴은 마이크 소리처럼
// 퍼져 있어 같은 짜임(바탕 둘 + 합)에 1.43Hz·2.30Hz로 맞췄다(잔차 0.11, 80%).

/** [Hz, 크기, 위상(라디안)] — 턴 시작이 t=0 */
type Partial = readonly [number, number, number]

export interface VoiceLevelModel {
  base: number
  partials: readonly Partial[]
}

export const VOICE_LEVEL_MODELS: Record<VoiceSpeaker, VoiceLevelModel> = {
  agent: {
    base: 0.422,
    partials: [
      [1.215, 0.213, 1.281],
      [1.945, 0.187, 3.382],
      [3.16, 0.134, 3.142],
      [2.43, 0.082, 0.959],
      [4.375, 0.094, 2.894],
      [0.73, 0.067, 0.471],
    ],
  },
  you: {
    base: 0.422,
    partials: [
      [1.43, 0.219, -1.452],
      [2.3, 0.186, 0.083],
      [3.73, 0.132, -2.464],
    ],
  },
}

/** 말하는 사람 없이 기다릴 때 — 영상에는 없는 상태라 고른 값: 작게 4초에 한 번 숨 쉰다 */
export const VOICE_IDLE_LEVEL = { base: 0.1, amp: 0.06, hz: 0.25 }

/** 움직임 줄이기 — 영상 소리 크기의 평균(0.42) 근처에 멈춘다 */
export const VOICE_CALM_LEVEL = 0.4

export function modelLevelAt(model: VoiceLevelModel, t: number): number {
  let v = model.base
  for (const [hz, amp, phase] of model.partials) v += amp * Math.sin(2 * Math.PI * hz * t + phase)
  return Math.min(1.05, Math.max(0, v))
}

// ── 말풍선 꼬리표 ───────────────────────────────────────────────────────────
export interface SpeechTag {
  label: string
  /** you = 회색 알약, agent = 주황 알약, plain = 알약 없는 회색 글씨 */
  tone: 'you' | 'agent' | 'plain'
}

/** 영상 꼬리표 — 사용자: YOU, Kronos: KRONOS + VOICE CLONE */
export const SPEECH_TAGS: Record<VoiceSpeaker, readonly SpeechTag[]> = {
  you: [{ label: 'YOU', tone: 'you' }],
  agent: [
    { label: 'KRONOS', tone: 'agent' },
    { label: 'VOICE CLONE', tone: 'plain' },
  ],
}

// ── 맨 위 알약 막대 ─────────────────────────────────────────────────────────
export const VOICE_BAR_TABS = [
  { key: 'deals', label: 'DEALS' },
  { key: '6am', label: '6AM BRIEF' },
] as const

// ── 창업자(YOU) 별자리 ─────────────────────────────────────────────────────────
// 자리는 YOU 원 가운데(F660: 362, 458)에서 잰 em(1em = 영상 10px). 좌우 짝은 x 360.7을 축으로 맞서 있어
// (YOU 원보다 1.3px 왼쪽 — 화면 가운데) 짝끼리 평균을 냈다. 점 반지름도 잰 값(바깥 넷 0.55em, 안쪽 넷 0.45em).

export type FounderTone = 'waiting' | 'idle'

export interface FounderTopic {
  label: string
  /** 이름 아래 작은 줄(금색) */
  status?: string
  /** waiting = 주황 점 + 금색 ▲(위아래로 흔들림), idle = 흰 점 */
  tone?: FounderTone
  /** 점 둘레 붉은 고리가 숨 쉰다(QUOTE FOLLOW-UP) */
  urgent?: boolean
  /** YOU 가운데에서 점 가운데까지(em) */
  x: number
  y: number
  /** 점 반지름(em) — 없으면 0.45 */
  r?: number
}

export const FOUNDER_TOPICS: readonly FounderTopic[] = [
  // 위쪽부터 시계 방향. 겹쳐 그릴 때 앞의 것이 위로 온다(QUOTE의 이름 칸이 둘째를 가린다)
  { label: 'QUOTE FOLLOW-UP', status: 'waiting on you', tone: 'waiting', urgent: true, x: 0, y: -5.3, r: 0.45 },
  // 영상에선 QUOTE FOLLOW-UP 칸에 가려 "…TURE HABIT"만 보인다(줄은 318°로 나 있다) — 앞부분은 가려진 폭(5.2em)에
  // 맞춰 고른 추정값
  { label: 'IDEA CAPTURE HABIT', x: 6.44, y: -5.93, r: 0.56 },
  { label: 'OVERDUE ESCALATION', x: 9, y: -1.27, r: 0.56 },
  { label: 'SCOPE CHANGE HANDLING', x: 6.83, y: 3.47, r: 0.46 },
  // 영상도 이 글자에서 끊겨 있다
  { label: 'QUARTERLY DIRECTION RES…', x: 2.37, y: 6.13, r: 0.44 },
  { label: 'HIRING CALLS', x: -2.37, y: 6.13, r: 0.44 },
  { label: 'WHICH CLIENTS WE TAKE', x: -6.83, y: 3.47, r: 0.45 },
  { label: 'INVOICE CHASING', status: 'waiting on you', tone: 'waiting', x: -9, y: -1.27, r: 0.55 },
  { label: 'CONTENT REPURPOSING', status: 'waiting on you', tone: 'waiting', x: -6.44, y: -5.93, r: 0.56 },
]

export const FOUNDER_CENTER = { node: 'YOU', title: 'YOU', subtitle: 'the founder · sign-off' } as const
