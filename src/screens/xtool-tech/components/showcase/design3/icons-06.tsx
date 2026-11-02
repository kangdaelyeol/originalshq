import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconPart, IconSpec } from './icon-types'

// 영상 10~11줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).
// 10줄은 6~10줄 묶음(주기 시작 f0), 11줄은 11~15줄 묶음(주기 시작 f5)이라 11줄 아이콘은 fr(영상 프레임 − 5)로 적는다.

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]
// 11줄(주기 시작 f5)용 — 영상 프레임 번호를 그대로 적는다
const f5 = (frame: number) => fr(frame - 5)
/** a에서 b로 갔다가(ease) 머물고 c에서 d로 돌아오는 값 */
const goBack = (from: number, to: number, a: number, b: number, c: number, d: number, at = fr): Key[] => [[0, from], [at(a), from, 'linear'], [at(b), to], [at(c), to, 'linear'], [at(d), from]]

// 격자 — 네 칸이 시계 반대쪽 이웃 자리로 곧게 옮겨 가며 작아졌다가(f6~14: 자리 0.8배, 칸 0.64배) 잠깐 쉬고(f14~21),
// 한 칸 더 옮기며 제 크기로(f21~29). 끝나면 칸마다 대각선 맞은편에 있지만 네 칸이 같은 모양이라 처음과 똑같다.
const GRID_EASE = [0.455, 0.03, 0.515, 0.955] as const
const gridKeys = (from: number, hold: number, end: number): Key[] => [
  [fr(6.3), from],
  [fr(14.4), hold, GRID_EASE],
  [fr(20.7), hold, 'linear'],
  [fr(28.8), end, GRID_EASE],
]
// 칸(왼쪽 위·오른쪽 위·오른쪽 아래·왼쪽 아래)마다 [쉼 자리 x, y, 끝 자리 x, y] 이동량
const GRID_MOVES = [[1.1, 9.9, 11, 11], [-9.9, 1.1, -11, 11], [-1.1, -9.9, -11, -11], [9.9, -1.1, 11, -11]] as const

const GRID: IconSpec = {
  parts: GRID_MOVES.map(([hx, hy, ex, ey], node) => ({
    node,
    play: play({ x: gridKeys(0, hx, ex), y: gridKeys(0, hy, ey), scale: gridKeys(1, 0.64, 1) }),
  })),
}

/** grid */
export function GridIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="grid" spec={GRID} />
}

// 헤드폰 — 고개를 까딱이듯 오른쪽으로 18° 기울었다가(f7~16) 왼쪽으로 17°(f16~23) 넘어간 뒤 제자리(f24~33, 영상 3주기 평균).
// 기우는 동안(f8~15) 전체가 0.9배로 줄고, 띠는 반지름 9→7.3의 작은 활로 바뀌며(다리는 거의 없어짐) 귀 둘이 안쪽 위로 붙는다(f24~32에 되돌아옴).
// 띠는 선 굵기가 그대로라 배율이 아니라 경로(d) 자체가 바뀐다.
const HP_IN = [0, 0.03, 0.07, 0.16, 0.51, 0.87, 0.95, 0.98, 1] // f7~15
const HP_OUT = [1, 0.965, 0.9, 0.87, 0.47, 0.12, 0.06, 0.015, 0] // f24~32
const hpKeys = (value: (p: number) => number | string): Key[] => [...trace(7, HP_IN.map(value)), ...trace(24, HP_OUT.map(value))]
const hpBand = (p: number) => {
  const r = 9 - 1.7 * p, cy = 12 - 0.93 * p, leg = 6 - 5.55 * p
  const n = (v: number) => +v.toFixed(3)
  return `M${n(12 - r)} ${n(cy + leg)}v${n(-leg)}a${n(r)} ${n(r)} 0 0 1 ${n(2 * r)} 0v${n(leg)}`
}

const HEADPHONES: IconSpec = {
  nodes: [
    ['path', { d: 'M3 18v-6a9 9 0 0 1 18 0v6' }],
    ['path', { d: 'M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z' }],
    ['path', { d: 'M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z' }],
  ],
  parts: [
    {
      origin: [12, 10.7],
      play: {
        ...play({
          rotate: trace(7, [0, 1.06, 2.6, 4.93, 8.6, 12.57, 15.52, 16.72, 17.94, 18.06, 17.46, 13.17, 5.56, -4.47, -12.01, -16.18, -16.79, -16.79, -15.77, -14.18, -11.73, -7.84, -4.7, -2.43, -0.87, -0.07, 0]),
          scale: hpKeys((p) => 1 - 0.1 * p),
        }),
      },
      parts: [
        { node: 0, play: play({ d: hpKeys(hpBand) }) },
        { node: 1, play: play({ x: hpKeys((p) => -1.92 * p), y: hpKeys((p) => -1.21 * p) }) },
        { node: 2, play: play({ x: hpKeys((p) => 1.92 * p), y: hpKeys((p) => -1.21 * p) }) },
      ],
    },
  ],
}

/** headphones */
export function HeadphonesIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="headphones" spec={HEADPHONES} />
}

// 하트 — 두 번 뛴다: 0.74배로 오므라들며 선이 굵어졌다가(f6~13, f22~27) 풀린다(f15~20, f30~37). 영상 3주기 평균을 프레임마다 옮김.
// 굵기는 줄어든 크기 기준으로 원래의 1.32배(줄기 전 굵기로는 1.78배). 컴포넌트 굵기 값을 쉴 때 그대로 두려고
// 굵어지는 선은 같은 하트를 하나 더 겹쳐 그려(쉴 때는 굵기 0) 그 굵기만 키운다.
const HEART_D = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'
// f6~37
const HEART_SCALE = [1, 0.988, 0.97, 0.919, 0.82, 0.765, 0.748, 0.741, 0.742, 0.743, 0.757, 0.808, 0.928, 0.978, 1, 1, 1, 0.978, 0.93, 0.807, 0.756, 0.742, 0.742, 0.742, 0.746, 0.758, 0.79, 0.868, 0.945, 0.975, 0.992, 1]
const HEART_STROKE = [1, 1.02, 1.04, 1.16, 1.46, 1.7, 1.75, 1.78, 1.78, 1.78, 1.76, 1.55, 1.15, 1.03, 1, 1, 1, 1.03, 1.14, 1.56, 1.75, 1.78, 1.78, 1.78, 1.77, 1.73, 1.63, 1.35, 1.13, 1.06, 1.02, 1]

const HEART: IconSpec = {
  parts: [
    {
      node: 0,
      origin: [12, 12],
      play: play({ scale: trace(6, HEART_SCALE) }),
      parts: [
        {
          // 굵기를 맡는 겹친 하트 — 1.65(영상 굵기)에서 출발해 밑의 하트에 가려진 채 시작·끝난다
          shape: ['path', { d: HEART_D }],
          attrs: { strokeWidth: 0 },
          play: play({
            strokeWidth: [[fr(5.9), 0], ...trace(6, HEART_STROKE.map((k) => +(1.65 * k).toFixed(3))), [fr(37.1), 0, 'linear']],
          }),
        },
      ],
    },
  ],
}

/** heart */
export function HeartIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="heart" spec={HEART} />
}

// 물음표 — 곡선이 앞에서부터 지워지며(끝 6%만 남음) 왼쪽 위로 올라가고 점도 원 가운데로 올라가 1.3배(f6~15),
// 잠깐 멈췄다(f15~17) 곡선이 다시 그려지며 오른쪽으로 2.3 지나쳐(f18~25) 머물다 제자리로(f28~35). 점은 f25에 이미 제자리.
// 영상 3주기 평균을 프레임마다 옮김(곡선은 pathOffset으로 앞을 지운다 — 남는 쪽이 경로 끝).
const HC_TRIM = [0, 0.077, 0.223, 0.348, 0.483, 0.574, 0.678, 0.806, 0.878, 0.929, 0.93, 0.93, 0.87, 0.719, 0.604, 0.463, 0.335, 0.193, 0.136, 0.09, 0.086, 0.085, 0.085, 0.084, 0.086, 0.04, 0.032, 0.009, 0] // f6~34
const HC_DOT = [0, -0.39, -0.78, -1.56, -2.59, -3.48, -4.18, -4.66, -4.95, -4.95, -4.95, -4.78, -4.21, -3.48, -2.57, -1.53, -0.79, -0.32, 0] // f7~25

const HELP_CIRCLE: IconSpec = {
  parts: [
    {
      node: 1,
      play: play({
        pathOffset: trace(6, HC_TRIM),
        pathLength: trace(6, HC_TRIM.map((v) => +(1 - v).toFixed(3))),
        x: trace(8, [0, -0.05, -0.26, -1.07, -1.87, -1.96, -2.01, -2.05, -2.05, -2.05, -1.97, -1.98, -1.16, 0.37, 1.7, 2.13, 2.27, 2.33, 2.32, 2.31, 2.26, 2.13, 1.75, 1.16, 0.52, 0.2, 0.08, 0]),
        y: trace(6, [0, -0.07, -0.44, -1.12, -2.08, -3.11, -4.06, -5.08, -5.46, -5.73, -5.75, -5.75, -5.46, -4.98, -4.3, -3.32, -2, -0.9, -0.16, 0.33, 0.35, 0.35, 0.35, 0.34, 0.27, 0.06, 0.02, 0]),
      }),
    },
    { node: 2, play: play({ y: trace(7, HC_DOT), scale: trace(7, HC_DOT.map((v) => +(1 - (0.3 * v) / 4.95).toFixed(3))) }) },
  ],
}

/** help-circle */
export function HelpCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="help-circle" spec={HELP_CIRCLE} />
}

// 집 — 뒤에 같은 집이 오른쪽 위로 비켜 나와 두 채가 겹쳐 보였다가(f9~13 → f27~31) 다시 숨는다. 근사.
const HOME: IconSpec = {
  parts: [
    { shape: ['path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }], play: play({ x: goBack(0, 1.8, 9, 13, 27, 31), y: goBack(0, -1.8, 9, 13, 27, 31), opacity: shownBetween(9, 31) }) },
  ],
}

/** home */
export function HomeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="home" spec={HOME} />
}

// 사진 — 0.72로 작아지는 사이(f12~16) 해(원)가 초승달로, 산이 낮게 바뀌어 밤 사진이 됐다가(f16~47)
// 다시 낮 사진으로 바뀌며 제 크기로 돌아온다(f46~50). 근사.
const IMAGE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [[0, 1], [fr(12), 1, 'linear'], [fr(16), 0.72], [fr(46), 0.72, 'linear'], [fr(50), 1]] }),
      parts: [
        { node: 0 },
        { node: [1, 2], play: play({ opacity: hiddenBetween(15, 47) }) },
        { shape: ['path', { d: 'M9.6 7.2a1.7 1.7 0 1 0 1.2 2.4 2.2 2.2 0 0 1-1.2-2.4z' }], play: play({ opacity: shownBetween(15, 47) }) },
        { shape: ['polyline', { points: '21 16.5 15.5 12 11 16 8.5 14 3 19' }], play: play({ opacity: shownBetween(15, 47) }) },
      ],
    },
  ],
}

/** image */
export function ImageIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="image" spec={IMAGE} />
}

// 받은편지함 — 쟁반이 아래 기준 0.8로 작아지며 안에서 편지 봉투가 솟아올라(f9~17) 머물고 다시 들어간다(f44~55). 근사.
const INBOX: IconSpec = {
  parts: [
    {
      origin: [12, 20],
      play: play({ scale: [[0, 1], [fr(6), 1, 'linear'], [fr(12), 0.8], [fr(50), 0.8, 'linear'], [fr(56), 1]] }),
      parts: [
        { node: [0, 1] },
        {
          clip: [['rect', { x: -3, y: -3, width: 30, height: 15 }]],
          play: play({ y: goBack(8, 0, 9, 17, 44, 54), opacity: shownBetween(9, 54) }),
          parts: [{ shape: ['rect', { x: 7.5, y: 5, width: 9, height: 7, rx: 1 }] }, { shape: ['polyline', { points: '7.5 5.5 12 9 16.5 5.5' }] }],
        },
      ],
    },
  ],
}

/** inbox */
export function InboxIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="inbox" spec={INBOX} />
}

// 정보 — 점이 커지며(최대 2.9배) 살짝 왼쪽 위로 들렸다가(f12~19) 원 가운데로 툭 떨어지고(f21~26) 다시 튀어 오른 뒤(f30~34) 제자리(f42).
// 막대는 점에 밀리듯 반시계로 14° 기울며 1.45배 굵고 길어져 원 아래로 6 내려갔다가(아래 끝은 원 안쪽까지만 보임) 같이 돌아온다.
// 영상 3주기 평균을 프레임마다 옮김(f12~44).
const INFO: IconSpec = {
  parts: [
    {
      node: 1,
      clip: [['circle', { cx: 12, cy: 12, r: 10 }]],
      play: play({
        x: trace(12, [0, 0.02, 0.04, 0.05, 0.04, 0.06, 0.04, 0.12, 0.16, 0.3, 0.61, 1.16, 1.57, 1.93, 2.02, 2.1, 2.04, 1.87, 1.55, 1.2, 0.72, 0.35, 0.17, 0.1, 0.05, 0.02, 0.01, 0]),
        y: trace(12, [0, -0.19, -0.48, -0.77, -1.1, -1.24, -1.45, -1.32, -1.17, -0.61, 0.65, 2.57, 4.04, 5.49, 5.83, 6.14, 5.94, 5.43, 4.38, 3.18, 1.54, 0.15, -0.79, -1.17, -1.38, -1.43, -1.47, -1.22, -0.83, -0.4, -0.16, -0.08, 0]),
        rotate: trace(12, [0, -0.5, -1.4, -2.3, -4.3, -5.3, -6.5, -8.7, -10.2, -11.4, -13.1, -13.8, -14.1, -13.4, -14.1, -14.1, -14.1, -13.2, -13.2, -13.2, -11.7, -10.7, -9.1, -7.6, -5.8, -4.2, -2.6, -1.6, -1, -0.6, -0.3, 0]),
        scale: trace(12, [1, 1.01, 1.048, 1.079, 1.119, 1.16, 1.235, 1.327, 1.381, 1.408, 1.442, 1.47, 1.442, 1.446, 1.442, 1.456, 1.446, 1.439, 1.429, 1.459, 1.408, 1.347, 1.268, 1.228, 1.17, 1.133, 1.085, 1.048, 1.031, 1.02, 1.007, 1]),
      }),
    },
    {
      node: 2,
      play: play({
        x: trace(12, [0, -0.02, -0.17, -0.28, -0.33, -0.61, -0.76, -0.94, -1.07, -1.02, -0.81, -0.44, -0.22, -0.01, -0.01, 0, -0.21, -0.38, -0.73, -1.07, -1.29, -1.23, -1.1, -0.8, -0.69, -0.52, -0.25, -0.17, -0.11, -0.02, 0]),
        y: trace(12, [0, -0.34, -0.68, -1.05, -1.31, -1.51, -1.61, -1.6, -1.47, -0.65, 0.79, 2.25, 3.31, 3.86, 3.89, 3.86, 3.3, 2.43, 0.89, -0.74, -2.02, -2.76, -2.94, -2.82, -2.59, -2.31, -1.79, -1.19, -0.76, -0.3, 0]),
        scale: trace(12, [1, 1.03, 1.13, 1.22, 1.36, 1.62, 1.81, 2.06, 2.22, 2.47, 2.66, 2.75, 2.84, 2.87, 2.9, 2.88, 2.89, 2.84, 2.75, 2.6, 2.36, 2.1, 1.92, 1.65, 1.49, 1.33, 1.18, 1.1, 1.05, 1.02, 1]),
      }),
    },
  ],
}

/** info */
export function InfoIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="info" spec={INFO} />
}

// 인스타그램 — 기울었다(f9~11) 옆으로 넓은 사진기 몸통처럼 눌렸다가(f11~29) 반대로 기울며(f31~33) 돌아온다. 근사.
const INSTAGRAM: IconSpec = {
  parts: [{ node: [0, 1, 2], origin: [12, 12], play: play({ rotate: [[0, 0], [fr(7), 0, 'linear'], [fr(10), -15], [fr(13), 0], [fr(29), 0, 'linear'], [fr(32), 15], [fr(36), 0]], scaleX: goBack(1, 1.1, 9, 13, 29, 34), scaleY: goBack(1, 0.75, 9, 13, 29, 34) }) }],
}

/** instagram */
export function InstagramIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="instagram" spec={INSTAGRAM} />
}

// 기울임 — 더 기울었다가(f10~13) 되돌아온다(f25~28). 근사.
const ITALIC: IconSpec = {
  parts: [{ node: [0, 1, 2], origin: [12, 12], play: play({ skewX: goBack(0, -12, 10, 13, 25, 28) }) }],
}

/** italic */
export function ItalicIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="italic" spec={ITALIC} />
}

// 열쇠 — 열쇠 축(대각선)을 중심으로 두 번 뒤집힌다(f12~17, f30~35) — 축에 수직 방향 배율로 옮긴 근사.
const KEY: IconSpec = {
  parts: [
    {
      attrs: { transform: 'rotate(-45 12 12)' },
      parts: [{ origin: [12, 12], play: play({ scaleY: [[0, 1], [f5(12), 1, 'linear'], [f5(14), 0.05], [f5(17), 1], [f5(30), 1, 'linear'], [f5(32), 0.05], [f5(35), 1]] }), parts: [{ attrs: { transform: 'rotate(45 12 12)' }, node: 0 }] }],
    },
  ],
}

/** key */
export function KeyIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="key" spec={KEY} />
}

// 겹 — 세 겹이 가운데로 모여 납작한 마름모 하나가 됐다가(f15~20) 머물고 다시 벌어진다(f44~49).
const LAYERS: IconSpec = {
  parts: [
    { node: 0, play: play({ y: goBack(0, 5, 15, 20, 44, 49, f5) }) },
    { node: 1, play: play({ y: goBack(0, -5, 15, 20, 44, 49, f5), opacity: hiddenBetween(19.5 - 5, 44.5 - 5) }) },
    { node: 2, play: play({ opacity: hiddenBetween(19.5 - 5, 44.5 - 5) }) },
  ],
}

/** layers */
export function LayersIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="layers" spec={LAYERS} />
}

// 레이아웃 — 가로줄이 가운데로 내려가고 세로줄이 따라 짧아졌다가(f13~18) 돌아온다(f26~31). 근사.
const LAYOUT: IconSpec = {
  parts: [
    { node: 1, play: play({ y1: goBack(9, 12.5, 13, 18, 26, 31, f5), y2: goBack(9, 12.5, 13, 18, 26, 31, f5) }) },
    { node: 2, play: play({ y2: goBack(9, 12.5, 13, 18, 26, 31, f5) }) },
  ],
}

/** layout */
export function LayoutIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="layout" spec={LAYOUT} />
}

// 구명튜브 — 위로 튀어 30칸 창을 돌아 나왔다가(f13~20) 제자리, 한 번 더 2 떠올랐다 내려앉는다(f31~39). 근사.
const LIFE_BUOY: IconSpec = {
  overflow: true,
  nodes: [['circle', { cx: 12, cy: 12, r: 10 }], ['circle', { cx: 12, cy: 12, r: 4 }], ['line', { x1: 4.93, y1: 4.93, x2: 9.17, y2: 9.17 }], ['line', { x1: 14.83, y1: 14.83, x2: 19.07, y2: 19.07 }], ['line', { x1: 14.83, y1: 9.17, x2: 19.07, y2: 4.93 }], ['line', { x1: 14.83, y1: 9.17, x2: 18.36, y2: 5.64 }], ['line', { x1: 4.93, y1: 19.07, x2: 9.17, y2: 14.83 }],
    ['circle', { cx: 12, cy: 42, r: 10 }], ['circle', { cx: 12, cy: 42, r: 4 }], ['line', { x1: 4.93, y1: 34.93, x2: 9.17, y2: 39.17 }], ['line', { x1: 14.83, y1: 44.83, x2: 19.07, y2: 49.07 }], ['line', { x1: 14.83, y1: 39.17, x2: 19.07, y2: 34.93 }], ['line', { x1: 4.93, y1: 49.07, x2: 9.17, y2: 44.83 }]],
  parts: [
    {
      clip: [['rect', { x: -3, y: -3, width: 30, height: 30 }]],
      play: play({ y: [[0, 0], [f5(13), 0, 'linear'], [f5(18), -30], [f5(18.1), 0, 'linear'], [f5(31), 0, 'linear'], [f5(34), -2], [f5(39), 0]] }),
      parts: [{ node: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }],
    },
  ],
}

/** life-buoy */
export function LifeBuoyIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="life-buoy" spec={LIFE_BUOY} />
}

// 고리 — 두 고리가 가운데로 겹치며 -30° 돌아 사슬 한 쌍처럼 보였다가(f14~18) 머물고 풀린다(f44~48). 근사.
const LINK: IconSpec = {
  parts: [
    { node: [0, 1], origin: [12, 12], play: play({ rotate: goBack(0, -30, 14, 18, 44, 48, f5) }) },
  ],
}

/** link */
export function LinkIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="link" spec={LINK} />
}

// 가로 고리 — 두 반쪽이 가운데로 모여 비스듬한 고리 하나가 됐다가(f13~18) 다시 벌어진다(f44~48). 가운데 줄은 그동안 숨는다. 근사.
const LINK_2: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: goBack(1, 0.55, 13, 18, 44, 48, f5), rotate: goBack(0, -40, 13, 18, 44, 48, f5) }) },
    { node: 1, play: play({ opacity: hiddenBetween(13.5 - 5, 47.5 - 5) }) },
  ],
}

/** link-2 */
export function Link2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="link-2" spec={LINK_2} />
}

// 링크드인 — 글자 조각들이 제자리에서 점으로 오그라들어 사라졌다가(f12~17) 다시 피어난다(f27~30). 근사.
const LINKEDIN: IconSpec = {
  parts: [0, 1, 2].map((node) => ({ node, play: play({ scale: goBack(1, 0.05, 12, 17, 27, 30, f5) }) })) as IconPart[],
}

/** linkedin */
export function LinkedinIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="linkedin" spec={LINKEDIN} />
}

// 목록 — 글줄은 오른쪽으로, 글머리 점은 왼쪽으로 1.5 비켜났다(f10~16) 돌아온다(f29~35). 근사.
const LIST: IconSpec = {
  parts: [
    { node: [0, 1, 2], play: play({ x: goBack(0, 1.5, 10, 16, 29, 35, f5) }) },
    { node: [3, 4, 5], play: play({ x: goBack(0, -1, 10, 16, 29, 35, f5) }) },
  ],
}

/** list */
export function ListIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="list" spec={LIST} />
}

// 자물쇠 — 고리가 2.5 들려 열렸다가(f8~13) 머물고 다시 닫힌다(f37~45).
const LOCK: IconSpec = {
  parts: [{ node: 1, play: play({ y: goBack(0, -2.5, 8, 13, 37, 45, f5) }) }],
}

/** lock */
export function LockIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="lock" spec={LOCK} />
}

// 들어가기 — 화살표가 문 안으로 미끄러져 사라졌다가(f12~18) 왼쪽에서 다시 들어와 제자리(f29~35). 근사.
const LOG_IN: IconSpec = {
  parts: [
    {
      clip: [['rect', { x: -3, y: -3, width: 18, height: 30 }]],
      play: play({ x: [[0, 0], [f5(12), 0, 'linear'], [f5(18), 12, 'easeIn'], [f5(18.1), -14, 'linear'], [f5(29), -14, 'linear'], [f5(35), 0, 'easeOut']] }),
      parts: [{ node: [1, 2] }],
    },
  ],
}

/** log-in */
export function LogInIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="log-in" spec={LOG_IN} />
}
