// Design 14(sample/design14-circle.mp4) "회사 두뇌" 지도 — 부서·자리·카메라의 데이터와 잰 값.
// 좌표 단위 w = 영상 전체 화면 구간(5.2~8.4초, 720×1280)의 부서 초점 화면 px. CSS에서는 1em = 10w.
// 3D 좌표: 지식 코어가 원점, y 위가 +, 방위각은 정면(+z, 카메라 쪽)에서 오른쪽(+x)으로 잰다.
// 주석의 t는 영상 초, F는 30fps 프레임. 영상 편집기가 확대·이동을 덧씌운 구간이 많아서(별 배경까지 같이
// 커진다), 위치는 별이 멈춰 있는 구간(t=30.2~31.9)과 둥근 테두리 반지름으로 맞춘 비율로 쟀다.

export type SeatStatus = 'working' | 'runs-itself' | 'waiting' | 'not-running' | 'in-head'

/** 상태 글 — 영상 그대로 */
export const STATUS_TEXT: Record<SeatStatus, string> = {
  working: 'working',
  'runs-itself': 'runs itself',
  waiting: 'waiting on you',
  'not-running': 'not running yet',
  'in-head': 'still in your head',
}

/** 아래 안내 줄 범례 순서 — 영상은 "… still in your head · ← → walk …"로 끝 쪽만 보인다 */
export const STATUS_ORDER: readonly SeatStatus[] = ['working', 'runs-itself', 'waiting', 'not-running', 'in-head']

export interface SeatData {
  name: string
  status: SeatStatus
  /** working 자리의 호 길이(0~1) — 영상에서 자리마다 다르고 움직이지 않는다(t=12.4~20.4 Proposal Writer 그대로) */
  progress?: number
  /** 초점 화면에서 부서 가운데로부터 자리 가운데(w, 화면 x 오른쪽·y 아래) */
  at: readonly [number, number]
}

export type DepartmentId = 'admin' | 'operations' | 'marketing' | 'strategy' | 'sales' | 'finance'

export interface DepartmentData {
  id: DepartmentId
  name: string
  sub: string
  /** 처음 자세(t=0 = t=47.8 같은 자세)의 방위각(도) */
  az: number
  /** 회전축에서 떨어진 거리(w) */
  rho: number
  /** 높이(w, 위 +) */
  h: number
  head: { name: string; at: readonly [number, number] }
  /** 영상 목록 순서 — 왼쪽 위·오른쪽 위·왼쪽·오른쪽…으로 번갈아 놓인다 */
  seats: readonly SeatData[]
}

// ── 초점 화면의 자리 배치(w) ─────────────────────────────────────────────────
// 자리 수마다 모양이 다르다. 머리는 늘 위, 나머지는 좌우 대칭.
// 다섯 자리 — ADMIN F190·MARKETING F218·FINANCE F252: 머리 (0,−75), 위 (±123,−33.5), 아래 (±86,93.5)
const FIVE = { head: [0, -75], ul: [-123, -33.5], ur: [123, -33.5], ll: [-86, 93.5], lr: [86, 93.5] } as const
// 여섯 자리 — OPERATIONS F204: 머리 (0,−82), 위 (±123,−57), 가운데 (±107.5,53), 맨 아래 (0,100)
// 일곱 자리 — SALES F248: 머리 (0,−82), 위 (±112.4,−71.5), 가운데 (±125.8,24.5), 아래 (−53,77)·(59,79)

export const DEPARTMENTS: readonly DepartmentData[] = [
  {
    id: 'admin',
    name: 'ADMIN',
    sub: 'recurring & routine',
    az: -48.8,
    rho: 315,
    h: 124,
    head: { name: 'Head of Admin', at: FIVE.head },
    seats: [
      { name: 'Inbox Manager', status: 'working', progress: 0.62, at: FIVE.ul },
      { name: 'Subscriptions Auditor', status: 'in-head', at: FIVE.ur },
      { name: 'Diary Keeper', status: 'runs-itself', at: FIVE.ll },
      { name: 'Weekly Reset', status: 'not-running', at: FIVE.lr },
    ],
  },
  {
    id: 'operations',
    name: 'OPERATIONS',
    sub: 'delivery & projects',
    az: 3,
    rho: 315,
    h: -130,
    head: { name: 'Head of Operations', at: [0, -82] },
    seats: [
      { name: 'Onboarding Lead', status: 'working', progress: 0.42, at: [-123, -57] },
      { name: 'Scope Keeper', status: 'in-head', at: [123, -57] },
      { name: 'Kickoff Coordinator', status: 'runs-itself', at: [-107.5, 53] },
      { name: 'QA Checker', status: 'not-running', at: [107.5, 53] },
      { name: 'Client Reporter', status: 'working', progress: 0.78, at: [0, 100] },
    ],
  },
  {
    id: 'marketing',
    name: 'MARKETING',
    sub: 'content & distribution',
    az: 52.6,
    rho: 315,
    h: 136,
    head: { name: 'Head of Marketing', at: FIVE.head },
    seats: [
      { name: 'Scriptwriter', status: 'working', progress: 0.35, at: FIVE.ul },
      { name: 'Community Manager', status: 'in-head', at: FIVE.ur },
      { name: 'Repurposer', status: 'waiting', at: FIVE.ll },
      { name: 'Publisher', status: 'runs-itself', at: FIVE.lr },
    ],
  },
  {
    id: 'strategy',
    name: 'STRATEGY',
    sub: 'decisions & judgment',
    az: 94.7,
    rho: 345,
    h: 106,
    head: { name: 'Chief of Staff', at: [0, -77.6] },
    seats: [
      { name: 'Pricing Analyst', status: 'working', progress: 0.35, at: [-127.3, -34.5] },
      { name: 'Planning Lead', status: 'in-head', at: [127.3, -34.5] },
      { name: 'Lead Screener', status: 'in-head', at: FIVE.ll },
      { name: 'Hiring Coordinator', status: 'in-head', at: FIVE.lr },
    ],
  },
  {
    id: 'sales',
    name: 'SALES',
    sub: 'conversations & deals',
    az: 150,
    rho: 315,
    h: -136,
    head: { name: 'Head of Sales', at: [0, -82] },
    seats: [
      { name: 'Lead Responder', status: 'working', progress: 1, at: [-112.4, -71.5] },
      { name: 'Pipeline Keeper', status: 'runs-itself', at: [112.4, -71.5] },
      { name: 'Call Researcher', status: 'not-running', at: [-125.8, 24.5] },
      { name: 'Proposal Writer', status: 'working', progress: 0.7, at: [125.8, 24.5] },
      { name: 'Deal Chaser', status: 'waiting', at: [-53, 77] },
      { name: 'Outbound Warmer', status: 'in-head', at: [59, 79] },
    ],
  },
  {
    id: 'finance',
    name: 'FINANCE',
    sub: 'cash & risk',
    az: -148,
    rho: 315,
    h: 140,
    head: { name: 'Head of Finance', at: FIVE.head },
    seats: [
      { name: 'Collections', status: 'waiting', at: FIVE.ul },
      { name: 'Risk Watch', status: 'in-head', at: FIVE.ur },
      { name: 'Escalations', status: 'not-running', at: FIVE.ll },
      { name: 'Cash Analyst', status: 'working', progress: 0.55, at: FIVE.lr },
    ],
  },
]

/**
 * 창업자 — t=47.8: 둥근 테두리 왼쪽 아래 안쪽 끝(−0.82R, +0.5R). FINANCE와 ADMIN 사이, 구 밖으로 조금 나와 있다.
 * 음성 모드 SALES 화면에서 YOU는 SALES 오른쪽 25.5~30.6em(t=11.57 카메라가 옮겨 간 거리), 전체 화면 SALES 초점
 * F248에서 +325w — 셋을 함께 맞춘 자리(전체 보기 −0.77R · SALES 초점 +345w · 음성 화면 +26em).
 */
export const YOU = {
  name: 'YOU',
  sub: 'the founder · sign-off',
  az: -120,
  rho: 345,
  h: -178, // t=47.8 −189, 음성 YOU 화면(F330 YOU 원 가운데가 테두리 가운데 아래 13.45em) −174
} as const

/** 창업자 주제 점(t=0 c_you·t=10 음성 화면 배치, w) — 이름은 음성 모드 부품이 붙인다. waiting 셋 = 배지 3 */
export const YOU_TOPICS: readonly { at: readonly [number, number]; waiting?: boolean }[] = [
  { at: [-70, -46], waiting: true },
  { at: [6, -50], waiting: true },
  { at: [62, -36] },
  { at: [-74, -8], waiting: true },
  { at: [74, -6] },
  { at: [-60, 32] },
  { at: [56, 32] },
  { at: [-24, 54] },
  { at: [14, 56] },
]

/** 지식 코어 — "the company wiki"(t=2.0 F61). 위아래로 노란 작은 점이 붙어 있다 */
export const CORE = { name: 'KNOWLEDGE CORE', sub: 'the company wiki', label: 'CORE' } as const
export const CORE_SATELLITES: readonly (readonly [number, number])[] = [
  [0, -40],
  [-30, 6],
  [44, 12],
  [-2, 46],
]

/** 걷는 순서(← →) — 방위각 순서. t=5.2~8.4: YOU → ADMIN → OPERATIONS → MARKETING → STRATEGY → SALES → FINANCE */
export type BrainStop = 'you' | DepartmentId
export const WALK_ORDER: readonly BrainStop[] = [
  'you',
  'admin',
  'operations',
  'marketing',
  'strategy',
  'sales',
  'finance',
]

export const departmentById = (id: DepartmentId) => DEPARTMENTS.find((d) => d.id === id) as DepartmentData

/** 기다리는 자리 수 — YOU 배지(영상 "3") */
export const WAITING_COUNT = DEPARTMENTS.reduce((n, d) => n + d.seats.filter((s) => s.status === 'waiting').length, 0)

// ── 카메라·움직임(잰 값) ─────────────────────────────────────────────────────
/** 둥근 테두리 반지름(w) — 초점 화면 F232: 위 256, 아래 1030 → 387, 좌우 10~704 → 347, 평균 */
export const SPHERE_R = 370
/** 카메라 거리 = 9 × 315 — 뒤쪽 부서 고리가 앞쪽의 0.78배(t=47.8), 초점 부서 높이 1.125배 */
export const CAMERA_D = 2835
/**
 * 확대 — 초점이 1(영상 전체 화면 구간의 크기), 전체 보기는 0.76.
 * 앱 자체는 거의 확대하지 않고(라벨·테두리 비율이 같다) 영상 편집기가 확대해 보여 준다. 영상에서 보이는 대로
 * 맞추려고 카메라 확대로 옮겼다: t=0 테두리 283px ÷ 초점 370px.
 */
export const ZOOM_OVERVIEW = 0.76
export const ZOOM_FOCUS = 1
/** 화면 가운데(테두리 가운데)에서 코어까지의 세로(R 배수) — 전체 −0.026(t=47.8), 초점 +0.073(F232) */
export const LOOK_OVERVIEW = -0.026
export const LOOK_FOCUS = 0.073
/**
 * 음성 모드 화면 — 확대는 전체 보기와 같고(F330·F480 테두리 반지름 282px = 28.2em), 코어가 테두리 가운데보다
 * 0.05R 위(F480 SALES 허브가 가운데 아래 10.15em = 0.36R). 그래서 음성 부품(1em = 그 화면 10px)을 장면 em 그대로 쓴다
 */
export const LOOK_VOICE = -0.05
/**
 * 카메라 따라가기 — 지수 감쇠, 방위각만 돈다(위아래·확대는 그 화면 그대로).
 * 음성 모드 YOU → SALES(t=11.567~12.3, 말소리와 글자가 맞물려 실제 빠르기인 구간): 남은 거리가 프레임마다 ×0.843
 * → 시간 상수 0.195초. 걷기 구간(t=30.43~31.9)은 ×0.866(0.232초)으로 조금 느린데, 그 구간은 해설을 덮은 화면이라
 * 편집기가 늦췄을 수 있어 실제 빠르기 쪽 하나로 맞췄다.
 */
export const CAMERA_TAU = 0.195
/** 전체 보기 저절로 돌기(rad/s) — t=47.8~53.1에 OPERATIONS가 정면 3° → 17°(앞쪽이 오른쪽으로 간다) */
export const IDLE_SPIN = 0.05
/**
 * 초점이 바뀔 때 부서 채움·자리 글이 바뀌는 시간(ms) — 그 프레임에 바로 바뀐다(t=11.533 → 11.567: YOU 무리가
 * 사라지고 SALES가 채워진 채 나타난다). 걷기 구간 t=30.40의 반쯤 바뀐 프레임은 편집기가 두 프레임을 섞은 것
 */
export const SWAP_MS = 0
/** 숫자 줄(SIGNALS/MIN·IN FLIGHT) 바뀌는 간격(ms) — 5.5프레임마다 바뀌는 구간이 3.2배 빨리 돈 것 */
export const STATS_MS = 600
/** 신호 — 분당 약 2,000개, 날아가는 중 약 50개(t=5.3 2,002/48 · t=6.6 1,869/47 · t=7.2 2,317/55) */
export const SIGNALS_PER_MIN = 2000
/** 신호 빠르기(w/s) — 코어 ↔ 부서 줄의 긴 꼬리(약 70w)가 프레임마다 9w(t=51.1) */
export const SIGNAL_SPEED = 270
/** 기다리는 자리 바깥 고리 숨쉬기(초) — t=13.2·14.9·16.7에 가장 크다 */
export const WAIT_PULSE_S = 1.75

// ── 음성 모드 화면 자리(em, 장면 가운데 = 둥근 테두리 가운데 기준) ─────────────────────
// 영상 F289~F680 화면(720×637): 테두리 가운데 (36.1, 32.35)em. 막대·구슬·말풍선은 화면에 붙어 있다(카메라가
// 옮겨 가도 1px 안쪽). 막대는 화면 위 끝에 붙여 쓴다(그 화면에서 위 줄 자리).
/** 구슬 가운데 — (35.93, 31.62)em → 가운데에서 (−0.17, −0.73)em */
export const VOICE_ORB_AT: readonly [number, number] = [-0.17, -0.73]
/** 말풍선 아래 끝 — y 23.35em → 가운데에서 −9.0em, 가로 가운데 35.95em → −0.15em */
export const VOICE_BUBBLE_AT: readonly [number, number] = [-0.15, -9]
/** 막대 가운데 — 화면 위에서 2.725em */
export const VOICE_BAR_TOP = 2.725
/** 대본이 끝나고 마지막 장면을 두는 시간(ms) — 영상은 F681에서 다른 장면으로 잘린다. 지난 뒤 지도로 돌아온다 */
export const VOICE_EXIT_MS = 2200

/** 자동 둘러보기 — 영상 t=28.9·30.4·32.2에 차례로 눌렀다(1.5~1.8초 간격) */
export const TOUR: readonly { stop: BrainStop | 'overview'; ms: number }[] = [
  { stop: 'overview', ms: 4200 },
  { stop: 'operations', ms: 2000 },
  { stop: 'marketing', ms: 1700 },
  { stop: 'strategy', ms: 1700 },
  { stop: 'sales', ms: 2200 },
  { stop: 'finance', ms: 1700 },
  { stop: 'you', ms: 1700 },
  { stop: 'admin', ms: 1900 },
]
