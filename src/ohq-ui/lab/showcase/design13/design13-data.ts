// 영상 속 글과 숫자. 화면 글(영문)은 영상 그대로 — 영상에서 다시 읽어 고친 것: doom "WASM frame", trader "Monad 250ms".

export interface OrbitAgent {
  id: string
  name: string
  /** 이름 아래 작은 글 */
  sub: string
  /** 바깥에 따라붙는 분홍 네모 이름표(영상은 다섯 카드만 달고 있다) */
  tag?: string
}

/** 궤도 위 차례 — F0에 doom이 맨 위(-90°)에 있고 36°씩 시계 방향으로 놓인다 */
export const D13_AGENTS: readonly OrbitAgent[] = [
  { id: 'doom', name: 'doom', sub: 'WASM frame', tag: 'SCO' },
  { id: 't-rex', name: 't-rex', sub: 'jump / duck / run' },
  { id: 'chess', name: 'chess', sub: 'vs search', tag: 'SCO' },
  { id: 'drone', name: 'drone', sub: 'camera 3 Hz' },
  { id: 'tax', name: 'tax', sub: '318 forms · ¢', tag: 'SCO' },
  { id: 'killmyidea', name: 'killmyidea', sub: 'kill / fix / ship' },
  { id: 'curate', name: 'curate', sub: '1,480 rows/s', tag: 'NOU' },
  { id: 'pg-jev', name: 'pg-jev', sub: 'ask the table' },
  { id: 'trader', name: 'trader', sub: 'Monad 250ms', tag: 'CHO' },
  { id: 'ultrafast', name: 'ultrafast', sub: 'picks the click' },
]

/** 사건 한 번 — 가운데에서 그 카드로 선이 뻗고, 테이프가 글을 치고, 카드 위에 초록 판정표가 뜬다 */
export interface OrbitEvent {
  agent: string
  /** 초록 판정표 "p 0.83 keep" */
  p: number
  word: string
  /** TAPE 글(이름 뒤 두 칸 띄고) */
  tape: string
}

/** 열 번이 한 바퀴(영상 F1~F224에 두 바퀴 반) — 차례도 글도 늘 같다 */
export const D13_EVENTS: readonly OrbitEvent[] = [
  { agent: 'drone', p: 0.83, word: 'keep', tape: 'five stations · judged 3× / sec' },
  { agent: 'pg-jev', p: 0.21, word: 'drop', tape: 'asks the table, not the model' },
  { agent: 't-rex', p: 0.94, word: 'ship', tape: 'jump / duck · judged every frame' },
  { agent: 'ultrafast', p: 0.66, word: 'hold', tape: '21,406 clicks · none typed' },
  { agent: 'tax', p: 0.12, word: 'drop', tape: '318 forms · $0.0008 per page' },
  { agent: 'doom', p: 0.78, word: 'fire', tape: 'frame locked · 60 fps budget' },
  { agent: 'curate', p: 0.58, word: 'keep', tape: '1,480 typed rows / sec' },
  { agent: 'chess', p: 0.91, word: 'jump', tape: 'instinct vs search · search wins' },
  { agent: 'trader', p: 0.35, word: 'fix', tape: 'fires the limit every 250 ms' },
  { agent: 'killmyidea', p: 0.72, word: 'clear', tape: 'kill / fix / ship' },
]

export type VerdictKind = 'choice' | 'score' | 'noul'

export interface Verdict {
  kind: VerdictKind
  text: string
}

/** 사건마다 맨 위에 한 줄 — 열두 줄이 한 바퀴(F1 첫 줄 = 0번). F0 목록은 그 앞 네 줄(11·10·9·8번) */
export const D13_VERDICTS: readonly Verdict[] = [
  { kind: 'choice', text: 't-rex jumps this frame' },
  { kind: 'score', text: 'tax page accepted · $0.0008' },
  { kind: 'noul', text: 'curate row clears the bar' },
  { kind: 'choice', text: 'trader fires the limit' },
  { kind: 'score', text: 'chess instinct overruled' },
  { kind: 'noul', text: 'pg-jev answers the table' },
  { kind: 'choice', text: 'idea scored · ship' },
  { kind: 'score', text: 'drone gate clear' },
  { kind: 'noul', text: 'doom frame locked' },
  { kind: 'choice', text: 'ultrafast keeps the click' },
  { kind: 'score', text: 'killmyidea: fix, not kill' },
  { kind: 'noul', text: 'drone holds 3 Hz' },
]

/** 숫자 칸 값 — 오르기(easeOutCubic), 오른 뒤 출렁임, 고정 */
export type StatValue =
  | { kind: 'count'; from: number; to: number; duration: number; suffix?: string }
  | {
      kind: 'rise'
      from: number
      to: number
      duration: number
      wave: number
      period: number
      phase: number
      suffix?: string
    }
  | { kind: 'static'; text: string }

export type StatTone = 'pink' | 'violet' | 'salmon' | 'lavender' | 'blush' | 'rose'

export interface StatSpec {
  label: string
  sub: string
  tone: StatTone
  value: StatValue
  /** 이 카드의 손님 — 그 카드로 선이 닿는 순간 칸이 분홍으로 번쩍인다 */
  agent?: string
  /** 꼬마 선: 마디(진폭 0) 자리(영상 px, 선 왼쪽부터) · 없으면 평평한 선 */
  sparkNode?: number
  sparkPhase?: number
}

// 오르는 시간 — TRADER·ULTRAFAST는 같은 곡선(F0.6~F190.6, easeOutCubic): 1,210 → 2,384, 9,800 → 21,406.
// CURATE는 F0.6~F28.6에 240 → 1,480으로 빨리 오른 뒤 ±37을 0.375초마다 출렁인다(F100~F135 36장 읽어 맞춤, 오차 1.2).
export const D13_STATS: readonly StatSpec[] = [
  {
    label: 'TRADER',
    sub: 'order / 250ms',
    tone: 'pink',
    value: { kind: 'count', from: 1210, to: 2384, duration: 6.333, suffix: '★' },
    agent: 'trader',
    sparkNode: 13,
    sparkPhase: 0.4,
  },
  {
    label: 'ULTRAFAST',
    sub: 'click · no type',
    tone: 'violet',
    value: { kind: 'count', from: 9800, to: 21406, duration: 6.333, suffix: '★' },
    agent: 'ultrafast',
    sparkNode: 5,
    sparkPhase: 2.1,
  },
  {
    label: 'TAX',
    sub: '318 forms · 100%',
    tone: 'salmon',
    value: { kind: 'static', text: '$0.0008' },
    agent: 'tax',
    sparkNode: 22,
    sparkPhase: 4.4,
  },
  {
    label: 'CURATE',
    sub: 'typed rows only',
    tone: 'lavender',
    value: {
      kind: 'rise',
      from: 240,
      to: 1480,
      duration: 0.933,
      wave: 37,
      period: 0.3752,
      phase: -1.948,
      suffix: '/s',
    },
    agent: 'curate',
    sparkNode: 14,
    sparkPhase: 1.3,
  },
  {
    label: 'DRONE',
    sub: 'camera gate',
    tone: 'blush',
    value: { kind: 'static', text: '3 Hz' },
    agent: 'drone',
    sparkNode: 7,
    sparkPhase: 5.2,
  },
  { label: 'PROSE', sub: 'words generated', tone: 'rose', value: { kind: 'static', text: '0' } },
]

/** "WHERE THE NUMBER LANDS" 막대 — 가운데 값 ± 출렁임(0.833초 주기, 셋 다 같은 주기·다른 위상) */
export interface LandsBarSpec {
  label: string
  value: number
  wobble: number
  /** 출렁임 위상(라디안, t=0 기준) */
  phase: number
  /** 차오르기 시작(초) — 위에서부터 F2.9·F4.85·F6.7 */
  delay: number
  tone: 'click' | 'jump' | 'kill' | 'keep'
}

export const D13_LANDS: readonly LandsBarSpec[] = [
  { label: 'click / no-click', value: 0.9074, wobble: 0.0327, phase: -1.601, delay: 0.097, tone: 'click' },
  { label: 'jump / duck / run', value: 0.6362, wobble: 0.0218, phase: -0.291, delay: 0.162, tone: 'jump' },
  { label: 'kill / fix / ship', value: 0.7766, wobble: 0.0269, phase: 1.074, delay: 0.223, tone: 'kill' },
]

/** LIVE VERDICTS 오른쪽 위 "180 judged" — 180 → 3,412(F0.6부터 7.27초, easeOutCubic: F40·60·120·140 읽은 값에 맞춤) */
export const D13_JUDGED = { from: 180, to: 3412, duration: 7.27 } as const

/** 부품 견본용 — 다른 값으로 바꿔 끼운 예 */
export const D13_PART_AGENTS: readonly OrbitAgent[] = [
  { id: 'scout', name: 'scout', sub: 'maps the room', tag: 'SCO' },
  { id: 'judge', name: 'judge', sub: 'keeps the score' },
  { id: 'relay', name: 'relay', sub: '42 hops / s', tag: 'CHO' },
  { id: 'mint', name: 'mint', sub: 'prints the badge' },
  { id: 'tide', name: 'tide', sub: 'low / high / slack', tag: 'NOU' },
  { id: 'lens', name: 'lens', sub: 'reads the frame' },
]

export const D13_PART_EVENTS: readonly OrbitEvent[] = [
  { agent: 'relay', p: 0.64, word: 'pass', tape: 'hands it on' },
  { agent: 'lens', p: 0.88, word: 'keep', tape: 'frame read' },
  { agent: 'judge', p: 0.31, word: 'drop', tape: 'score kept' },
  { agent: 'tide', p: 0.52, word: 'hold', tape: 'slack water' },
  { agent: 'scout', p: 0.97, word: 'ship', tape: 'room mapped' },
  { agent: 'mint', p: 0.45, word: 'fix', tape: 'badge printed' },
]

export const D13_PART_TAPE: readonly OrbitEvent[] = [
  { agent: 'relay', p: 0.64, word: 'pass', tape: '42 hops · none dropped' },
  { agent: 'lens', p: 0.88, word: 'keep', tape: 'frame read · 12 ms' },
  { agent: 'judge', p: 0.31, word: 'drop', tape: 'score kept · 3 votes' },
]

export const D13_PART_VERDICTS: readonly Verdict[] = [
  { kind: 'noul', text: 'tide holds the slack' },
  { kind: 'choice', text: 'relay passes it on' },
  { kind: 'score', text: 'judge keeps the score' },
  { kind: 'choice', text: 'scout ships the map' },
]

export const D13_PART_LANDS: readonly LandsBarSpec[] = [
  { label: 'keep / drop', value: 0.58, wobble: 0.03, phase: 0.6, delay: 0.1, tone: 'keep' },
  { label: 'pass / hold', value: 0.42, wobble: 0.025, phase: 2.2, delay: 0.17, tone: 'jump' },
]
