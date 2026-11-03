import { AnimatedIcon } from './animated-icon'
import { fr, play, trace } from './icon-motion'
import type { Key } from './icon-motion'
import { ICON_NODES } from './icon-nodes'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 6~7줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// 영상의 아이콘 칸은 24 상자보다 사방 3씩 넓은 창(30×30)에서 잘린다
const WINDOW: readonly IconNode[] = [['rect', { x: -3, y: -3, width: 30, height: 30 }]]

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]
// 구름 숨쉬기 — 가운데 기준 0.93까지 오그라들었다 펴지기를 두 번(f7~17.5, f29~41.5). 배율 추적값.
const CLOUD_BREATH: Key[] = [[0, 1], [fr(7), 1, 'linear'], [fr(12), 0.93], [fr(17.5), 1], [fr(29), 1, 'linear'], [fr(35), 0.93], [fr(41.5), 1]]

// 시계 — 시계판 전체가 가운데 기준 1.2배로 커졌다 돌아오는 동안(f10~25, 선도 같이 굵어짐) 분침이 시계 방향으로 한 바퀴
// (f9~26, f15~18에 가장 빠름) 돈다. 바늘은 판만큼 커지지 않는다(길이 거의 그대로). 판 배율·분침 각도를 프레임마다 맞춘 값(영상).
// 원본 polyline은 두 바늘이 붙어 있어 분침·시침 선 두 개로 나눴다(둥근 끝이라 이음매가 같다).
const CLOCK_FACE = [1, 1, 1.02, 1.04, 1.07, 1.12, 1.16, 1.19, 1.2, 1.2, 1.2, 1.19, 1.16, 1.13, 1.07, 1.04, 1.01, 1, 1] // f8~26
const CLOCK: IconSpec = {
  nodes: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['line', { x1: 12, y1: 12, x2: 12, y2: 6 }],
    ['line', { x1: 12, y1: 12, x2: 16, y2: 14 }],
  ],
  parts: [
    { node: 0, origin: [12, 12], play: play({ scale: trace(8, CLOCK_FACE) }) },
    {
      origin: [12, 12],
      play: play({ scale: trace(8, [1.0, 1.0, 0.996, 0.992, 0.986, 0.976, 0.968, 0.962, 0.96, 0.96, 0.96, 0.962, 0.968, 0.974, 0.986, 0.992, 0.998, 1.0, 1.0]) }),
      parts: [{ node: 1, origin: [12, 12], play: play({ rotate: trace(9, [0, 4.5, 12.8, 24.9, 43.2, 65.8, 98.5, 135.9, 180, 223, 262.2, 292.3, 316.8, 334.9, 346.3, 354.9, 357.7, 360]) }) }, { node: 2 }],
    },
  ],
}

/** clock */
export function ClockIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="clock" spec={CLOCK} />
}

const CLOUD: IconSpec = {
  parts: [{ node: 0, origin: [12, 14], play: play({ scale: CLOUD_BREATH }) }],
}

/** cloud */
export function CloudIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="cloud" spec={CLOUD} />
}

// 꺼진 구름 — 사선이 왼위로 빨려 들며(f6.5~13) 끊긴 구름이 온전한 구름으로 이어지고 구름처럼 숨쉰다.
// f29부터 사선이 다시 그어지며(f36) 도로 끊긴다.
const CLOUD_OFF: IconSpec = {
  parts: [
    { node: 1, play: play({ pathLength: [[0, 1], [fr(6.5), 1, 'linear'], [fr(13), 0, 'easeIn'], [fr(29.5), 0, 'linear'], [fr(36.5), 1, 'easeOut']], opacity: hiddenBetween(13, 29.5) }) },
    {
      origin: [12, 14],
      play: play({ scale: CLOUD_BREATH }),
      parts: [
        { node: 0, play: play({ opacity: [[0, 1], [fr(9), 1, 'linear'], [fr(12), 0], [fr(31), 0, 'linear'], [fr(34), 1]] }) },
        { shape: ['path', { d: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z' }], play: play({ opacity: [[0, 0], [fr(9), 0, 'linear'], [fr(12), 1], [fr(31), 1, 'linear'], [fr(34), 0]] }) },
      ],
    },
  ],
}

/** cloud-off */
export function CloudOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="cloud-off" spec={CLOUD_OFF} />
}

// 코드 — 두 꺾쇠가 각자 꼭짓점 기준 0.42로 줄며 양옆으로 2.8씩 벌어지고(f8~16, '>'는 24 상자 밖까지), 그 사이에 '/code'가
// 한 글자씩 쳐졌다(f12.5~17) 거꾸로 지워지고(f25.5~29.5) 꺾쇠가 제자리로 돌아온다(f29~35). 꺾쇠 배율·위치를 프레임마다
// 맞춘 값(영상). 글자는 영상의 산세리프를 가는 획(0.5배)으로 옮긴 근사(위치·크기는 영상 측정).
const CODE_SCALE = [1, 0.99, 0.97, 0.93, 0.87, 0.77, 0.58, 0.51, 0.47, 0.43, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.44, 0.45, 0.47, 0.55, 0.68, 0.84, 0.91, 0.96, 0.97, 1] // f6~35
const CODE_GLYPHS: readonly (readonly [number, number, string])[] = [
  [12.5, 29.5, 'M3.35 15.3L5.6 8.4'],
  [13.5, 27.5, 'M8.63 11.57A1.22 1.6 0 1 0 8.63 13.63'],
  [14.5, 26.5, 'M12.42 12.6A1.22 1.6 0 1 0 9.98 12.6A1.22 1.6 0 1 0 12.42 12.6'],
  [15.5, 25.5, 'M15.8 12.6A1.2 1.6 0 1 0 13.4 12.6A1.2 1.6 0 1 0 15.8 12.6M16.3 8.9V14.5'],
  [16.5, 25.5, 'M17.25 12.45H19.95A1.35 1.6 0 1 0 19.63 13.63'],
]
const CODE: IconSpec = {
  overflow: true,
  parts: [
    { node: 1, origin: [2, 12], play: play({ scale: trace(6, CODE_SCALE), x: trace(6, [0, 0, -0.25, -0.44, -0.76, -1.5, -2.45, -2.78, -2.84, -2.9, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.91, -2.85, -2.84, -2.66, -2, -1.13, -0.65, -0.4, -0.26, 0]) }) },
    { node: 0, origin: [22, 12], play: play({ scale: trace(6, CODE_SCALE), x: trace(6, [0, 0, 0.2, 0.46, 0.76, 1.48, 2.38, 2.62, 2.63, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.66, 2.68, 2.67, 2.62, 2.55, 2.06, 1.2, 0.67, 0.44, 0.27, 0]) }) },
    ...CODE_GLYPHS.map(([from, to, d]) => ({ shape: ['path', { d }] as const, stroke: 0.5, play: play({ opacity: shownBetween(from, to) }) })),
  ],
}

/** code */
export function CodeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="code" spec={CODE} />
}

// 코드펜 — 굵은 선(1.25배)의 정육면체가 세로로 눌려 납작한 마름모가 되고(f9~12, 속 선은 같이 눌려 사라짐) 위아래로
// 늘어 정사각 마름모가 됐다가(f18~23) 좌우로 갈라져 < > 가 되고(f23~31) 머물다 다시 붙어 마름모(f41~50) → 납작한
// 마름모(f50~57) → 정육면체(f62~66)로 돌아온다. 바깥 왼쪽 반 꺾은선(오른쪽은 x 12 거울)의 꼭짓점을 프레임 장면마다
// 맞춘 값(영상, 래스터 모형 맞춤). 갈라지는 두 프레임(f24~25)의 비틀림은 점 보간 근사.
const CODEPEN_KEYS: readonly (readonly [number, readonly number[]])[] = [
  [0, [12, 2, 2, 8.5, 2, 15.5, 12, 22]],
  [8, [12, 2, 2, 8.5, 2, 15.5, 12, 22]],
  [9, [12, 2.41, 2.15, 8.84, 2.1, 15.23, 12, 21.78]],
  [10, [12, 3.6, 2.1, 10.2, 2.1, 13.8, 12, 20.4]],
  [11, [12, 4.6, 2, 11.3, 2, 12.6, 12, 19.3]],
  [12, [12, 5.1, 2, 11.8, 2, 11.8, 12, 18.75]],
  [17, [12, 5.25, 2, 11.8, 2, 11.8, 12, 18.7]],
  [18, [12, 5.2, 2, 11.85, 2, 11.85, 12, 19.3]],
  [19, [12, 4.44, 2, 11.9, 2, 11.9, 12, 19.68]],
  [20, [12, 3.03, 2, 12, 2, 12, 12, 20.97]],
  [21, [12, 2.4, 2, 12, 2, 12, 12, 21.74]],
  [22, [12, 2.19, 2, 12, 2, 12, 12, 21.86]],
  [23, [12, 2.12, 2, 12, 2, 12, 12, 22]],
  [26, [7.9, 6.23, 1.9, 11.8, 1.9, 11.8, 7.72, 17.72]],
  [29, [8.28, 5.84, 1.82, 11.7, 1.82, 11.7, 7.85, 17.84]],
  [31, [8.2, 5.9, 1.82, 11.7, 1.82, 11.7, 8.07, 17.97]],
  [41, [8.2, 5.9, 1.82, 11.7, 1.82, 11.7, 8.07, 17.97]],
  [44, [12, 1.95, 1.9, 11.9, 1.9, 11.9, 12, 22.2]],
  [50, [12, 2.33, 2, 12, 2, 12, 12, 21.73]],
  [51, [12, 3.09, 2, 11.9, 2, 11.9, 12, 21.1]],
  [52, [12, 4.05, 2, 11.8, 2, 11.8, 12, 20.31]],
  [53, [12, 4.29, 2, 11.8, 2, 11.8, 12, 19.92]],
  [54, [12, 4.61, 2, 11.8, 2, 11.8, 12, 19.49]],
  [55, [12, 4.93, 2, 11.8, 2, 11.8, 12, 19.3]],
  [56, [12, 5.25, 2, 11.8, 2, 11.8, 12, 19.17]],
  [57, [12, 5.27, 2, 11.8, 2, 11.8, 12, 19]],
  [62, [12, 5.3, 2, 11.8, 2, 11.8, 12, 18.7]],
  [63, [12, 4.2, 2, 10.6, 2, 13.2, 12, 19.9]],
  [64, [12, 3, 2.1, 9.4, 2.1, 14.6, 12, 21]],
  [65, [12, 2.3, 2.2, 8.6, 2.15, 15.36, 12, 21.78]],
  [66, [12, 2, 2, 8.5, 2, 15.5, 12, 22]],
]
const cpHalf = (pts: readonly number[], mirror: boolean) => pts.map((v, i) => (mirror && i % 2 === 0 ? 24 - v : v)).join(' ')
const cpTrack = (mirror: boolean): Key[] => CODEPEN_KEYS.map(([f, pts]) => [fr(f), cpHalf(pts, mirror), 'linear'] as const)
// 속 선 — 세로로 눌려(12 기준) 사라졌다 돌아온다
const CODEPEN_INNER = play({ scaleY: [[0, 1], [fr(8), 1, 'linear'], ...trace(9, [0.9, 0.6, 0.3, 0.05]), [fr(62), 0.05, 'linear'], ...trace(63, [0.3, 0.6, 0.9, 1])], opacity: hiddenBetween(12, 62) })
const CODEPEN: IconSpec = {
  nodes: [
    ['polyline', { points: cpHalf(CODEPEN_KEYS[0][1], false) }],
    ['polyline', { points: cpHalf(CODEPEN_KEYS[0][1], true) }],
    ...ICON_NODES.codepen.slice(1),
  ],
  parts: [
    { node: 0, stroke: 1.25, play: play({ points: cpTrack(false) }) },
    { node: 1, stroke: 1.25, play: play({ points: cpTrack(true) }) },
    { node: [2, 3, 4, 5], stroke: 1.25, origin: [12, 12], play: CODEPEN_INNER },
  ],
}

/** codepen */
export function CodepenIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="codepen" spec={CODEPEN} />
}

// 커피 — 잔이 세로축으로 한 바퀴 돈다: 손잡이가 앞을 지나 왼쪽으로(f79~92, 손잡이 가로 배율 1 → -1) 갔다가 뒤로
// 숨어(f97.6~99.5) 오른쪽에서 돌아오고(f100~104), 그동안 잔은 (10,14.5) 기준 -11.7° 기울며 오른쪽으로 2.4 밀렸다가
// 반대로 11.7° 기울고(f99~110) 제자리(f120). 김 세 줄은 오른쪽부터 아랫끝이 위로 빨려 점이 됐다 사라지고(f81~99),
// 같은 순서로 아래에서 다시 자란다(f100~119). 잔 기울기·이동·손잡이 배율·김 길이를 프레임마다 맞춘 값(영상, 래스터 모형 맞춤).
const COFFEE_TILT = [0, -0.1, -0.18, -0.98, -1.6, -2.65, -5.7, -8.88, -10.15, -10.85, -11.53, -11.67, -11.75, -11.75, -11.75, -11.52, -11.02, -9.92, -6.78, -3.27, 3.27, 6.71, 9.84, 11, 11.34, 11.68, 11.72, 11.71, 11.6, 11.5, 10.88, 10.25, 8.8, 6.23, 3.07, 1.84, 0.89, 0.47, 0.34, 0.24, 0.04, 0] // f8~49
const COFFEE_X = [0, 0, 0.01, 0.17, 0.29, 0.53, 1.2, 1.87, 2.13, 2.29, 2.4, 2.43, 2.43, 2.44, 2.45, 2.44, 2.45, 2.47, 2.36, 2.31, 2.05, 2.06, 1.95, 1.95, 1.97, 1.94, 1.93, 1.92, 1.91, 1.89, 1.77, 1.66, 1.44, 0.94, 0.51, 0.26, 0.15, 0.04, 0.02, 0.02, 0, 0]
const COFFEE_Y = [0, 0, 0, 0, 0.01, 0.01, 0.04, 0.08, 0.12, 0.13, 0.14, 0.14, 0.15, 0.15, 0.14, 0.13, 0.12, 0.07, 0.05, -0.02, 0, 0.06, 0.1, 0.14, 0.14, 0.14, 0.14, 0.14, 0.13, 0.13, 0.11, 0.1, 0.08, 0.04, 0.01, -0.01, -0.02, 0, 0, 0, 0, 0]
const COFFEE_HANDLE = [1, 0.97, 0.93, 0.85, 0.71, 0.48, 0, -0.46, -0.71, -0.85, -0.93, -0.97, -0.99, -1, -1, -0.97, -0.91, -0.82, -0.64, -0.3, 0.3, 0.65, 0.82, 0.91, 0.96, 1] // f8~33
/** 김 한 줄 — 위로 빨려(pathLength) 점이 됐다 사라지고, 아래에서 다시 자란다(pathOffset = 1 - 길이). 시각은 줄 묶음 기준 프레임 */
const steam = (shrinkFrom: number, shrink: readonly number[], hide: number, growFrom: number, grow: readonly number[]) =>
  play({
    pathLength: [...trace(shrinkFrom, [1, ...shrink, 0]), ...trace(growFrom, [0, ...grow, 1])],
    // 숨은 사이에 시작점을 끝으로 옮겨 둔다
    pathOffset: [[0, 0], [fr(hide + 0.2), 0, 'linear'], [fr(hide + 0.3), 1, 'linear'], ...trace(growFrom, [1, ...grow.map((v) => Math.round((1 - v) * 100) / 100), 0])],
    opacity: hiddenBetween(hide, growFrom - 0.1),
  })
const COFFEE: IconSpec = {
  parts: [
    {
      origin: [10, 14.5],
      play: play({ rotate: trace(8, COFFEE_TILT), x: trace(8, COFFEE_X), y: trace(8, COFFEE_Y) }),
      parts: [
        { node: 1 },
        { node: 0, origin: [10, 12], play: play({ scaleX: trace(8, COFFEE_HANDLE), opacity: hiddenBetween(26.6, 28.5) }) },
        { node: 4, play: steam(9, [0.98, 0.77, 0.55, 0.44, 0.1, 0.09, 0.07, 0.03], 18.5, 29, [0.04, 0.08, 0.15, 0.44, 0.71, 0.85, 0.93]) },
        { node: 3, play: steam(13, [0.95, 0.86, 0.77, 0.6, 0.3, 0.21, 0.1, 0.01], 22.5, 35, [0.04, 0.12, 0.35, 0.66, 0.77, 0.87, 0.98]) },
        { node: 2, play: steam(17, [0.96, 0.95, 0.91, 0.88, 0.86, 0.6, 0.39, 0.2, 0.08, 0.01], 28.5, 41, [0.04, 0.15, 0.4, 0.71, 0.78, 0.87]) },
      ],
    },
  ],
}

/** coffee */
export function CoffeeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="coffee" spec={COFFEE} />
}

// 나침반 — 바늘이 N 글자로 바뀌고(f10~12) 머물다(f12~24) A 모양(가로획 있는 삼각)으로 바뀌어 살짝 기울었다
// 서고(f25~40) 다시 바늘이 된다(f41~44). 같은 5점 선의 점을 옮긴다.
const COMPASS_NEEDLE = '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76'
const COMPASS_N = '8.6 16.4 8.6 7.6 15.4 16.4 15.4 7.6 15.4 7.6'
const COMPASS_A = '8.2 16.8 12 7.2 15.8 16.8 14.3 13 9.7 13'
const COMPASS: IconSpec = {
  nodes: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: COMPASS_NEEDLE }]],
  parts: [
    {
      node: 1,
      origin: [12, 12],
      play: play({
        points: [[0, COMPASS_NEEDLE], [fr(9.5), COMPASS_NEEDLE, 'linear'], [fr(12), COMPASS_N], [fr(24), COMPASS_N, 'linear'], [fr(26.5), COMPASS_A], [fr(40), COMPASS_A, 'linear'], [fr(43.5), COMPASS_NEEDLE]],
        rotate: [[0, 0], [fr(26), 0, 'linear'], [fr(30), 12], [fr(38), -8], [fr(43.5), 0]],
      }),
    },
  ],
}

/** compass */
export function CompassIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="compass" spec={COMPASS} />
}

// 복사 — 앞 사각형은 왼위로, 뒤 사각형은 오른아래로 3.5칸씩 와서 한 장으로 겹쳤다가(f5.4~16) 되돌아간다(f16~28).
// 뒤 사각형이 더 가파르게(늦게 출발해 한 번에) 움직이고, 겹치는 동안 양 끝 꼬리가 10%씩 줄어든다.
const COPY_TRIM = [0, 0.015, 0.04, 0.09, 0.1]
const COPY: IconSpec = {
  parts: [
    {
      node: 0,
      play: play({
        x: [[fr(5.34), 0], [fr(15.95), -3.5, [0.795, 0.027, 0.174, 1]], [fr(27.85), 0, [0.822, 0.014, 0.199, 0.963]]],
        y: [[fr(5.34), 0], [fr(15.95), -3.5, [0.795, 0.027, 0.174, 1]], [fr(27.85), 0, [0.822, 0.014, 0.199, 0.963]]],
      }),
    },
    {
      node: 1,
      play: play({
        x: [[fr(5.49), 0], [fr(15.22), 3.5, [1, 0, 0.012, 0.974]], [fr(16.09), 3.5, 'linear'], [fr(27.91), 0, [1, -0.018, 0, 0.987]]],
        y: [[fr(5.49), 0], [fr(15.22), 3.5, [1, 0, 0.012, 0.974]], [fr(16.09), 3.5, 'linear'], [fr(27.91), 0, [1, -0.018, 0, 0.987]]],
        pathOffset: [...trace(7, COPY_TRIM), ...trace(21, [...COPY_TRIM].reverse())],
        pathLength: [...trace(7, COPY_TRIM.map((v) => 1 - 2 * v)), ...trace(21, COPY_TRIM.map((v) => 1 - 2 * v).reverse())],
      }),
    },
  ],
}

/** copy */
export function CopyIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="copy" spec={COPY} />
}

// CPU — 영상의 칩은 Feather와 조금 달라(안쪽 네모 4.5, 옆 핀 y 10·15) 그 모양으로 그린다. 핀이 안쪽으로 파고들며
// 안쪽 네모가 줄고(f10~13) 칩 전체가 0.81배로 움츠러들면서(f13~16) 네모가 날개 넷 달린 팬(Lucide fan 윤곽, ISC)으로
// 바뀐다. 팬은 살짝 뒤로 감겼다가(f14~22) 반 바퀴 돌고(f23~36) 서며, f44~49에 핀이 다시 파고들었다 빠지며 칩과
// 네모가 제 크기로 돌아온다. 칩 배율·네모 배율·핀 깊이·팬 크기·각도는 영상에서 프레임마다 맞춘 값. 선 굵기가 칩
// 배율만 따르게(팬·네모는 작아져도 굵기 그대로) 팬·네모·핀은 좌표로 줄인다.
const CPU_SCALE = [1, 1, 0.98, 0.97, 0.85, 0.83, 0.82, ...Array<number>(27).fill(0.81), 0.83, 0.84, 0.92, 0.98, 0.99, 1] // f10~49
const CPU_CORE = [1, 0.89, 0.83, 0.78, 0.4, 0.45, 0.42, 0.36, ...Array<number>(26).fill(0.35), 0.36, 0.3, 0.49, 0.81, 0.86, 0.94, 1] // f10~50
const CPU_PIN_IN = [0, 0.42, 0.91, 1.42, 2.04, 0.97, 0.68, 0.3, 0] // f9~17
const CPU_PIN_OUT = [0, 0.53, 0.77, 1.03, 1.82, 1.4, 0.85, 0] // f43~50
const CPU_FAN = [0.58, 0.59, 0.58, 0.52, 0.5, 0.49, 0.49, 0.49, 0.49, 0.5, 0.44, 0.45, 0.47, 0.46, 0.47, 0.46, 0.49, 0.49, 0.49, 0.45, 0.46, ...Array<number>(6).fill(0.49), 0.5, 0.51, 0.52, 0.56, 0.57, 0.62] // f14~46, 칩 안에서의 팬 배율
const CPU_TURN = [-8.2, -10.1, -10.2, -12.6, -16.7, -17.2, -17.2, -17.2, -17.2, -13.4, -8.2, -5.8, -0.6, 17.4, 29.9, 56, 88.7, 113.6, 129.6, 143.7, 147.7, 156.5, 162, 162.3, 162.3, 162.3, 162.3, 163, 163.5, 167.2, 170.5, 170.2, 175.8] // f14~46
const fanD = (k: number) => {
  const q = (v: number) => Math.round(v * 1000) / 1000, r = q(6.082 * k), a = (dx: number, dy: number) => `a${r} ${r} 0 0 1 ${q(dx * k)} ${q(dy * k)}`
  return `M${q(12 - 1.173 * k)} ${q(12 + 4.379 * k)}${a(-8.618, -7.002)}l${q(5.412 * k)} ${q(1.45 * k)}${a(7.002, -8.618)}l${q(-1.45 * k)} ${q(5.412 * k)}${a(8.618, 7.002)}l${q(-5.412 * k)} ${q(-1.45 * k)}${a(-7.002, 8.618)}l${q(1.45 * k)} ${q(-5.412 * k)}Z`
}
// 핀 하나 — 바깥 끝 (x1,y1)은 그대로, 안쪽 끝이 (dx,dy) 방향으로 깊이만큼 들어간다
const cpuPin = (x1: number, y1: number, x2: number, y2: number, dx: number, dy: number): IconPart => {
  const end = (base: number, dir: number) => [...trace(9, CPU_PIN_IN.map((v) => base + dir * v)), ...trace(43, CPU_PIN_OUT.map((v) => base + dir * v))]
  return { shape: ['line', { x1, y1, x2, y2 }], play: play(dx ? { x2: end(x2, dx) } : { y2: end(y2, dy) }) }
}
const CPU: IconSpec = {
  nodes: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, ry: 2 }]],
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: trace(10, CPU_SCALE) }),
      parts: [
        { node: 0 },
        ...[9, 15].flatMap((x) => [cpuPin(x, 1, x, 4, 0, 1), cpuPin(x, 23, x, 20, 0, -1)]),
        ...[10, 15].flatMap((y) => [cpuPin(23, y, 20, y, -1, 0), cpuPin(1, y, 4, y, 1, 0)]),
        {
          shape: ['rect', { x: 9.75, y: 9.75, width: 4.5, height: 4.5 }],
          play: play({ attrX: trace(10, CPU_CORE.map((v) => 12 - 2.25 * v)), attrY: trace(10, CPU_CORE.map((v) => 12 - 2.25 * v)), width: trace(10, CPU_CORE.map((v) => 4.5 * v)), height: trace(10, CPU_CORE.map((v) => 4.5 * v)) }),
        },
        {
          shape: ['path', { d: fanD(CPU_FAN[0]) }],
          origin: [12, 12],
          play: play({ d: trace(14, CPU_FAN.map(fanD)), rotate: trace(14, CPU_TURN), opacity: shownBetween(13.5, 46.5) }),
        },
      ],
    },
  ],
}

/** cpu */
export function CpuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="cpu" spec={CPU} />
}

// 카드 — 카드를 긁듯이: 시계 방향으로 8° 기울고(f5~8) 살짝 오른쪽으로 물러섰다가(f8~9) 왼쪽으로 휙 밀려 30칸 창 밖으로
// 나가고(f10~17), 오른쪽에서 반대로 8° 기운 채 들어와(f18~23) 서며 제자리(f25). 회전·이동을 프레임마다 맞춘 값(영상,
// 래스터 모형 맞춤). 나가는 동안(f13~17) 영상은 카드 오른쪽이 먼저 흐려지는데 그건 옮기지 않은 근사.
const CREDIT_CARD: IconSpec = {
  overflow: true,
  parts: [
    {
      node: [0, 1],
      clip: WINDOW,
      origin: [12, 12],
      play: play({
        rotate: trace(5, [0, 4.1, 7.65, 7.95, 7.75, 7.8, 7.63, 6.8, 6.3, 4.2, 0.4, -3.2, -5.1, -6.1, -7.5, -7.6, -7.9, -7.9, -7.5, -3.9, 0]),
        x: [...trace(5, [0, 0.04, 0.19, 0.73, 1.41, 0.49, -1.88, -6.8, -15.2, -20.2, -22.9, -24.1, -24.7]), [fr(17.5), -26, 'linear'], [fr(17.6), 26, 'linear'], ...trace(18, [21, 12.9, 7.87, 5.12, 2.45, 0.77, 0.15, 0])],
        y: trace(8, [0, -0.18, -0.35, -0.66, -1.22, -2, -1.75, -0.15, 1.77, 2.9, -2.14, -1.28, -0.67, -0.36, -0.18, -0.07, 0.01, 0]),
      }),
    },
  ],
}

/** credit-card */
export function CreditCardIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="credit-card" spec={CREDIT_CARD} />
}

// 자르기 — 두 꺾쇠가 늘어나 거의 상자만 한(2.6~21.5) 둥근 네모가 되고(f9~15, 모서리가 점점 둥글어짐), 대각선 점선 네 토막이
// 가운데부터 켜졌다(f11.5~13) 바깥부터 꺼진 뒤(f21.5~23.5) 네모가 다시 꺾쇠로(f23~26). 네모 크기·모서리를 프레임마다 맞춘 값(영상).
const CROP_MARKS = ['M6.13 1L6 16a2 2 0 0 0 2 2h15', 'M1 6.13L16 6a2 2 0 0 1 2 2v15']
const cropSquare = (a: number, b: number, r: number) => [`M${a} ${a}L${a} ${b - r}a${r} ${r} 0 0 0 ${r} ${r}h${+(b - a - r).toFixed(2)}`, `M${a} ${a}L${+(b - r).toFixed(2)} ${a}a${r} ${r} 0 0 1 ${r} ${r}v${+(b - a - r).toFixed(2)}`]
const CROP_KEYS: readonly (readonly [number, readonly string[]])[] = [
  [0, CROP_MARKS], [9, CROP_MARKS], [11, cropSquare(2.97, 21, 0.56)], [12, cropSquare(2.72, 21.2, 1)], [13, cropSquare(2.7, 21.3, 1.6)], [14, cropSquare(2.65, 21.4, 1.65)],
  [15, cropSquare(2.6, 21.5, 1.85)], [22, cropSquare(2.6, 21.5, 1.85)], [23, cropSquare(2.75, 21.25, 1.43)], [24, cropSquare(2.85, 21.05, 1)], [25, cropSquare(3.25, 20.7, 0.6)], [26, CROP_MARKS],
]
const cropTrack = (k: number): Key[] => CROP_KEYS.map(([f, ds]) => [fr(f), ds[k], 'linear'] as const)
// 점선 토막 [켜짐, 꺼짐, x1, y1, x2, y2] — 가운데 토막부터 켜지고 바깥 토막부터 꺼진다
const CROP_DASHES = [[12.5, 21.5, 4.62, 19.23, 7.03, 16.82], [12, 22.5, 8.72, 15.13, 11.13, 12.72], [11.5, 23.5, 12.83, 11.02, 15.23, 8.62], [12, 23, 16.93, 6.92, 19.33, 4.52]] as const
const CROP: IconSpec = {
  parts: [
    { node: 0, play: play({ d: cropTrack(0) }) },
    { node: 1, play: play({ d: cropTrack(1) }) },
    ...CROP_DASHES.map(([on, off, x1, y1, x2, y2]) => ({ shape: ['line', { x1, y1, x2, y2 }] as const, play: play({ opacity: shownBetween(on, off) }) })),
  ],
}

/** crop */
export function CropIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="crop" spec={CROP} />
}

// 데이터베이스 — 층 수가 바뀐다: 2칸 → 3칸(키 큰 통, 0.9배, f5.7~9.1) → 1칸(납작한 통, f18.6~21.4) → 2칸(f29.3~36.2).
// 0.9배 상자 안에서 뚜껑(타원)은 위아래로, 띠 두 줄은 미끄러지고(둘째 띠는 첫째 띠 뒤에서 나온다) 몸통은 길이가 바뀐다.
const dbKeys = (n: number | string, t: number | string, s: number | string): Key[] => [
  [fr(5.7), n],
  [fr(9.1), t, [0.77, 0, 0.175, 1]],
  [fr(18.6), t, 'linear'],
  [fr(21.4), s, [0.445, 0.05, 0.55, 0.95]],
  [fr(29.3), s, 'linear'],
  [fr(36.2), n, [0.96, 0, 0, 1]],
]
const dbBody = (top: number, len: number) => `M3 ${top} v${len} c0 1.66 4 3 9 3 s9 -1.34 9 -3 V${top}`
const DATABASE: IconSpec = {
  nodes: [
    ['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }],
    ['path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }],
    ['path', { d: dbBody(5, 14) }],
    ['path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }],
  ],
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: dbKeys(1, 0.9, 0.9) }),
      parts: [
        { node: 0, play: play({ cy: dbKeys(5, 2.2, 8.9) }) },
        { node: 1, play: play({ y: dbKeys(0, -2.8, 3.9) }) },
        { node: 3, play: play({ y: dbKeys(0, 4.2, 3.9) }) },
        { node: 2, play: play({ d: dbKeys(dbBody(5, 14), dbBody(2.2, 21), dbBody(8.9, 7)) }) },
      ],
    },
  ],
}

/** database */
export function DatabaseIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="database" spec={DATABASE} />
}

// 지우기 — 아이콘 전체가 왼쪽으로 1.5칸 밀리고(f8.6~16.5, 왼쪽 뾰족 끝은 상자에 잘린다) X는 1.07배로 커지며
// 네 팔이 바깥 끝으로 오그라들어 점 네 개가 된다(위 팔 f14~16, 아래 팔 f14~19). 위 팔부터 다시 뻗고(f23~27)
// 아래 팔이 따라 뻗은 뒤(f26~28) 제자리로(f24.9~31.7). X 두 선은 가운데에서 갈라 바깥 끝→가운데 반쪽 넷으로 그린다.
const DELETE_TOP = play({ pathLength: [...trace(14, [1, 0.22, 0.18, 0.17]), ...trace(23, [0.17, 0.28, 0.35, 0.69, 0.97, 1])] })
const DELETE_BOTTOM = play({ pathLength: [...trace(14, [1, 0.42, 0.28, 0.26, 0.22, 0.17]), ...trace(26, [0.18, 0.85, 1])] })
const DELETE: IconSpec = {
  nodes: [
    ['path', { d: 'M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z' }],
    ['line', { x1: 18, y1: 9, x2: 15, y2: 12 }],
    ['line', { x1: 12, y1: 15, x2: 15, y2: 12 }],
    ['line', { x1: 12, y1: 9, x2: 15, y2: 12 }],
    ['line', { x1: 18, y1: 15, x2: 15, y2: 12 }],
  ],
  parts: [
    {
      node: 0,
      play: play({ x: [[fr(8.61), 0], [fr(16.48), -1.5, [1, 0.071, 0, 1]], [fr(24.87), -1.5, 'linear'], [fr(31.74), 0, [0.825, 0.047, 0.064, 0.981]]] }),
      parts: [
        {
          origin: [15, 12],
          play: play({ scale: [[fr(12), 1], [fr(16), 1.07], [fr(26), 1.07, 'linear'], [fr(29.5), 1]] }),
          parts: [
            { node: 1, play: DELETE_TOP },
            { node: 2, play: DELETE_BOTTOM },
            { node: 3, play: DELETE_TOP },
            { node: 4, play: DELETE_BOTTOM },
          ],
        },
      ],
    },
  ],
}

/** delete */
export function DeleteIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="delete" spec={DELETE} />
}

// 디스크 — 판이 한 바퀴(360°) 뒤집힌다(f10~37). 뒤집는 축이 -84°에서 -4°로 돌아가며(f11~36) 판은 그 축에 수직으로
// cos만큼 눌린 타원이 되고, 두 번 한 줄로 납작해진다(f16, f30). 뒷면이 보이는 동안(f16~30) 안쪽 원은 흐리다.
// 선 굵기가 눌리지 않게 타원의 반지름(ry)을 바꾸고 축 방향은 회전으로 준다. 눌림·축·흐림은 영상에서 프레임마다 맞춘 값.
const DISC_SQUASH = [1, 0.98, 0.94, 0.85, 0.71, 0.52, 0.28, 0.02, 0.28, 0.52, 0.73, 0.86, 0.95, 0.99, 1, 0.99, 0.94, 0.86, 0.72, 0.53, 0.29, 0.02, 0.28, 0.52, 0.71, 0.85, 0.95, 0.99, 1] // f9~37
const DISC_AXIS = [-84, -83.7, -75.8, -72.5, -68.1, -62.7, -58.3, -54, -51, -48.2, -45.3, -44.9, -44.5, -44.1, -43.7, -43.4, -39.5, -40.8, -38.8, -34.5, -30, -25.2, -19.9, -15.9, -11.3, -8.2, -4.4] // f10~36
const DISC_BACK = [1, 0.62, 0.7, 0.69, 0.57, 0.53, 0.56, 0.57, 0.57, 0.57, 0.55, 0.55, 0.58, 0.61, 0.71, 0.84, 0.9, 0.88, 0.91, 0.97, 0.98, 0.99, 1] // f15~37, 안쪽 원 불투명
const DISC: IconSpec = {
  nodes: [['ellipse', { cx: 12, cy: 12, rx: 10, ry: 10 }], ['ellipse', { cx: 12, cy: 12, rx: 3, ry: 3 }]],
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: trace(10, DISC_AXIS) }),
      parts: [
        { node: 0, play: play({ ry: trace(9, DISC_SQUASH.map((c) => 10 * c)) }) },
        { node: 1, play: play({ ry: trace(9, DISC_SQUASH.map((c) => 3 * c)), opacity: trace(15, DISC_BACK) }) },
      ],
    },
  ],
}

/** disc */
export function DiscIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="disc" spec={DISC} />
}

// 달러 — $가 (12,12) 기준 -15° 돌며 1.16배로 커지고(f9~15) 기둥은 아래에서부터 줄어 위 끝 토막만 남는다(f15~17).
// S는 그린 시작점(오른쪽 위)부터 지워지며 끝(왼쪽 아래)으로 흘러 나가고(f19~34, 마지막엔 점) 그 뒤를 따라 새 S가
// 시작점부터 다시 그려진다(f19~37) — 한 줄이 S 길을 따라 흐르는 모양. f29~34에 제자리로 돌고 기둥이 다시 내려온다.
// 회전·배율·지운 양·그린 양은 영상에서 프레임마다 맞춘 값.
const DOLLAR_TURN = trace(8, [0, -1.7, -4.4, -7.5, -10.9, -12.6, -14.3, ...Array<number>(14).fill(-14.9), -14.2, -13.3, -10.6, -4.2, -1.3, -0.3, 0]) // f8~35
const DOLLAR_GROW = trace(8, [1, 1.01, 1.04, 1.08, 1.11, 1.13, 1.14, ...Array<number>(14).fill(1.16), 1.15, 1.14, 1.11, 1.04, 1.01, 1, 1])
const DOLLAR_GONE = [0.13, 0.2, 0.29, 0.42, 0.57, 0.7, 0.8, 0.87, 0.91, 0.94, 0.96, 0.98, 0.99, 0.995, 1] // f20~34, 옛 S가 앞에서부터 지워진 양
const DOLLAR_DRAWN = [0.01, 0.02, 0.03, 0.05, 0.08, 0.11, 0.16, 0.22, 0.31, 0.43, 0.57, 0.69, 0.79, 0.85, 0.89, 0.93, 0.97, 1] // f20~37, 새 S
const DOLLAR_SIGN: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: DOLLAR_TURN, scale: DOLLAR_GROW }),
      parts: [
        { node: 0, play: play({ pathLength: [...trace(14, [1, 0.95, 0.82, 0.14, 0.14, 0.11, ...Array<number>(9).fill(0.1), 0.19, 0.19, 0.2, 0.2, 0.25, 0.68, 0.85, 0.95, 1])] }) },
        {
          node: 1,
          play: play({
            pathOffset: [[0, 0, 'linear'], [fr(19), 0, 'linear'], ...trace(20, DOLLAR_GONE)],
            pathLength: [[0, 1, 'linear'], [fr(19), 1, 'linear'], ...trace(20, DOLLAR_GONE.map((v) => 1 - v))],
            opacity: hiddenBetween(33.6, 69.9),
          }),
        },
        { shape: ICON_NODES['dollar-sign'][1], play: play({ pathLength: [[0, 0, 'linear'], [fr(19), 0, 'linear'], ...trace(20, DOLLAR_DRAWN)], opacity: shownBetween(19.4, 69.9) }) },
      ],
    },
  ],
}

/** dollar-sign */
export function DollarSignIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="dollar-sign" spec={DOLLAR_SIGN} />
}

// 내려받기 — 화살표가 4.5칸 내려와 쟁반 바닥을 찍고(f6.2~12.8) 천천히 버티다 돌아간다(f13~28).
// 쟁반은 화살표에 눌려 1칸 내려갔다가(f10~15) 화살표보다 먼저 제자리로(f17.5~23).
const DOWNLOAD: IconSpec = {
  parts: [
    { node: 0, play: play({ y: [[fr(10.2), 0], [fr(14.9), 1.09, [0.77, 0, 0.175, 1]], [fr(17.5), 1.09, 'linear'], [fr(23.2), 0, [0.77, 0, 0.175, 1]]] }) },
    { node: [1, 2], play: play({ y: [[fr(6.22), 0], [fr(12.84), 4.54, [0.648, 0.133, 0.076, 0.997]], [fr(13.07), 4.54, 'linear'], [fr(28.35), 0, [0.825, 0.025, 0.112, 1]]] }) },
  ],
}

/** download */
export function DownloadIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="download" spec={DOWNLOAD} />
}

// 구름 받기 — 화살표가 2 내려갔다(f7~17) 머물다 위로 1.3 튀어 오르고(f21~27) 제자리(f39). 구름은 0.95로 두 번 숨쉰다.
const DOWNLOAD_CLOUD: IconSpec = {
  parts: [
    { node: [0, 1], play: play({ y: trace(6, [0, 0.07, 0.15, 0.17, 0.38, 0.58, 1.05, 1.4, 1.75, 1.9, 1.95, 2, 2, 2, 2, 1.8, 1.6, 1.02, -0.2, -0.87, -1.15, -1.3, -1.3, -1.3, -1.3, -1.3, -1.27, -1.13, -0.95, -0.7, -0.5, -0.3, -0.1, -0.05, 0]) }) },
    { node: 2, origin: [12, 12], play: play({ scale: [[0, 1], [fr(7), 1, 'linear'], [fr(11.5), 0.95], [fr(16), 1], [fr(29), 1, 'linear'], [fr(34.5), 0.94], [fr(40), 1]] }) },
  ],
}

/** download-cloud */
export function DownloadCloudIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="download-cloud" spec={DOWNLOAD_CLOUD} />
}

// 드리블 — 공이 0.8배로 작아지며(f9~19) 입체로 굴렀다가(f9~48) 제 크기로 돌아온다(f39~49). Feather 솔기 셋을 앞 반구에
// 올리고(z = √(100 − x² − y²)) 맞은편(−x, −y, −z)에도 둔 공을 프레임마다 맞춘 각도로 돌려, 앞쪽(z > 0)에 보이는 토막만
// 그린다. 공 모양이 대칭이라 맞춘 각도가 같은 모습의 다른 값으로 건너뛸 때가 있어, 프레임 사이에 솔기가 엉뚱하게
// 미끄러지지 않게 앞 프레임과 가장 가까운 솔기끼리 이어 붙인다. 선 굵기는 그대로이게 좌표로 줄인다.
// [배율, 세로축°, 가로축°, 시선축°]은 영상에서 프레임마다 맞춘 값(f9~49).
const DRIBBBLE_TURN: readonly (readonly number[])[] = [
  [1, -5.5, -3.5, -10.3], [1, -15.8, -7.2, -24], [0.99, -26.3, -11, -42], [0.98, -13.5, -34.6, 1.9], [0.98, -19, -48.4, -18.4], [0.95, -34, 115.4, 8.3],
  [0.92, -82, 102.3, 35.7], [0.89, 16, 64.5, -85.4], [0.84, -68.6, 30.9, -11.5], [0.83, 112.6, 16.5, -15.3], [0.81, 92.8, 17.3, -26], [0.8, 50.5, 9.5, -17.3],
  [0.8, 55.1, 11.6, -39.1], [0.8, 64.3, 13.1, -52.7], [0.79, 15, 54.8, -3.9], [0.79, 91.3, -32.7, 105.4], [0.79, 80.7, -33.9, 88], [0.79, 69.4, -35, 70.7],
  [0.79, 59.1, -34.2, 54.5], [0.79, 63.3, 19.2, 64.2], [0.79, -119.6, -14.8, 30.6], [0.79, -126.2, -13.4, 21.1], [0.79, -127.3, -13.3, 14.4], [0.79, 48, 15.5, 39.3],
  [0.79, 42.1, 14.2, 33.8], [0.79, 34.4, 11.5, 31], [0.79, 33, 10.4, 28.7], [0.8, 26.7, 8.6, 25.3], [0.79, 27, 8.3, 21.3], [0.8, 33.4, 9.7, 16.9],
  [0.81, 28.3, 8.9, 14.3], [0.82, 22.3, 6.1, 12.4], [0.85, 18.1, 4.8, 10.2], [0.89, 13.6, 3.7, 8.4], [0.94, 10.6, 2.7, 6.9], [0.96, 7.7, 1.6, 4.6],
  [0.98, 5.5, 0.8, 2.9], [0.99, 4.7, 0.3, 2.2], [0.99, 3.6, 0, 1.4], [0.99, 2.7, -0.3, 0.5], [1, 2.1, -0.5, 0.2],
]
// Feather 솔기 셋을 고르게 나눈 점(16개씩)
const DRIBBBLE_SEAMS: readonly (readonly (readonly [number, number])[])[] = [
  [[8.56, 2.75], [9.32, 3.81], [10.07, 4.89], [10.79, 5.98], [11.49, 7.08], [12.16, 8.21], [12.78, 9.36], [13.36, 10.53], [13.89, 11.73], [14.37, 12.95], [14.81, 14.18], [15.22, 15.42], [15.59, 16.67], [15.95, 17.93], [16.28, 19.2], [16.59, 20.47]],
  [[19.13, 5.09], [18.29, 5.99], [17.38, 6.82], [16.41, 7.57], [15.37, 8.22], [14.28, 8.79], [13.14, 9.27], [11.98, 9.67], [10.79, 9.99], [9.59, 10.26], [8.38, 10.46], [7.16, 10.63], [5.94, 10.75], [4.71, 10.84], [3.48, 10.9], [2.25, 10.94]],
  [[21.75, 12.84], [20.52, 12.55], [19.27, 12.34], [18.01, 12.22], [16.74, 12.18], [15.48, 12.26], [14.23, 12.45], [13.01, 12.77], [11.83, 13.24], [10.72, 13.84], [9.67, 14.55], [8.69, 15.35], [7.77, 16.22], [6.92, 17.16], [6.12, 18.14], [5.37, 19.16]],
]
const SEAM_POINTS = 16
const BALL_SEAMS = DRIBBBLE_SEAMS.flatMap((seam) => [1, -1].map((k) => seam.map(([x, y]) => {
  const u = x - 12, v = y - 12
  return [k * u, k * v, k * Math.sqrt(Math.max(0, 100 - u * u - v * v))]
})))
const ballTurn = (yaw: number, pitch: number, roll: number) => {
  const [ca, sa, cb, sb, cc, sc] = [yaw, pitch, roll].flatMap((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)])
  return ([x, y, z]: readonly number[]) => {
    const X = x * ca + z * sa, Z = -x * sa + z * ca
    const Y = y * cb - Z * sb
    return [X * cc - Y * sc, X * sc + Y * cc, y * sb + Z * cb]
  }
}
// 앞쪽에 보이는 가장 긴 토막(지평선에서 자른 끝 포함)을 SEAM_POINTS개 점으로 고르게 — 안 보이면 null
const frontRun = (pts: readonly number[][]): number[][] | null => {
  const cross = (q: readonly number[], p: readonly number[]) => {
    const t = q[2] / (q[2] - p[2])
    return [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t]
  }
  let best: number[][] = [], cur: number[][] = []
  pts.forEach((p, i) => {
    if (p[2] > 0) {
      if (!cur.length && i > 0) cur.push(cross(pts[i - 1], p))
      cur.push([p[0], p[1]])
    } else if (cur.length) {
      cur.push(cross(pts[i - 1], p))
      if (cur.length > best.length) best = cur
      cur = []
    }
  })
  if (cur.length > best.length) best = cur
  const cum = [0]
  for (let i = 1; i < best.length; i++) cum.push(cum[i - 1] + Math.hypot(best[i][0] - best[i - 1][0], best[i][1] - best[i - 1][1]))
  const len = cum[cum.length - 1]
  if (best.length < 2 || len < 0.05) return null
  let j = 0
  return Array.from({ length: SEAM_POINTS }, (_, k) => {
    const t = (len * k) / (SEAM_POINTS - 1)
    while (j < cum.length - 2 && cum[j + 1] < t) j++
    const a = (t - cum[j]) / (cum[j + 1] - cum[j] || 1)
    return [best[j][0] + (best[j + 1][0] - best[j][0]) * a, best[j][1] + (best[j + 1][1] - best[j][1]) * a]
  })
}
// 프레임마다 솔기 여섯 토막 — 앞 프레임의 같은 자리 토막과 가장 가까운 것을 (뒤집어서라도) 이어 붙인다
const DRIBBBLE_RUNS = (() => {
  const frames: (number[][] | null)[][] = []
  DRIBBBLE_TURN.forEach(([, yaw, pitch, roll]) => {
    const turn = ballTurn(yaw, pitch, roll)
    const runs = BALL_SEAMS.map((seam) => frontRun(seam.map(turn)))
    const prev = frames[frames.length - 1]
    if (!prev) {
      frames.push(runs)
      return
    }
    const gap = (a: number[][] | null, b: number[][] | null) => {
      if (!a || !b) return a === b ? 0 : 1e3
      let fwd = 0, rev = 0
      a.forEach((p, i) => {
        fwd += Math.hypot(p[0] - b[i][0], p[1] - b[i][1])
        rev += Math.hypot(p[0] - b[SEAM_POINTS - 1 - i][0], p[1] - b[SEAM_POINTS - 1 - i][1])
      })
      return Math.min(fwd, rev)
    }
    const slots: (number[][] | null)[] = Array<number[][] | null>(runs.length).fill(null)
    const freeSlot = prev.map(() => true), freeRun = runs.map(() => true)
    const pairs = prev.flatMap((a, i) => runs.map((b, k) => [gap(a, b), i, k])).sort((x, y) => x[0] - y[0])
    for (const [, i, k] of pairs) {
      if (!freeSlot[i] || !freeRun[k]) continue
      freeSlot[i] = freeRun[k] = false
      const run = runs[k], a = prev[i]
      // 방향도 앞 프레임과 맞춘다
      slots[i] = run && a && Math.hypot(run[0][0] - a[0][0], run[0][1] - a[0][1]) > Math.hypot(run[SEAM_POINTS - 1][0] - a[0][0], run[SEAM_POINTS - 1][1] - a[0][1]) ? [...run].reverse() : run
    }
    frames.push(slots)
  })
  return frames
})()
const dribbbleSeam = (slot: number): IconPart => {
  let last = [0, 0]
  const ds = DRIBBBLE_RUNS.map((runs, f) => {
    const run = runs[slot], k = DRIBBBLE_TURN[f][0], q = (v: number) => Math.round(v * 100) / 100
    if (run) last = run[run.length - 1]
    return 'M' + (run ?? Array<number[]>(SEAM_POINTS).fill(last)).map(([x, y]) => `${q(12 + x * k)} ${q(12 + y * k)}`).join('L')
  })
  const seen = DRIBBBLE_RUNS.map((runs) => (runs[slot] ? 1 : 0))
  return {
    shape: ['path', { d: ds[0] }],
    play: play({ d: trace(9, ds), opacity: [[0, 0, 'linear'], [fr(8.5), 0, 'linear'], ...trace(9, seen), [fr(49.5), seen[seen.length - 1], 'linear'], [fr(49.6), 0, 'linear']] }),
  }
}
const DRIBBBLE: IconSpec = {
  parts: [
    { node: 0, play: play({ r: trace(9, DRIBBBLE_TURN.map(([k]) => 10 * k)) }) },
    { node: 1, play: play({ opacity: hiddenBetween(8.5, 49.5) }) },
    ...BALL_SEAMS.map((_, slot) => dribbbleSeam(slot)),
  ],
}

/** dribbble */
export function DribbbleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="dribbble" spec={DRIBBBLE} />
}

// 편집 — 틀이 (12,12) 기준 0.8배로 줄며 그린 끝(오른쪽)부터 지워지고(f8~17) 연필도 0.8배로 줄며 틀의 왼쪽 아래로
// 내려앉는다(-13°쯤 기울었다 서며). 틀은 다시 끝에서부터 거꾸로 그려지며 커지고(f19~28) 연필은 한 번 더 기울었다
// 제자리로. 선 굵기는 줄지 않는다(--d3-k로 되돌림). 그린 양·배율·각도·이동은 영상에서 프레임마다 맞춘 값.
const EDIT_FRAME = trace(7, [1, 1, 0.98, 0.96, 0.94, 0.91, 0.88, 0.84, 0.81, 0.81, 0.8, 0.8, 0.8, 0.8, 0.8, 0.82, 0.86, 0.92, 0.95, 0.98, 0.99, 1]) // f7~28
const EDIT_PEN = {
  rotate: trace(6, [0, -0.5, -2.4, -6.4, -10.2, -12.2, -12.9, -12.5, -10.7, -6.1, -2.6, -0.7, 0.2, -0.8, -3.6, -8.8, -11.8, -13, -12.4, -10.7, -6.6, -2.6, -0.7, 0]), // f6~29
  scale: trace(7, [1, 0.99, 0.98, 0.96, 0.93, 0.9, 0.86, 0.84, 0.82, 0.8, 0.8, 0.8, 0.8, 0.8, 0.82, 0.84, 0.87, 0.92, 0.95, 0.97, 0.99, 0.99, 1]), // f7~29
  x: trace(7, [0, -0.45, -1.41, -2.5, -3.54, -4.53, -5.34, -5.69, -5.63, -5.45, -5.35, -5.35, -5.36, -5.56, -5.84, -5.76, -5.05, -3.97, -2.71, -1.56, -0.56, -0.09, 0]),
  y: trace(7, [0, -0.07, -0.14, 0.04, 0.78, 1.74, 2.73, 3.54, 4.36, 5, 5.27, 5.38, 5.28, 4.84, 4.05, 3.27, 2.3, 1.2, 0.25, 0.01, -0.01, 0, 0]),
}
const EDIT: IconSpec = {
  parts: [
    {
      node: 0,
      origin: [12, 12],
      play: play({
        scale: EDIT_FRAME,
        '--d3-k': EDIT_FRAME.map(([t, v, e]) => [t, 1 / Number(v), e] as Key),
        pathLength: [...trace(7, [1, 0.97, 0.91, 0.81, 0.68, 0.5, 0.32, 0.18, 0.11, 0.04, 0.01]), ...trace(19, [0.01, 0.05, 0.13, 0.23, 0.4, 0.6, 0.77, 0.89, 0.95, 0.99, 1])],
        pathOffset: [[0, 0, 'linear'], [fr(17.5), 0, 'linear'], [fr(17.6), 0.99, 'linear'], ...trace(19, [0.99, 0.95, 0.87, 0.77, 0.6, 0.4, 0.23, 0.11, 0.05, 0.01, 0])],
        opacity: hiddenBetween(17.5, 18.5),
      }),
    },
    { node: 1, origin: [15, 9], play: play({ ...EDIT_PEN, '--d3-k': EDIT_PEN.scale.map(([t, v, e]) => [t, 1 / Number(v), e] as Key) }) },
  ],
}

/** edit */
export function EditIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="edit" spec={EDIT} />
}

// 연필 — 아래로 1.3 내려앉으며 0.8로 줄고(f4~8), (12,12) 기준 반시계로 83° 누워 촉이 오른아래로 가며(f9~18) 왼아래에 글줄
// 두 개가 그어진다(f9~19). 누운 채 오른쪽으로 5칸 미끄러졌다(f19~21) 돌아오며 다시 서고(f25~36) 줄은 오른끝부터 걷힌다
// (f27~35). 회전·이동·배율과 줄 끝을 프레임마다 맞춘 값(영상, 래스터 모형 맞춤).
const EDIT_2_ROT = [0, 0, 0, 0, 0, 0, -15.1, -34.9, -50.2, -61.6, -69.7, -75.5, -79.1, -81.3, -82.6, -82.8, -83, -83, -83, -83, -83, -83, -71.5, -54.7, -40.5, -29.1, -20.5, -14.2, -9.5, -5.8, -2.9, -1.6, -0.5, -0.3, -0.1, 0] // f3~38
const EDIT_2_X = [0, 0, 0, 0, 0, 0, 0.51, 0.65, 0.55, 0.57, 0.61, 0.67, 0.82, 0.93, 0.99, 1.14, 3.23, 4.93, 5.92, 5.37, 5, 5, 4.09, 3.21, 2.59, 2.04, 1.58, 1.18, 0.9, 0.56, 0.27, 0.15, 0.08, 0.02, 0, 0] // f3~38
const EDIT_2_Y = [0, 0.57, 0.98, 1.22, 1.3, 1.32, -0.44, -1.75, -1.86, -1.43, -0.91, -0.47, 0.01, 0.32, 0.48, 0.53, 0.53, 0.5, 0.49, 0.54, 0.48, 0.49, -0.75, -1.85, -1.92, -1.49, -0.98, -0.34, 0.08, 0.55, 0.94, 1.12, 1.26, 1.31, 0.78, 0.37, 0.13, 0.06, 0] // f3~41
const EDIT_2_LINE_1 = [4.33, 5.09, 7.03, 8.4, 9.58, 10.14, 10.75, 10.99, 11.16, 11.24, 11.33, 11.4, 11.4, 11.4, 11.4, 11.4, 11.4, 11.4, 11.4, 10.05, 8.52, 8.52, 7.44, 6.91, 6.19, 5.72, 5.42, 5.12, 4.4] // f8~36 오른끝
const EDIT_2_LINE_2 = [4.33, 7.11, 8.53, 10.75, 12.02, 12.99, 13.85, 14.24, 14.36, 14.49, 14.61, 14.85, 14.85, 14.85, 14.85, 14.85, 14.85, 14.85, 14.85, 13, 10.87, 9.08, 7.14, 6.97, 6.24, 5.49, 5.43, 4.9, 4.4]
const EDIT_2: IconSpec = {
  overflow: true,
  parts: [
    {
      node: 0,
      origin: [12, 12],
      play: play({ rotate: trace(3, EDIT_2_ROT), x: trace(3, EDIT_2_X), y: trace(3, EDIT_2_Y), scale: [...trace(3, [1, 0.92, 0.85, 0.82, 0.8]), ...trace(36, [0.8, 0.88, 0.95, 0.98, 1])] }),
    },
    ...([[17.78, EDIT_2_LINE_1], [21.42, EDIT_2_LINE_2]] as const).map(([y, ends]) => ({
      shape: ['line', { x1: 4.33, y1: y, x2: 4.33, y2: y }] as const,
      play: play({ x2: trace(8, ends), opacity: shownBetween(8.5, 35.5) }),
    })),
  ],
}

/** edit-2 */
export function Edit2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="edit-2" spec={EDIT_2} />
}
