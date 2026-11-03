import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 12~13줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// 영상 프레임 번호(11~15줄 묶음은 주기 시작이 f5) → 초
const f5 = (frame: number) => fr(frame - 5)
// a~b 프레임(영상 번호) 동안만 보이기 / 그동안만 숨기기
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [f5(a), 0, 'linear'], [f5(a + 0.1), 1, 'linear'], [f5(b), 1, 'linear'], [f5(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [f5(a), 1, 'linear'], [f5(a + 0.1), 0, 'linear'], [f5(b), 0, 'linear'], [f5(b + 0.1), 1, 'linear']]
/**
 * 빼기 → 더하기: 가로선(A)이 시계 방향으로 90° 돌아 세로가 되는 동안, f10.6에 세로로 나타난 복제선(B)이 따라 돌아
 * 가로가 된다(f9~14). 돌아갈 때(f35.5~42)의 각도는 아이콘마다 잰 값. 원·네모는 그동안 테두리째 1.19배로 커지고
 * 선은 안쪽 기준 0.92배. 각도는 고리 띠의 밝기 봉우리로 프레임마다 잰 값.
 */
interface PlusTurn { a: readonly (readonly [number, number])[]; b: readonly (readonly [number, number])[]; bHide: number }
const PLUS_TURN_FORWARD = { a: [[8.5, 0], [9, 4], [10, 8], [11, 44], [12, 81], [13, 89], [14, 90]], b: [[10.6, 90], [11, 90], [12, 163], [13, 175], [14, 180]] } as const
const PLUS_BACK_MIRROR: PlusTurn = { a: [[35.5, 90], [36, 89], [37, 81], [38, 44], [39, 8], [40, 4], [41, 0]], b: [[35.5, 180], [36, 175], [37, 163], [38, 90]], bHide: 38.4 }
const PLUS_BACK_MINUS: PlusTurn = { a: [[35.5, 90], [36, 90], [37, 82], [38, 72], [39, 20], [40, 8], [41, 5], [42, 0]], b: [[35.5, 180], [36, 175], [37, 169], [38, 151]], bHide: 38.5 }
const turnKeys = (fw: readonly (readonly [number, number])[], back: readonly (readonly [number, number])[]): Key[] => [[0, fw[0][1]], ...fw.map(([f, deg]) => [f5(f), deg, 'linear'] as Key), ...back.map(([f, deg]) => [f5(f), deg, 'linear'] as Key)]
const plusFrom = (node: number, line: readonly [number, number], back: PlusTurn, inner: number, thick = 1): IconPart[] => {
  const shrink: Key[] = [[0, 1], [f5(10), 1, 'linear'], [f5(12.5), inner], [f5(37), inner, 'linear'], [f5(39.5), 1]]
  // 테두리 안 더하기는 굵기가 따로 1.3배 안팎 굵어진다(원·네모) — 쉴 때 1
  const bold: Record<string, Key[]> = thick === 1 ? {} : { '--d3-k': [[0, 1], [f5(10), 1, 'linear'], [f5(12.5), thick], [f5(37), thick, 'linear'], [f5(39.5), 1]] }
  const forwardA = PLUS_TURN_FORWARD.a
  return [
    { node, origin: [12, 12], play: play({ rotate: turnKeys(forwardA, back.a), scale: shrink, ...bold }) },
    {
      shape: ['line', { x1: line[0], y1: 12, x2: line[1], y2: 12 }],
      origin: [12, 12],
      play: play({ rotate: turnKeys(PLUS_TURN_FORWARD.b, back.b), scale: shrink, opacity: shownBetween(10.5, back.bHide), ...bold }),
    },
  ]
}

/** 진행률(0~1) 목록을 프레임마다 값으로 — start 프레임부터 from→to 사이(영상에서 프레임마다 잰 곡선) */
function ramp(start: number, prog: readonly number[], from: number, to: number): Key[] {
  return trace(start, prog.map((p) => +(from + (to - from) * p).toFixed(3)))
}

/** 숫자 여러 개(점 목록) 버전 — polyline points 같은 속성 */
function rampPts(start: number, prog: readonly number[], from: readonly number[], to: readonly number[]): Key[] {
  return trace(start, prog.map((p) => from.map((a, i) => +(a + (to[i] - a) * p).toFixed(3)).join(' ')))
}

/** 자세(숫자 묶음) 사이를 단계마다 진행률로 잇는다 — 단계 = [시작 프레임, 진행률 목록, 출발 자세, 도착 자세] */
type Step<P> = readonly [start: number, prog: readonly number[], from: P, to: P]

function chain(steps: readonly Step<number>[]): Key[] {
  return steps.flatMap(([start, prog, from, to]) => ramp(start, prog, from, to))
}

function chainPts(steps: readonly Step<readonly number[]>[]): Key[] {
  return steps.flatMap(([start, prog, from, to]) => rampPts(start, prog, from, to))
}

/** 자세 묶음에서 값 하나(또는 점 목록)를 골라 단계들로 */
function pick<P>(steps: readonly Step<P>[], get: (pose: P) => number): Key[] {
  return chain(steps.map(([start, prog, from, to]) => [start, prog, get(from), get(to)] as const))
}

function pickPts<P>(steps: readonly Step<P>[], get: (pose: P) => readonly number[]): Key[] {
  return chainPts(steps.map(([start, prog, from, to]) => [start, prog, get(from), get(to)] as const))
}

// 나가기 — 화살표가 기울며 꼬리 쪽으로 오그라들어(f11~14) 문 안 아래쪽 점(10.5,18.2)으로 떨어져 기다리다가(f15~25),
// 점이 비스듬한 선으로 솟아 수평으로 펴지며 오른쪽으로 뻗고(f26~32) 머리가 돋아 2.3 지나친 자리에서 천천히 커지다가
// (f33~38) 제자리로 돌아온다(f39~41). 그동안 문틀 전체가 왼쪽으로 1.6 물러났다 돌아온다(f28~45).
// 영상의 쉬는 화살표는 Feather보다 1.1 왼쪽(끝 19.9, 꼬리 7.9)이다. 값은 프레임마다 모형을 영상에 맞춰 잰 것.
type LogoutPose = readonly [tipX: number, tipY: number, head: number, turn: number, tailX: number, tailY: number]
const LOGOUT_REST: LogoutPose = [19.9, 12, 5, 0, 7.9, 12]
const LOGOUT_TRACK: readonly LogoutPose[] = [
  [19.72, 11.92, 4.89, 0.8, 7.92, 12.16], [19.37, 11.89, 4.77, 1.8, 7.85, 12.31], [18.77, 11.9, 4.47, 3, 7.87, 12.65], [17.65, 12.02, 4.1, 6.8, 7.83, 13.28],
  [11.61, 15.47, 0, 0, 9.74, 17.3], [10.95, 17.12, 0, 0, 9.9, 17.56], [10.59, 17.6, 0, 0, 10.37, 18.1], [10.57, 18.04, 0, 0, 10.37, 18.17],
  [10.45, 18.3, 0, 0, 10.51, 18.03], [10.45, 18.31, 0, 0, 10.51, 18.12], [10.45, 18.31, 0, 0, 10.51, 18.12], [10.45, 18.31, 0, 0, 10.51, 18.12],
  [10.44, 18.26, 0, 0, 10.54, 18.06], [10.44, 18.2, 0, 0, 10.57, 18.02], [10.7, 17.69, 0, 0, 10.4, 18.01], [11.23, 17.11, 0, 0, 10.17, 17.9],
  [12, 15.68, 0, 0, 10.18, 17.31], [19.36, 11.94, 0.35, 0, 10.13, 13.31], [20.77, 11.82, 0.36, 0, 10.19, 12.59], [21.53, 11.93, 0.52, 0, 10.24, 12.31],
  [21.82, 11.93, 0.61, 0, 10.26, 12.22], [22.02, 11.92, 1.11, 0, 10.26, 12.12], [22.2, 11.97, 3.81, 0, 10.25, 12.03], [22.2, 11.99, 4.2, 0, 10.24, 12.03],
  [22.2, 11.98, 4.41, 0, 10.24, 12.03], [22.21, 11.98, 4.57, 0, 10.24, 12.03], [22.11, 11.99, 4.74, 0, 10.13, 12.03], [21.99, 11.95, 4.86, 0, 9.99, 12.04],
  [20.98, 11.94, 4.84, 0, 8.96, 12.04], [20.06, 11.97, 4.9, 0, 8.12, 12.03], [19.91, 12, 4.93, 0, 7.89, 12.02], [19.9, 12, 4.95, 0, 7.9, 12],
  LOGOUT_REST,
]
// 머리 꺾쇠 — 끝(tx,ty)에서 팔 길이 k(가로·세로 성분), turn만큼 돌린 두 팔
const logoutHead = ([tx, ty, k, turn]: LogoutPose) => {
  const len = k * Math.SQRT2, a = ((turn + 135) * Math.PI) / 180, b = ((turn - 135) * Math.PI) / 180
  const n = (v: number) => +v.toFixed(2)
  return `${n(tx + len * Math.cos(b))} ${n(ty - len * Math.sin(b))} ${tx} ${ty} ${n(tx + len * Math.cos(a))} ${n(ty - len * Math.sin(a))}`
}
const LOG_OUT: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, play: play({ x: [[0, 0], ...trace(27 - 5, [0, -0.05, -0.15, -0.25, -1.31, -1.51, -1.52, -1.58, -1.58, -1.58, -1.58, -1.58, -1.58, -1.58, -1.45, -0.74, -0.1, -0.05, 0])] }) },
    {
      node: 2,
      play: play(Object.fromEntries((['x1', 'y1', 'x2', 'y2'] as const).map((k, j) => {
        const pick = (pose: LogoutPose) => pose[[0, 1, 4, 5][j]]
        return [k, [[0, pick(LOGOUT_REST)], ...trace(11 - 5, LOGOUT_TRACK.map(pick))] as Key[]]
      }))),
    },
    { node: 1, play: play({ points: [[0, logoutHead(LOGOUT_REST)], ...trace(11 - 5, LOGOUT_TRACK.map(logoutHead))] }) },
  ],
}

/** log-out */
export function LogOutIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="log-out" spec={LOG_OUT} />
}

// 편지 — 봉투째 0.9배로 오그라들고(f10~13) 덮개가 올라가 윗변에 붙으며 세로로 늘어나 편지지가 된다(f18~27).
// 글줄 셋이 3프레임 간격으로 왼쪽 짧은 줄에서 오른쪽으로 쳐졌다가(f28~) 오른끝으로 밀려 사라지고(~f47), 편지지가
// 아래로 내려앉은 봉투로 접혔다가(f46~51) 올라와(f56~64) f68에 제 크기로 돌아온다. 값은 프레임마다 모형을
// 영상에 맞춰 잰 것을 0.9배 묶음 안의 좌표로 옮긴 것 — [프레임, 윗변, 아랫변, 덮개 모서리, 덮개 끝].
const mailRect = (y0: number, y1: number) => `M4 ${y0}h16c1.1 0 2 .9 2 2v${+(y1 - y0 - 4).toFixed(2)}c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V${+(y0 + 2).toFixed(2)}c0-1.1.9-2 2-2z`
const mailFlap = (corner: number, tip: number) => `22 ${corner} 12 ${tip} 2 ${corner}`
const MAIL_REST = [4, 20, 6, 13] as const
const MAIL_POSES: readonly (readonly [number, number, number, number, number])[] = [
  [17, ...MAIL_REST], [18, 3.98, 20.07, 5.87, 12.84], [19, 3.88, 20.19, 5.73, 12.53], [20, 3.78, 20.25, 5.61, 12.23], [21, 3.58, 20.46, 5.22, 11.75],
  [22, 3.22, 20.85, 4.57, 10.64], [23, 1.37, 22.93, 1.82, 3.07], [24, 0.93, 23.35, 1.27, 1.94], [25, 0.83, 23.52, 1.13, 1.56], [26, 0.75, 23.71, 0.96, 1.09],
  [27, 0.58, 23.71, 0.86, 0.76], [45, 0.58, 23.71, 0.86, 0.76], [46, 0.91, 23.72, 1.39, 1.62], [47, 1.42, 23.75, 1.95, 2.22], [48, 4.79, 24.39, 7.33, 10.38],
  [49, 8.24, 25.03, 12.78, 18.67], [50, 8.86, 25.07, 13.76, 19.72], [51, 9.04, 25.16, 14.21, 20.15], [55, 9.04, 25.16, 14.17, 20.25], [56, 8.93, 24.98, 14.02, 20.06],
  [57, 8.74, 24.79, 13.75, 19.84], [58, 8.43, 24.44, 13.14, 19.44], [59, 6.59, 22.57, 10.37, 16.56], [60, 4.72, 20.78, 7.25, 14.02], [61, 4.29, 20.33, 6.86, 13.49],
  [62, 4.17, 20.28, 6.52, 13.32], [63, 4.07, 20.21, 6.31, 13.12], [64, 4.04, 20.09, 6.21, 13.04], [65, 4.04, 20.02, 6.12, 13.02], [67, 4.04, 20.02, 6.05, 13.01],
  [68, ...MAIL_REST],
]
const mailKeys = (get: (pose: readonly number[]) => string): Key[] => [[0, get([0, ...MAIL_REST])], ...MAIL_POSES.map((pose) => [f5(pose[0]), get(pose), 'linear'] as Key)]
// 글줄 — [y, 왼끝 목록, 오른끝 목록] (나타난 프레임부터 한 프레임씩, 14프레임 보인다)
const MAIL_LINES = [
  [5.75, [5.58, 5.82, 6.17, 6.23, 6.22, 6.23, 6.87, 7.69, 9.32, 11.93, 14.52, 16.13, 17.12, 17.11], [7.03, 7.39, 8.01, 10.38, 13.49, 15.82, 17.14, 17.92, 17.92, 17.92, 17.94, 17.94, 17.92, 17.87]],
  [11.77, [5.74, 6.21, 6.18, 6.18, 6.23, 6.22, 6.61, 7.84, 9.31, 11.94, 14.53, 16.14, 17.12, 17.37], [7.01, 7.04, 8.27, 10.42, 13.67, 15.88, 16.74, 17.61, 17.59, 17.59, 17.76, 17.75, 17.76, 17.92]],
  [18.39, [5.74, 5.97, 6.21, 6.27, 6.29, 6.29, 6.55, 7.52, 9.38, 11.98, 14.47, 16.06, 17.23, 17.23], [7.27, 7.78, 8.09, 10.49, 13.55, 15.79, 17.17, 17.67, 17.67, 17.69, 17.76, 17.83, 17.81, 17.81]],
] as const
const MAIL: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [[0, 1], [f5(10), 1, 'linear'], [f5(11), 0.95, 'linear'], [f5(12), 0.908, 'linear'], [f5(13), 0.9, 'linear'], [f5(67), 0.9, 'linear'], [f5(68), 1, 'linear']] }),
      parts: [
        { node: 0, play: play({ d: mailKeys(([, y0, y1]) => mailRect(y0, y1)) }) },
        { node: 1, play: play({ points: mailKeys(([, , , corner, tip]) => mailFlap(corner, tip)), opacity: hiddenBetween(26.5, 45.5) }) },
        ...MAIL_LINES.map(([y, left, right], k) => ({
          shape: ['line', { x1: left[0], y1: y, x2: right[0], y2: y }] as const,
          play: play({
            x1: [[0, left[0]], ...trace(28 + 3 * k - 5, left)],
            x2: [[0, right[0]], ...trace(28 + 3 * k - 5, right)],
            opacity: shownBetween(27.5 + 3 * k, 41.5 + 3 * k),
          }),
        })),
      ],
    },
  ],
}

/** mail */
export function MailIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="mail" spec={MAIL} />
}

// 네 모서리 — 한 경로라 조각낸다(왼위·오른위·오른아래·왼아래)
const MAXIMIZE_NODES: IconNode[] = [
  ['path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }],
  ['path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }],
  ['path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' }],
  ['path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }],
]
// 모서리가 안쪽으로 2.8 모였다(f4~14) 머물고 다시 벌어진다(f34~45). 천천히 떼다가 한 프레임 만에 거의 다 가고
// 남은 걸 천천히 채우는 가파른 곡선이라 프레임마다 잰 진행률을 그대로 쓴다(영상 5주기 평균).
const MAX_GO = [0, 0.002, 0.006, 0.03, 0.063, 0.122, 0.502, 0.88, 0.936, 0.974, 0.996, 1]
const MAX_BACK = [1, 0.996, 0.981, 0.946, 0.905, 0.809, 0.19, 0.097, 0.054, 0.017, 0.005, 0.003, 0]
const maxCorner = (dx: number, dy: number) => play({
  x: [...ramp(3, MAX_GO, 0, dx), ...ramp(33, MAX_BACK, 0, dx)],
  y: [...ramp(3, MAX_GO, 0, dy), ...ramp(33, MAX_BACK, 0, dy)],
})

const MAXIMIZE: IconSpec = {
  nodes: MAXIMIZE_NODES,
  parts: [
    { node: 0, play: maxCorner(2.86, 2.79) },
    { node: 1, play: maxCorner(-2.85, 2.82) },
    { node: 2, play: maxCorner(-2.84, -2.78) },
    { node: 3, play: maxCorner(2.78, -2.81) },
  ],
}

/** maximize */
export function MaximizeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="maximize" spec={MAXIMIZE} />
}

// 두 화살표가 바깥으로 밀려나며 화살촉이 1.6배로 커진다(꼭짓점 오른위 +3·왼아래 -1.8, 촉 팔 6→9.6, 선은 조금만 길어짐).
// 영상은 24 상자 밖으로 나간 선도 자르지 않는다. 곡선은 maximize와 같고 돌아올 때만 1프레임 늦다.
const max2 = (from: readonly number[], to: readonly number[]) => [...rampPts(3, MAX_GO, from, to), ...rampPts(34, MAX_BACK, from, to)]
const max2v = (from: number, to: number) => [...ramp(3, MAX_GO, from, to), ...ramp(34, MAX_BACK, from, to)]

const MAXIMIZE_2: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, play: play({ points: max2([15, 3, 21, 3, 21, 9], [14.45, 0.13, 24.02, 0.13, 24.02, 9.92]) }) },
    { node: 1, play: play({ points: max2([9, 21, 3, 21, 3, 15], [10.74, 22.79, 1.22, 22.79, 1.22, 12.69]) }) },
    { node: 2, play: play({ x1: max2v(21, 24.02), y1: max2v(3, 0.13), x2: max2v(14, 16.48), y2: max2v(10, 7.75) }) },
    { node: 3, play: play({ x1: max2v(3, 1.22), y1: max2v(21, 22.79), x2: max2v(10, 9.38), y2: max2v(14, 14.94) }) },
  ],
}

/** maximize-2 */
export function Maximize2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="maximize-2" spec={MAXIMIZE_2} />
}

// 메뉴 — 위·아래 줄이 짧아지며 가운데로 모여 시계/반시계로 137° 돌고 다시 늘어나 X가 된다(f10~18). 가운데 줄은
// 짧아져 사라지고(f10~16), 선은 그동안 1.44배 굵어진다. 같은 길을 거꾸로 되짚어 돌아온다(f41~50).
// 줄 양끝과 굵기를 프레임마다 모형(가운데·각도·반길이)으로 영상에 맞춰 잰 값(f9~50).
const MENU_TRACK = {
  top: [[3.11,  3.46,  4.4,  5.73,  8.52,  13.12,  15.96,  18.09,  18.13,  18.44,  18.5,  18.53,  18.54,  18.54,  18.54,  18.54,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.55,  18.56,  18.56,  18.56,  18.04,  17.33,  15.91,  13.05,  8.65,  5.78,  4.3,  3.57,  3.29,  3], [5.98,  6.01,  5.97,  6.01,  6.02,  6.15,  6.21,  5.41,  6.1,  6.04,  6.02,  6.01,  6.01,  6.01,  6.01,  6.01,  6.01,  6,  6,  6,  6,  6,  6,  6,  6,  6,  6,  6,  5.99,  5.99,  5.99,  5.99,  6.06,  6.03,  6.1,  5.98,  6.06,  6.02,  6,  6.01,  6.01,  6], [21.01,  20.64,  19.88,  18.39,  15.4,  11.14,  11.34,  8.13,  5.93,  5.62,  5.64,  5.63,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.62,  5.92,  6.85,  8.19,  11.01,  15.39,  18.4,  19.84,  20.55,  20.97,  21], [5.98,  6.29,  6.93,  7.95,  10.06,  11.45,  11.47,  15.63,  17.58,  17.96,  17.94,  17.95,  17.95,  17.95,  17.95,  17.95,  17.95,  17.95,  17.95,  17.94,  17.94,  17.94,  17.94,  17.94,  17.94,  17.94,  17.93,  17.93,  17.93,  17.93,  17.93,  17.93,  17.64,  16.93,  15.78,  13.92,  10.18,  7.94,  6.88,  6.35,  6.01,  6]],
  bottom: [[3.11,  3.43,  4.23,  5.7,  8.56,  13.08,  15.88,  17.35,  18.1,  18.44,  18.47,  18.5,  18.51,  18.52,  18.52,  18.52,  18.52,  18.52,  18.52,  18.52,  18.52,  18.52,  18.53,  18.53,  18.53,  18.53,  18.53,  18.53,  18.53,  18.53,  18.53,  18.54,  18.2,  17.45,  15.95,  13.11,  8.61,  5.69,  4.22,  3.48,  3.11,  3], [18.02,  18.01,  18.07,  17.95,  17.92,  17.75,  17.91,  17.81,  17.76,  17.85,  17.88,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.92,  17.91,  17.98,  17.94,  18.12,  18.01,  17.94,  17.99,  18.01,  18.01,  18], [21.03,  20.53,  19.89,  18.4,  15.2,  10.78,  8.26,  6.93,  6.14,  5.78,  5.75,  5.72,  5.72,  5.72,  5.73,  5.73,  5.73,  5.73,  5.73,  5.73,  5.73,  5.73,  5.73,  5.74,  5.74,  5.74,  5.74,  5.74,  5.74,  5.74,  5.74,  5.74,  6.24,  6.87,  8.13,  11.17,  15.41,  18.35,  19.82,  20.6,  20.83,  21], [18.02,  17.67,  17.07,  15.93,  13.98,  10.99,  8.13,  7.13,  6.56,  6.09,  6.06,  6.02,  6.03,  6.04,  6.04,  6.04,  6.04,  6.04,  6.04,  6.05,  6.05,  6.05,  6.05,  6.05,  6.05,  6.05,  6.06,  6.06,  6.06,  6.06,  6.06,  6.06,  6.43,  7,  7.96,  10.12,  13.79,  16,  17.11,  17.65,  17.99,  18]],
  middle: [9.03,  8.86,  8.26,  7.42,  5.62,  2.63,  1.3,  0.05,  0.05,  0.05,  0.05,  0.05,  0.05,  0.05,  0.05,  0.04,  0.04,  0.04,  0.04,  0.03,  0.03,  0.03,  0.03,  0.02,  0.02,  0.02,  0.01,  0.01,  0.01,  0.01,  0,  0,  0,  0,  1.02,  2.8,  5.61,  7.38,  8.29,  8.72,  8.93,  9],
  thick: [1.01,  1.01,  1.05,  1.09,  1.18,  1.37,  1.47,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.43,  1.43,  1.43,  1.43,  1.43,  1.43,  1.43,  1.43,  1.43,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.44,  1.48,  1.43,  1.51,  1.23,  1.2,  1.05,  1.03,  1.01,  0.99,  1],
}
const menuKeys = (list: readonly number[], rest: number): Key[] => [[0, rest], ...trace(9 - 5, list)]
const menuLine = (node: number, ends: readonly (readonly number[])[], rest: readonly number[]): IconPart => ({
  node,
  play: play({
    ...Object.fromEntries((['x1', 'y1', 'x2', 'y2'] as const).map((k, j) => [k, menuKeys(ends[j], rest[j])])),
    '--d3-k': menuKeys(MENU_TRACK.thick, 1),
  }),
})
const MENU: IconSpec = {
  parts: [
    {
      node: 0,
      play: play({
        x1: menuKeys(MENU_TRACK.middle.map((h) => +(12 - h).toFixed(2)), 3),
        x2: menuKeys(MENU_TRACK.middle.map((h) => +(12 + h).toFixed(2)), 21),
        '--d3-k': menuKeys(MENU_TRACK.thick, 1),
        opacity: hiddenBetween(16.5, 42.5),
      }),
    },
    menuLine(1, MENU_TRACK.top, [3, 6, 21, 6]),
    menuLine(2, MENU_TRACK.bottom, [3, 18, 21, 18]),
  ],
}

/** menu */
export function MenuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="menu" spec={MENU} />
}

// 말풍선(원) — 풍선이 가운데 기준 -5.8° 기울며 (-0.95,-0.85) 비켜나는 동안(f9~22) 안에 점 셋이 4~5프레임 간격으로
// 차례로 또렷해지고, f41~55에 오른쪽 점부터 흐려지며 풍선이 한 번 더 같은 만큼 기울었다 선다. 풍선은 추적값, 점은 밝기 질량.
const MC_TILT = [-0.3, -1.3, -3, -4.8, -5.3, -5.8, -5.8, -5.8, -5.8, -5.3, -4.3, -2.3, -0.8, -0.3, 0]
const MC_SHIFT = [-0.05, -0.2, -0.5, -0.8, -0.85, -0.95, -0.95, -0.95, -0.95, -0.85, -0.65, -0.3, -0.15, -0.1, 0]
const MC_TILT_2 = [-0.3, -1, -3, -5.3, -5.5, -5.8, -5.8, -5.8, -5.8, -5.3, -4, -2.3, -0.5, 0]
const MC_SHIFT_2 = [-0.1, -0.15, -0.45, -0.8, -0.9, -0.95, -0.95, -0.95, -0.95, -0.85, -0.65, -0.3, -0.15, 0]
const MESSAGE_CIRCLE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({
        rotate: [[0, 0], ...trace(9 - 5, MC_TILT), [f5(42), 0, 'linear'], ...trace(43 - 5, MC_TILT_2)],
        x: [[0, 0], ...trace(9 - 5, MC_SHIFT), [f5(42), 0, 'linear'], ...trace(43 - 5, MC_SHIFT_2)],
        y: [[0, 0], ...trace(9 - 5, MC_SHIFT.map((v) => +(v * 0.9).toFixed(2))), [f5(42), 0, 'linear'], ...trace(43 - 5, MC_SHIFT_2.map((v) => +(v * 0.9).toFixed(2)))],
      }),
      parts: [
        { node: 0 },
        ...[
          [8.55, [[9.5, 0], [11, 0.45], [12.5, 1], [50.5, 1], [52, 0.5], [53.5, 0.1], [54, 0]]],
          [12.5, [[14, 0], [15, 0.15], [17, 0.85], [18, 1], [44.5, 1], [47, 0.7], [49, 0.4], [50.5, 0]]],
          [16.4, [[19.5, 0], [21, 0.55], [22.5, 1], [40.5, 1], [41, 0.85], [43, 0.4], [44.5, 0]]],
        ].map(([x, fade]) => ({
          shape: ['line', { x1: x as number, y1: 11.3, x2: (x as number) + 0.01, y2: 11.3 }] as const,
          play: play({ opacity: [[0, 0], ...(fade as number[][]).map(([f, v]) => [f5(f), v, 'linear'] as Key)] }),
        })),
      ],
    },
  ],
}

/** message-circle */
export function MessageCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="message-circle" spec={MESSAGE_CIRCLE} />
}

// 말풍선(네모) — 글줄 셋이 4프레임 간격으로 왼쪽 점에서 오른쪽(17.2)으로 쳐지는 동안 풍선이 오른쪽으로 1.8
// 비켜나고(f10~15), 줄이 차례로 오른끝으로 밀려 점이 돼 사라지는 동안(f22~38) 왼쪽으로 1.9 비켜났다 돌아온다(f22~37).
// 풍선 이동은 추적값, 글줄 양끝은 풍선 기준 좌표로 프레임마다 잰 값.
const MSG_LINES: readonly { y: number; dot: number; right: readonly [number, readonly number[]]; left: readonly [number, readonly number[]]; gone: number }[] = [
  { y: 6.35, dot: 8, right: [12, [8.1, 10.2, 14.35, 15.65, 16.35, 17.2]], left: [22, [8.35, 11, 14.45, 16.15, 16.6, 17.2]], gone: 29.5 },
  { y: 9.65, dot: 12, right: [15, [7.65, 8.35, 9.85, 14.15, 15.75, 16.5, 16.65, 17.05, 17.2]], left: [27, [8.4, 10.7, 14.3, 16.5, 17.2]], gone: 34.5 },
  { y: 12.95, dot: 16, right: [19, [7.75, 8.5, 10.15, 14.15, 15.3, 15.55, 16.15, 16.3, 16.8, 17.2]], left: [31, [8.5, 10.55, 14.7, 16, 17.1, 17.2]], gone: 38.5 },
]
const MESSAGE_SQUARE: IconSpec = {
  parts: [
    {
      play: play({ x: trace(10 - 5, [0.15, 0.15, 0.55, 1.45, 1.6, 1.8, 1.8, 1.8, 1.8, 1.7, 1.65, 1.5, 1.1, -0.05, -1.3, -1.6, -1.9, -1.9, -1.9, -1.9, -1.9, -1.9, -1.8, -1.55, -0.65, -0.35, -0.15, 0]) }),
      parts: [
        { node: 0 },
        ...MSG_LINES.map(({ y, dot, right, left, gone }) => ({
          shape: ['line', { x1: 7.25, y1: y, x2: 7.25, y2: y }] as const,
          play: play({
            x2: [[0, 7.25], [f5(right[0] - 1), 7.25, 'linear'], ...trace(right[0] - 5, right[1])],
            x1: [[0, 7.25], [f5(left[0] - 1), 7.5, 'linear'], ...trace(left[0] - 5, left[1])],
            opacity: shownBetween(dot - 0.5, gone),
          }),
        })),
      ],
    },
  ],
}

/** message-square */
export function MessageSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="message-square" spec={MESSAGE_SQUARE} />
}

// 메타 — 보이는 구간(대시)이 선을 따라 거꾸로 한 바퀴 흐른다: 오른쪽 고리 끝(0.88)에서 틈이 생겨 커지며 뒤로 물러나고
// (f7~21, 보이는 길이 48%까지), 앞끝은 0.9에 멈춘 채 뒤끝이 시작점을 넘어 −0.09까지 가며 메워진다(f22~34).
// 경로 위 점마다 영상 밝기로 잰 위치·길이에서 둥근 끝(양쪽 0.012)을 뺀 값.
const META_OFFSET = [0.88, 0.883, 0.883, 0.883, 0.883, 0.883, 0.853, 0.843, 0.843, 0.823, 0.803, 0.773, 0.733, 0.673, 0.613, 0.543, 0.463, 0.383, 0.313, 0.243, 0.173, 0.103, 0.053, 0.013, -0.017, -0.037, -0.067, -0.09]
const META_LENGTH = [1, 0.955, 0.935, 0.915, 0.885, 0.845, 0.815, 0.755, 0.685, 0.635, 0.585, 0.535, 0.515, 0.485, 0.475, 0.505, 0.535, 0.585, 0.635, 0.695, 0.745, 0.805, 0.845, 0.875, 0.905, 0.925, 0.955, 1]
const META: IconSpec = {
  parts: [
    {
      node: 0,
      play: play({
        pathOffset: [[0, 0], [f5(6.5), 0, 'linear'], ...trace(7 - 5, META_OFFSET)],
        pathLength: [[0, 1], [f5(6.5), 1, 'linear'], ...trace(7 - 5, META_LENGTH)],
        pathSpacing: [[0, 0], [f5(6.5), 0, 'linear'], ...trace(7 - 5, META_LENGTH.map((v) => +(1 - v).toFixed(3)))],
      }),
    },
  ],
}

/** meta */
export function MetaIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="meta" spec={META} />
}

// 마이크 — 머리(캡슐) 안이 아래부터 차올라(f18~22, 소리 크기) 캡슐째 2.2 들렸다가(f21~34) 수위가 내려가고,
// 0.5 처졌다(f36~48) 비워지며 제자리(f53). 캡슐 위·아래 끝과 수위를 가운데 세로 단면에서 프레임마다 잰 값.
const MIC_LIFT = [0, -0.25, -0.62, -1.5, -1.87, -2.12, -2.12, -2.12, -2.25, -2.25, -2.25, -2.25, -2.12, -2.12, -2, -1.87, -0.75, 0, 0.13, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.25, 0.25, 0.25, 0.13, 0]
const MIC_LEVEL = [8, 6.6, 6.2, 6.2, 6.5, 6.5, 6.7, 7.2, 9.25, 9.75, 9.85, 9.85, 9.8, 9.8, 9.85, 9.9, 9.1, 7.85, 7.7, 7.45, 7.2, 7.2, 7.2, 7.2, 7.5, 8, 9.7, 10.7, 10.85, 10.85, 11, 11, 11, 12]
const micFill = (level: number) => `M9 ${level}V12a3 3 0 0 0 6 0V${level}z`
/** 캡슐(path)과 그 안의 채움 — 마이크·꺼진 마이크 공통 */
const micCapsule = (capsule: IconPart): IconPart => ({
  play: play({ y: [[0, 0], [f5(18.5), 0, 'linear'], ...trace(19 - 5, MIC_LIFT)] }),
  parts: [
    capsule,
    {
      shape: ['path', { d: micFill(14.5) }],
      attrs: { fill: 'currentColor', stroke: 'none' },
      play: play({ d: [[0, micFill(14.5)], [f5(17.5), micFill(14.5), 'linear'], [f5(18), micFill(13.5), 'linear'], ...trace(19 - 5, MIC_LEVEL.map(micFill))], opacity: shownBetween(17.6, 52.5) }),
    },
  ],
})
const MIC: IconSpec = { parts: [micCapsule({ node: 0 })] }

/** mic */
export function MicIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="mic" spec={MIC} />
}

// 꺼진 마이크 — 사선이 왼위 끝으로 빨려 들어 작은 점만 남고(f12~20) 끊긴 마이크가 온전한 마이크로 이어져
// 마이크처럼 차오르고 들썩였다가, f50~58에 사선이 점에서 다시 그어지며 도로 끊긴다(f54.5). 사선 길이는 경로 위 밝기로 잰 값.
const MIC_OFF: IconSpec = {
  parts: [
    { node: 0, play: play({ pathLength: [[0, 1], [f5(12), 1, 'linear'], ...trace(13 - 5, [0.98, 0.91, 0.65, 0.31, 0.15, 0.08, 0.05, 0.035]), [f5(50), 0.035, 'linear'], ...trace(51 - 5, [0.05, 0.08, 0.15, 0.31, 0.65, 0.91, 0.98, 1])] }) },
    { node: [1, 2], play: play({ opacity: hiddenBetween(15.5, 54.5) }) },
    { node: [3, 4] },
    micCapsule({ shape: ['path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }], play: play({ opacity: shownBetween(15.5, 54.5) }) }),
    { shape: ['path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }], play: play({ opacity: shownBetween(15.5, 54.5) }) },
  ],
}

/** mic-off */
export function MicOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="mic-off" spec={MIC_OFF} />
}

// 네 모서리 — 한 경로라 조각낸다(왼위·오른위·오른아래·왼아래)
const MINIMIZE_NODES: IconNode[] = [
  ['path', { d: 'M8 3v3a2 2 0 0 1-2 2H3' }],
  ['path', { d: 'M21 8h-3a2 2 0 0 1-2-2V3' }],
  ['path', { d: 'M16 21v-3a2 2 0 0 1 2-2h3' }],
  ['path', { d: 'M3 16h3a2 2 0 0 1 2 2v3' }],
]
// maximize의 반대 — 모서리가 바깥으로 2.2 벌어졌다(f3~10) 머물고 돌아온다(f27~35). 오른쪽 둘이 0.1쯤 더 나간다.
// 가는 곡선과 오는 곡선이 거울처럼 같다(영상 5주기 평균 진행률).
const MIN_GO = [0, 0.006, 0.046, 0.104, 0.506, 0.899, 0.97, 0.996, 1]
const MIN_BACK = [1, 0.992, 0.962, 0.899, 0.5, 0.103, 0.051, 0.005, 0]
const minCorner = (dx: number, dy: number) => play({
  x: [...ramp(3, MIN_GO, 0, dx), ...ramp(27, MIN_BACK, 0, dx)],
  y: [...ramp(3, MIN_GO, 0, dy), ...ramp(27, MIN_BACK, 0, dy)],
})

const MINIMIZE: IconSpec = {
  nodes: MINIMIZE_NODES,
  parts: [
    { node: 0, play: minCorner(-2.17, -2.16) },
    { node: 1, play: minCorner(2.28, -2.3) },
    { node: 2, play: minCorner(2.25, 2.32) },
    { node: 3, play: minCorner(-2.17, 2.14) },
  ],
}

/** minimize */
export function MinimizeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minimize" spec={MINIMIZE} />
}

// 두 화살표가 화살촉을 키우며(팔 6→가로 9.4·세로 8.3) 가운데로 모였다가(f3~7) 바깥으로 튕겨 나가고(f10~14)
// 다시 모인 뒤(f16~21) 제자리(f24~29). 영상은 24 상자 밖으로 나간 팔도 자르지 않는다. 영상 5주기 평균.
// 자세 = [꼭짓점 x, y, 가로팔 끝 x, 세로팔 끝 y, 선 바깥 끝 x, y]
type Arrow = readonly [number, number, number, number, number, number]
const MIN2_BL = { rest: [10, 14, 4, 20, 3, 21], in: [11.19, 12.78, 1.77, 21.07, 1.92, 22.08], out: [8.36, 15.63, -1.12, 23.95, 0.68, 23.33] } as const
const MIN2_TR = { rest: [14, 10, 20, 4, 21, 3], in: [12.94, 11.13, 22.16, 3, 22.13, 1.89], out: [15.79, 8.32, 24.99, 0.02, 23.13, 0.87] } as const
const min2Steps = (a: typeof MIN2_BL | typeof MIN2_TR): Step<Arrow>[] => [
  [3, [0, 0.04, 0.11, 0.86, 1], a.rest, a.in],
  [10, [0, 0.07, 0.5, 0.91, 1], a.in, a.out],
  [16, [0, 0.058, 0.24, 0.76, 0.951, 1], a.out, a.in],
  [24, [0, 0.17, 0.83, 0.93, 0.975, 1], a.in, a.rest],
]
const MIN2_BL_STEPS = min2Steps(MIN2_BL)
const MIN2_TR_STEPS = min2Steps(MIN2_TR)
const head = ([x, y, ax, by]: Arrow) => [ax, y, x, y, x, by]

const MINIMIZE_2: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, play: play({ points: pickPts(MIN2_BL_STEPS, head) }) },
    { node: 1, play: play({ points: pickPts(MIN2_TR_STEPS, head) }) },
    { node: 2, play: play({ x1: pick(MIN2_TR_STEPS, (a) => a[0]), y1: pick(MIN2_TR_STEPS, (a) => a[1]), x2: pick(MIN2_TR_STEPS, (a) => a[4]), y2: pick(MIN2_TR_STEPS, (a) => a[5]) }) },
    { node: 3, play: play({ x1: pick(MIN2_BL_STEPS, (a) => a[4]), y1: pick(MIN2_BL_STEPS, (a) => a[5]), x2: pick(MIN2_BL_STEPS, (a) => a[0]), y2: pick(MIN2_BL_STEPS, (a) => a[1]) }) },
  ],
}

/** minimize-2 */
export function Minimize2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minimize-2" spec={MINIMIZE_2} />
}

// 빼기 → 더하기 → 빼기(f9~14, f36~41).
const MINUS: IconSpec = { parts: plusFrom(0, [5, 19], PLUS_BACK_MINUS, 1) }

/** minus */
export function MinusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus" spec={MINUS} />
}

// 원·네모 안 빼기는 더하기일 때 테두리까지 1.19배로 커진다(f10~12.5, f37~39.5) — 테두리 반지름을 프레임마다 잼
const swell = (container: number, plus: IconPart[]): IconSpec => ({
  parts: [{ origin: [12, 12], play: play({ scale: [[0, 1], [f5(10), 1, 'linear'], [f5(11), 1.1], [f5(12), 1.18], [f5(12.5), 1.19], [f5(37), 1.19, 'linear'], [f5(38), 1.1], [f5(39), 1.01], [f5(40), 1]] }), parts: [{ node: container }, ...plus] }],
})
// 영상의 원 안 빼기는 Feather(8~16)보다 긴 6~18. 더하기일 때 원이 r 12로 커져 24칸 밖으로 나간다(잘리지 않게 overflow).
// 더하기 팔은 반길이 6.28(묶음 1.19배 × 안쪽 0.88), 굵기는 1.3배 — 프레임 맞춤으로 잰 값
const MINUS_CIRCLE: IconSpec = { overflow: true, nodes: [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 6, y1: 12, x2: 18, y2: 12 }]], ...swell(0, plusFrom(1, [6, 18], PLUS_BACK_MIRROR, 0.88, 1.3)) }

/** minus-circle */
export function MinusCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus-circle" spec={MINUS_CIRCLE} />
}

const MINUS_SQUARE: IconSpec = { overflow: true, nodes: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }], ['line', { x1: 6, y1: 12, x2: 18, y2: 12 }]], ...swell(0, plusFrom(1, [6, 18], PLUS_BACK_MIRROR, 0.88, 1.25)) }

/** minus-square */
export function MinusSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus-square" spec={MINUS_SQUARE} />
}

// 달 → 해 — 달이 0.75로 오그라들다(f8.5~12) 동그라미로 바뀌어 해(Feather sun: 원 r5 + 빛살 8개)가 되고, 빛살은
// 가운데서 자라 나온다(f13~16). f36~44에 거꾸로: 빛살이 줄어들고 원이 커지며 달로 바뀐 뒤 제 크기로. 고리 띠별
// 밝기(달 바깥 호·해 원·빛살 자리)를 프레임마다 재서 맞춘 시각.
const SUN_RAYS: readonly (readonly [number, number, number, number])[] = [[12, 1, 12, 3], [12, 21, 12, 23], [4.22, 4.22, 5.64, 5.64], [18.36, 18.36, 19.78, 19.78], [1, 12, 3, 12], [21, 12, 23, 12], [4.22, 19.78, 5.64, 18.36], [18.36, 5.64, 19.78, 4.22]]
const MOON: IconSpec = {
  parts: [
    {
      node: 0,
      origin: [12, 12],
      play: play({ scale: [[0, 1], [f5(8.5), 1, 'linear'], [f5(12), 0.75, 'easeIn'], [f5(13), 0.62], [f5(39.5), 0.62, 'linear'], [f5(40.5), 0.75], [f5(44), 1, 'easeOut']], opacity: hiddenBetween(12.8, 39.8) }),
    },
    { shape: ['circle', { cx: 12, cy: 12, r: 5 }], origin: [12, 12], play: play({ scale: [[0, 1.3], [f5(12.5), 1.3, 'linear'], [f5(15.5), 1, 'easeOut'], [f5(37), 1, 'linear'], [f5(39.5), 1.3, 'easeIn']], opacity: shownBetween(12.6, 39.8) }) },
    {
      origin: [12, 12],
      play: play({ scale: [[0, 0.45], [f5(13), 0.45, 'linear'], [f5(16), 1, 'easeOut'], [f5(36), 1, 'linear'], [f5(39), 0.45, 'easeIn']], opacity: [[0, 0], [f5(13), 0, 'linear'], [f5(15), 1], [f5(37), 1, 'linear'], [f5(39), 0]] }),
      parts: SUN_RAYS.map(([x1, y1, x2, y2]) => ({ shape: ['line', { x1, y1, x2, y2 }] as const })),
    },
  ],
}

/** moon */
export function MoonIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="moon" spec={MOON} />
}

// 가로 점 셋 — 왼쪽부터 차례로 통통 튀는 물결이 두 번(f8~13, f22~27). 근사.
const MORE_HORIZONTAL: IconSpec = {
  parts: [2, 0, 1].map((node, i) => ({ node, play: play({ y: [[0, 0], [f5(8 + i), 0, 'linear'], [f5(9.5 + i), -1.6], [f5(11.5 + i), 0], [f5(22 + i), 0, 'linear'], [f5(23.5 + i), -1.6], [f5(25.5 + i), 0]] }) })),
}

/** more-horizontal */
export function MoreHorizontalIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="more-horizontal" spec={MORE_HORIZONTAL} />
}

// 세로 점 셋 — 위부터 차례로 옆으로 튀는 물결이 두 번(f8~13, f22~27). 근사.
const MORE_VERTICAL: IconSpec = {
  parts: [1, 0, 2].map((node, i) => ({ node, play: play({ x: [[0, 0], [f5(8 + i), 0, 'linear'], [f5(9.5 + i), 1.6], [f5(11.5 + i), 0], [f5(22 + i), 0, 'linear'], [f5(23.5 + i), 1.6], [f5(25.5 + i), 0]] }) })),
}

/** more-vertical */
export function MoreVerticalIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="more-vertical" spec={MORE_VERTICAL} />
}

// 이동 — 0.8로 오그라든 뒤(f11~12) 화살표 누르듯 한 프레임 만에 오른쪽 → 왼쪽 → 가운데 → 위 → 아래 → 가운데로
// 2.7~3.1씩 뛰었다가(f19~55) 제 크기로 돌아온다(f62~65). 배율·이동 추적값(영상 프레임마다).
const MOVE: IconSpec = {
  parts: [
    {
      node: [0, 1, 2, 3, 4, 5],
      origin: [12, 12],
      play: play({
        scale: [[0, 1], [f5(9), 1, 'linear'], ...trace(10 - 5, [0.985, 0.97, 0.83, 0.82, 0.805]), [f5(61), 0.81, 'linear'], ...trace(62 - 5, [0.825, 0.965, 0.98, 0.995, 1])],
        x: [[0, 0], [f5(17), 0, 'linear'], ...trace(18 - 5, [0.15, 0.4, 2.5, 2.75, 2.75, 2.75, 2.75, 2.6, 2.05, -1.95, -2.5, -2.7, -2.7, -2.7, -2.7, -2.35, -0.35, 0])],
        y: [[0, 0], [f5(38), 0, 'linear'], ...trace(39 - 5, [-0.15, -0.55, -2.75, -3.1, -3.1, -3.1, -3.1, -2.9, -2.25, 2, 2.6, 2.85, 2.9, 2.9, 2.9, 2.55, 0.35, 0.1, 0])],
      }),
    },
  ],
}

/** move */
export function MoveIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="move" spec={MOVE} />
}

// 음표 — 두 머리는 동그란 채 옮겨 가고 기둥만 기운다: 머리가 왼쪽으로 3 미끄러지며 기둥이 오른쪽으로 눕고(f10~20)
// 일어서며 3.5 가라앉았다가(f21~28) 위로 7.6 솟으며 다시 눕고(f35~46) 내려와 선다(f47~54). 머리 둘은 프레임마다
// 추적한 위치, 기둥 꼭대기는 누운 정도(왼쪽 머리 이동량)에 비례해 영상 자세에 맞춘 값.
const MUSIC_LEFT = {
  dx: [0, 0, -0.15, -0.4, -0.85, -1.32, -1.98, -2.48, -2.65, -2.77, -3.08, -3.08, -3.08, -2.72, -2.63, -2.38, -1.73, -1.03, -0.53, -0.2, 0, 0, 0, 0, 0, 0, 0, 0, -0.13, -0.43, -0.87, -1.27, -1.95, -2.5, -2.7, -3.08, -3.1, -3.1, -3.08, -2.72, -2.63, -2.4, -1.73, -1.08, -0.5, -0.18, 0, 0, 0],
  dy: [0, 0, -0.1, -0.33, -0.57, -1, -1.4, -1.75, -1.82, -1.65, -1.45, -1.1, -0.8, -0.35, 0.25, 1.1, 2.1, 2.97, 3.42, 3.5, 3.27, 2.73, 2, 1.1, 0.22, -0.55, -1.27, -2.02, -2.68, -3.4, -4.13, -5.05, -5.97, -6.93, -7.6, -7.6, -7.6, -7.6, -7.4, -6.72, -5.7, -4.47, -3.05, -1.92, -1.03, -0.45, -0.13, -0.05, 0],
}
const MUSIC_RIGHT = {
  dx: [0, 0, -0.18, -0.45, -0.82, -1.3, -1.88, -2.45, -2.63, -3.02, -3.1, -3.08, -3.08, -2.77, -2.65, -2.05, -1.63, -1.02, -0.6, -0.23, -0.08, 0, 0, 0, 0, 0, 0, 0, -0.15, -0.43, -0.85, -1.32, -1.88, -2.38, -2.65, -2.8, -3.13, -3.1, -3.13, -2.72, -2.6, -2.3, -1.7, -1.02, -0.6, -0.25, -0.03, 0, 0],
  dy: [0, 0, 0.02, 0.1, 0.33, 0.53, 0.75, 1.1, 1.5, 1.9, 2.3, 2.65, 2.98, 3.23, 3.45, 3.75, 3.97, 4.1, 4.02, 3.75, 3.32, 2.72, 2, 1.12, 0.25, -0.57, -1.32, -2.05, -2.5, -2.82, -3.18, -3.52, -3.85, -4.03, -4.35, -4.47, -4.33, -4.15, -3.8, -3.27, -2.55, -1.85, -1.15, -0.65, -0.38, -0.23, -0.08, 0, 0],
}
const MUSIC_POSE = MUSIC_LEFT.dx.map((ldx, i) => {
  const lean = Math.min(1, Math.max(0, -ldx / 3.08))
  const lx = 6 + ldx, ly = 18 + MUSIC_LEFT.dy[i], rx = 18 + MUSIC_RIGHT.dx[i], ry = 16 + MUSIC_RIGHT.dy[i]
  const n = (v: number) => +v.toFixed(2)
  return {
    d: `M${n(lx + 3)} ${n(ly)}L${n(lx + 3 + 4.08 * lean)} ${n(ly - 13 + 5.33 * lean)}L${n(rx + 3 + 4.23 * lean)} ${n(ry - 13 + 3.97 * lean)}L${n(rx + 3)} ${n(ry)}`,
    lx: n(lx), ly: n(ly), rx: n(rx), ry: n(ry),
  }
})
const MUSIC: IconSpec = {
  overflow: true,
  nodes: [['path', { d: 'M9 18L9 5L21 3L21 16' }], ['circle', { cx: 6, cy: 18, r: 3 }], ['circle', { cx: 18, cy: 16, r: 3 }]],
  parts: [
    { node: 0, play: play({ d: trace(3, MUSIC_POSE.map((p) => p.d)) }) },
    { node: 1, play: play({ cx: trace(3, MUSIC_POSE.map((p) => p.lx)), cy: trace(3, MUSIC_POSE.map((p) => p.ly)) }) },
    { node: 2, play: play({ cx: trace(3, MUSIC_POSE.map((p) => p.rx)), cy: trace(3, MUSIC_POSE.map((p) => p.ry)) }) },
  ],
}

/** music */
export function MusicIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="music" spec={MUSIC} />
}
