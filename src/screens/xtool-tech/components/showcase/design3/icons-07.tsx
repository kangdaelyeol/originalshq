import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 12~13줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// 영상 프레임 번호(11~15줄 묶음은 주기 시작이 f5) → 초
const f5 = (frame: number) => fr(frame - 5)
// a~b 프레임(영상 번호) 동안만 보이기 / 그동안만 숨기기
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [f5(a), 0, 'linear'], [f5(a + 0.1), 1, 'linear'], [f5(b), 1, 'linear'], [f5(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [f5(a), 1, 'linear'], [f5(a + 0.1), 0, 'linear'], [f5(b), 0, 'linear'], [f5(b + 0.1), 1, 'linear']]
/** a에서 b로 갔다가 머물고 c에서 d로 돌아오는 값(영상 프레임 번호) */
const goBack = (from: number | string, to: number | string, a: number, b: number, c: number, d: number): Key[] => [[0, from], [f5(a), from, 'linear'], [f5(b), to], [f5(c), to, 'linear'], [f5(d), from]]
/** 빼기 → 더하기: 가로선과 복제선이 가위처럼 ±45°로 벌어졌다(×) 가로·세로로 서며 커지고(f9~14),
 * 돌아갈 땐 같은 방향으로 더 돌아 다시 포개진다(f36~41). k는 더하기일 때 커지는 배율 */
const plusFrom = (node: number, x1: number, x2: number, k: number): IconPart[] => {
  const grow: Key[] = [[0, 1], [f5(9), 1, 'linear'], [f5(14), k], [f5(36), k, 'linear'], [f5(41), 1]]
  return [
    { node, origin: [12, 12], play: play({ rotate: [[0, 0], [f5(9), 0, 'linear'], [f5(11.5), -45], [f5(14), 0], [f5(36), 0, 'linear'], [f5(38.5), 45], [f5(41), 0]], scale: grow }) },
    {
      shape: ['line', { x1, y1: 12, x2, y2: 12 }],
      origin: [12, 12],
      play: play({ rotate: [[0, 0], [f5(9), 0, 'linear'], [f5(11.5), 45], [f5(14), 90], [f5(36), 90, 'linear'], [f5(38.5), 135], [f5(41), 180]], scale: grow, opacity: shownBetween(9, 41) }),
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

// 나가기 — 화살표가 오른쪽으로 미끄러져 나가 사라지고(f11~17) 문만 남았다가, 문 안쪽에서 다시 그려져 나온다(f28~35). 근사.
const LOG_OUT: IconSpec = {
  overflow: true,
  parts: [
    {
      clip: [['rect', { x: 8, y: -3, width: 19, height: 30 }]],
      play: play({ x: [[0, 0], [f5(11), 0, 'linear'], [f5(17), 12, 'easeIn'], [f5(17.1), -12, 'linear'], [f5(28), -12, 'linear'], [f5(35), 0, 'easeOut']] }),
      parts: [{ node: [1, 2] }],
    },
  ],
}

/** log-out */
export function LogOutIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="log-out" spec={LOG_OUT} />
}

// 편지 — 봉투 덮개가 사라지며 세로로 긴 편지지가 되고(f20~23) 글줄이 생겼다가(f32~35) 지워지고 봉투로 돌아온다(f44~50). 근사.
const MAIL_ENVELOPE = 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'
const MAIL_LETTER = 'M6 4h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'
const MAIL: IconSpec = {
  parts: [
    {
      // 돌아온 봉투는 작게(0.78) 아래로 내려앉았다가 f62~68에 제 크기
      origin: [12, 21],
      play: play({ scale: [[0, 1], [f5(44), 1, 'linear'], [f5(50), 0.78], [f5(62), 0.78, 'linear'], [f5(68), 1]] }),
      parts: [
        { node: 0, play: play({ d: goBack(MAIL_ENVELOPE, MAIL_LETTER, 20, 23, 44, 50) }) },
        { node: 1, play: play({ opacity: hiddenBetween(20, 47) }) },
        ...[8, 11, 14].map((y, i) => ({ shape: ['line', { x1: 8, y1: y, x2: i === 2 ? 12 : 16, y2: y }] as const, play: play({ pathLength: goBack(0, 1, 31 + i, 34 + i, 41, 44), opacity: shownBetween(31 + i, 44) }) })),
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

// 메뉴 — 위·아래 줄이 가운데로 모이며 ±45° 돌아 X가 되고 가운데 줄은 사라졌다가(f10~17) 머물고 되돌아온다(f43~50).
const MENU: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: goBack(1, 0, 10, 15, 44, 49) }) },
    { node: 1, origin: [12, 6], play: play({ y: goBack(0, 6, 10, 16, 43, 50), rotate: goBack(0, 45, 10, 17, 43, 50) }) },
    { node: 2, origin: [12, 18], play: play({ y: goBack(0, -6, 10, 16, 43, 50), rotate: goBack(0, -45, 10, 17, 43, 50) }) },
  ],
}

/** menu */
export function MenuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="menu" spec={MENU} />
}

// 말풍선(원) — 안에 점 세 개가 차례로 찍혀(f14~17) 입력 중 표시처럼 오르내리다가(f17~44) 사라진다(f47~50). 근사.
const MESSAGE_CIRCLE: IconSpec = {
  parts: [8.5, 12, 15.5].map((x, i) => ({
    shape: ['line', { x1: x, y1: 11.5, x2: x + 0.01, y2: 11.5 }] as const,
    play: play({ y: [[0, 0], [f5(18 + i * 2), 0, 'linear'], [f5(21 + i * 2), -1.2], [f5(24 + i * 2), 0], [f5(30 + i * 2), 0, 'linear'], [f5(33 + i * 2), -1.2], [f5(36 + i * 2), 0]], opacity: shownBetween(14 + i, 48 - i) }),
  })),
}

/** message-circle */
export function MessageCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="message-circle" spec={MESSAGE_CIRCLE} />
}

// 말풍선(네모) — 안에 글줄 세 개가 그어졌다가(f12~18) 아래 줄부터 하나씩 지워진다(f29~41). 근사.
const MESSAGE_SQUARE: IconSpec = {
  parts: [[7, 7, 17], [7, 10, 17], [7, 13, 13]].map(([x1, y, x2], i) => ({
    shape: ['line', { x1, y1: y, x2, y2: y }] as const,
    play: play({ pathLength: [[0, 0], [f5(12 + i * 2), 0, 'linear'], [f5(15 + i * 2), 1], [f5(39 - i * 4), 1, 'linear'], [f5(42 - i * 4), 0]], opacity: shownBetween(12 + i * 2, 42 - i * 4) }),
  })),
}

/** message-square */
export function MessageSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="message-square" spec={MESSAGE_SQUARE} />
}

// 메타 — ∞가 비틀리며 한쪽 고리가 풀렸다 감기듯(가로로 눌리고 뒤집힘) 출렁였다가(f9~32) 돌아온다. 근사.
const META: IconSpec = {
  parts: [{ node: 0, origin: [12, 12], play: play({ scaleX: [[0, 1], [f5(9), 1, 'linear'], [f5(14), 0.6], [f5(20), -0.5], [f5(26), 0.6], [f5(32), 1]], rotate: [[0, 0], [f5(9), 0, 'linear'], [f5(16), -20], [f5(24), 15], [f5(32), 0]] }) }],
}

/** meta */
export function MetaIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="meta" spec={META} />
}

// 마이크 — 머리 안에 소리 크기 막대가 차올랐다 내려가기를 되풀이한다(f18~53). 근사.
const MIC: IconSpec = {
  parts: [
    {
      shape: ['line', { x1: 12, y1: 11, x2: 12, y2: 11 }],
      play: play({ y1: [[0, 11], [f5(18), 11, 'linear'], [f5(22), 5], [f5(26), 8], [f5(30), 4.5], [f5(35), 7.5], [f5(40), 4.5], [f5(46), 8], [f5(53), 11]], opacity: shownBetween(18, 53) }),
    },
  ],
}

/** mic */
export function MicIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="mic" spec={MIC} />
}

// 꺼진 마이크 — 사선이 왼위로 빨려 들며(f12~20) 끊긴 마이크가 온전한 마이크로 이어지고 소리 막대가 차올랐다가,
// 사선이 다시 그어지며(f50~58) 도로 끊긴다.
const MIC_OFF: IconSpec = {
  parts: [
    { node: 0, play: play({ pathLength: [[0, 1], [f5(12), 1, 'linear'], [f5(19), 0, 'easeIn'], [f5(51), 0, 'linear'], [f5(58), 1, 'easeOut']], opacity: hiddenBetween(19, 51) }) },
    { node: [1, 2], play: play({ opacity: hiddenBetween(16, 53) }) },
    { shape: ['path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2' }], play: play({ opacity: shownBetween(16, 53) }) },
    { shape: ['line', { x1: 12, y1: 11, x2: 12, y2: 11 }], play: play({ y1: [[0, 11], [f5(20), 11, 'linear'], [f5(24), 5], [f5(29), 8], [f5(34), 4.5], [f5(40), 7.5], [f5(46), 11]], opacity: shownBetween(20, 47) }) },
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
const MINUS: IconSpec = { parts: plusFrom(0, 5, 19, 1) }

/** minus */
export function MinusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus" spec={MINUS} />
}

// 원·네모 안 빼기는 더하기일 때 테두리까지 1.15배로 커진다
const swell = (container: number, plus: IconPart[]): IconSpec => ({
  parts: [{ origin: [12, 12], play: play({ scale: [[0, 1], [f5(9), 1, 'linear'], [f5(14), 1.15], [f5(36), 1.15, 'linear'], [f5(41), 1]] }), parts: [{ node: container }, ...plus] }],
})
const MINUS_CIRCLE: IconSpec = swell(0, plusFrom(1, 8, 16, 1.3))

/** minus-circle */
export function MinusCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus-circle" spec={MINUS_CIRCLE} />
}

const MINUS_SQUARE: IconSpec = swell(0, plusFrom(1, 8, 16, 1.3))

/** minus-square */
export function MinusSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="minus-square" spec={MINUS_SQUARE} />
}

// 달 → 해 — 달이 돌며 작아지고(f9~13) 둥근 해와 빛살 8개가 피어났다가(f12~16) 거꾸로 달로 돌아온다(f36~41). 근사.
const MOON: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ rotate: goBack(0, 90, 9, 13, 37, 41), scale: goBack(1, 0.3, 9, 13, 37, 41), opacity: hiddenBetween(13, 37) }) },
    {
      origin: [12, 12],
      play: play({ rotate: goBack(-45, 0, 12, 16, 36, 40), scale: goBack(0.3, 1, 12, 16, 36, 40), opacity: shownBetween(12, 40) }),
      parts: [
        { shape: ['circle', { cx: 12, cy: 12, r: 3.5 }] },
        ...[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => ({ shape: ['line', { x1: 12, y1: 4.5, x2: 12, y2: 2.8 }] as const, attrs: { transform: `rotate(${deg} 12 12)` } })),
      ],
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

// 이동 — 0.85로 작아져(f12~16) 좌우로 떠돌다(f20~45) 제자리·제 크기로(f60). 근사.
const MOVE: IconSpec = {
  parts: [{ node: [0, 1, 2, 3, 4, 5], origin: [12, 12], play: play({ scale: goBack(1, 0.85, 12, 16, 56, 62), x: [[0, 0], [f5(18), 0, 'linear'], [f5(22), 2], [f5(28), 0], [f5(33), -2], [f5(40), 0], [f5(46), 1], [f5(52), 0]], y: [[0, 0], [f5(24), 0, 'linear'], [f5(28), 1], [f5(36), -1], [f5(44), 0]] }) }],
}

/** move */
export function MoveIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="move" spec={MOVE} />
}

// 음표 — 아래를 축으로 왼쪽으로 25° 기우뚱했다 돌아오기를 두 번(f14~26, f41~53). 근사.
const MUSIC: IconSpec = {
  parts: [{ node: [0, 1, 2], origin: [12, 21], play: play({ rotate: [[0, 0], [f5(14), 0, 'linear'], [f5(19), -25], [f5(26), 0], [f5(41), 0, 'linear'], [f5(46), -25], [f5(53), 0]] }) }],
}

/** music */
export function MusicIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="music" spec={MUSIC} />
}
