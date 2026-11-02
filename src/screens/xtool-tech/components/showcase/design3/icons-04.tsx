import { AnimatedIcon } from './animated-icon'
import { fr, play, trace } from './icon-motion'
import type { Key } from './icon-motion'
import { ICON_NODES } from './icon-nodes'
import type { AnimatedIconProps, IconPart, IconSpec } from './icon-types'

// 영상 6~7줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]
// 구름 숨쉬기 — 가운데 기준 0.93까지 오그라들었다 펴지기를 두 번(f7~17.5, f29~41.5). 배율 추적값.
const CLOUD_BREATH: Key[] = [[0, 1], [fr(7), 1, 'linear'], [fr(12), 0.93], [fr(17.5), 1], [fr(29), 1, 'linear'], [fr(35), 0.93], [fr(41.5), 1]]

// 시계 — 분침만 중심을 축으로 한 바퀴(f8.2~25.4, 느리게 출발해 f17 무렵 가장 빠르다). 시침은 그대로.
// 원본 polyline은 두 바늘이 붙어 있어 분침·시침 선 두 개로 나눴다(둥근 끝이라 이음매가 같다).
const CLOCK: IconSpec = {
  nodes: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['line', { x1: 12, y1: 12, x2: 12, y2: 6 }],
    ['line', { x1: 12, y1: 12, x2: 16, y2: 14 }],
  ],
  parts: [{ node: 1, origin: [12, 12], play: play({ rotate: [[fr(8.2), 0], [fr(25.4), 360, [0.543, 0.015, 0.491, 0.977]]] }) }],
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

// 코드 — 오른쪽 꺾쇠(>)가 왼쪽으로 미끄러져 <와 겹쳐 X가 되고(f6.5~11), 그 뒤로 '/code'가 한 글자씩
// 쳐졌다가(f12~17) 한 글자씩 지워지고(f25~29) > 가 제자리로 돌아간다(f30~34.5). 글자는 획으로 그린 근사.
const CODE_GLYPHS: readonly (readonly [number, readonly ['path' | 'line' | 'circle', Readonly<Record<string, string | number>>]])[] = [
  [12, ['line', { x1: 8.7, y1: 15.2, x2: 10.4, y2: 9.6 }]],
  [14, ['path', { d: 'M13.9 11.2a1.9 1.9 0 1 0 0 2.6' }]],
  [15, ['circle', { cx: 15.9, cy: 12.5, r: 1.85 }]],
  [16, ['path', { d: 'M21.4 8.6v5.8m0-1.9a1.85 1.85 0 1 1-3.7 0 1.85 1.85 0 0 1 3.7 0' }]],
  [17, ['path', { d: 'M23.2 12.5h3.4a1.8 1.8 0 1 0-.55 1.5' }]],
]
const CODE: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, play: play({ x: [[0, 0], [fr(6.5), 0, 'linear'], [fr(11), -14], [fr(30), -14, 'linear'], [fr(34.5), 0]] }) },
    ...CODE_GLYPHS.map(([at, shape], i) => ({ shape, play: play({ opacity: shownBetween(at - 0.5, 29 - i) }) })),
  ],
}

/** code */
export function CodeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="code" spec={CODE} />
}

// 코드펜 — 속 선이 흐려지며 육각기둥이 마름모로 눌리고(f8~13), 마름모가 위아래 꼭짓점에서 갈라져 < > 가
// 됐다가(f23~28 → f41) 다시 마름모로 붙고(f41~47) 육각기둥으로 돌아온다(f61~66). 테두리를 왼쪽·오른쪽 반쪽으로 나눠 점을 옮긴다.
const CP_HEX = { left: '12 2 2 8.5 2 15.5 12 22', right: '12 2 22 8.5 22 15.5 12 22' }
const CP_DIAMOND = { left: '12 6 3 12 3 12 12 18', right: '12 6 21 12 21 12 12 18' }
const CP_BRACKETS = { left: '9.5 6.5 3 12 3 12 9.5 17.5', right: '14.5 6.5 21 12 21 12 14.5 17.5' }
const cpTrack = (side: 'left' | 'right'): Key[] => [
  [0, CP_HEX[side]], [fr(8), CP_HEX[side], 'linear'], [fr(13), CP_DIAMOND[side]], [fr(23), CP_DIAMOND[side], 'linear'], [fr(28), CP_BRACKETS[side]],
  [fr(41), CP_BRACKETS[side], 'linear'], [fr(47), CP_DIAMOND[side]], [fr(61), CP_DIAMOND[side], 'linear'], [fr(66), CP_HEX[side]],
]
const CODEPEN: IconSpec = {
  nodes: [
    ['polyline', { points: CP_HEX.left }],
    ['polyline', { points: CP_HEX.right }],
    ...ICON_NODES.codepen.slice(1),
  ],
  parts: [
    { node: 0, play: play({ points: cpTrack('left') }) },
    { node: 1, play: play({ points: cpTrack('right') }) },
    { node: [2, 3, 4, 5], play: play({ opacity: [[0, 1], [fr(8), 1, 'linear'], [fr(11), 0], [fr(62), 0, 'linear'], [fr(66), 1]] }) },
  ],
}

/** codepen */
export function CodepenIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="codepen" spec={CODEPEN} />
}

// 커피 — 잔이 세로축으로 한 바퀴 돈다: 손잡이가 뒤로 숨었다(f12~15) 왼쪽에 비쳤다 사라지고(f15~19) 잔이 좌우로
// 기우뚱하다 오른쪽에서 손잡이가 돌아온다(f31~41). 김은 짧은 점으로 줄었다가(f17~31) 다시 자란다(f33~41). 근사.
const COFFEE: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(12), 1, 'linear'], [fr(15), 0], [fr(15.1), -1, 'linear'], [fr(18), -0.6], [fr(19), 0, 'linear'], [fr(32), 0, 'linear'], [fr(36), 0.6], [fr(41), 1]] }) },
    { node: 1, origin: [10, 20], play: play({ rotate: [[0, 0], [fr(12), 0, 'linear'], [fr(16), -10], [fr(22), 8], [fr(28), -5], [fr(34), 3], [fr(41), 0]] }) },
    ...[2, 3, 4].map((node, i) => ({ node, play: play({ y1: [[0, 1], [fr(15 + i), 1, 'linear'], [fr(19 + i), 3.4], [fr(33 + i), 3.4, 'linear'], [fr(40 + i), 1]] }) })),
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

// CPU — 가운데 네모가 작아지며 사라지고 날개 넷 달린 팬이 돋아 두 바퀴 돌다가(f12~46) 다시 네모로 돌아온다(f46~50). 근사.
const CPU: IconSpec = {
  parts: [
    { node: 1, origin: [12, 12], play: play({ scale: [[0, 1], [fr(11), 1, 'linear'], [fr(14), 0.2], [fr(46), 0.2, 'linear'], [fr(49), 1]], opacity: hiddenBetween(14, 46) }) },
    {
      origin: [12, 12],
      play: play({ rotate: [[0, 0], [fr(12), 0, 'linear'], [fr(46), 720, 'easeInOut']], scale: [[0, 0.2], [fr(12), 0.2, 'linear'], [fr(15), 1], [fr(44), 1, 'linear'], [fr(47), 0.2]], opacity: shownBetween(12, 47) }),
      parts: [0, 90, 180, 270].map((deg) => ({ shape: ['path', { d: 'M12 12c0-1.8.9-2.9 2.6-2.9' }] as const, origin: [12, 12] as const, attrs: { transform: `rotate(${deg} 12 12)` } })),
    },
  ],
}

/** cpu */
export function CpuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="cpu" spec={CPU} />
}

// 카드 — 살짝 기울었다(f4~11) 테두리가 시작점(왼위)부터 지워져 왼쪽·아래 변(L)만 남고(f11~17) 다시 그려지며
// 띠(가운데 줄)도 지워졌다 그어진다(f12~22). 근사.
const CREDIT_CARD: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: [[0, 0], [fr(4), 0, 'linear'], [fr(7.5), -7], [fr(11), 0]] }),
      parts: [
        { node: 0, play: play({ pathOffset: [[0, 0], [fr(11), 0, 'linear'], [fr(17), 0.6, 'easeIn'], [fr(18), 0.6, 'linear'], [fr(23), 0, 'easeOut']] }) },
        { node: 1, play: play({ pathLength: [[0, 1], [fr(12), 1, 'linear'], [fr(15.5), 0], [fr(18.5), 0, 'linear'], [fr(22), 1]], opacity: hiddenBetween(15.5, 18.5) }) },
      ],
    },
  ],
}

/** credit-card */
export function CreditCardIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="credit-card" spec={CREDIT_CARD} />
}

// 자르기 — 두 꺾쇠가 늘어나 둥근 네모 틀이 되고(f9.5~11.5), 대각선 점선이 왼아래부터 그어졌다가(f12~19)
// 같은 쪽부터 지워지고(f20~24) 틀이 다시 꺾쇠로 돌아간다(f24.5~27).
const CROP: IconSpec = {
  parts: [
    { node: 0, play: play({ d: [[0, 'M6.13 1L6 16a2 2 0 0 0 2 2h15'], [fr(9.5), 'M6.13 1L6 16a2 2 0 0 0 2 2h15', 'linear'], [fr(11.5), 'M4 4L4 18a2 2 0 0 0 2 2h14'], [fr(24.5), 'M4 4L4 18a2 2 0 0 0 2 2h14', 'linear'], [fr(27), 'M6.13 1L6 16a2 2 0 0 0 2 2h15']] }) },
    { node: 1, play: play({ d: [[0, 'M1 6.13L16 6a2 2 0 0 1 2 2v15'], [fr(9.5), 'M1 6.13L16 6a2 2 0 0 1 2 2v15', 'linear'], [fr(11.5), 'M4 4L18 4a2 2 0 0 1 2 2v14'], [fr(24.5), 'M4 4L18 4a2 2 0 0 1 2 2v14', 'linear'], [fr(27), 'M1 6.13L16 6a2 2 0 0 1 2 2v15']] }) },
    {
      shape: ['path', { d: 'M7.5 16.5l1.3-1.3M10.3 13.7l1.3-1.3M13.1 10.9l1.3-1.3M15.9 8.1l.6-.6' }],
      play: play({ pathLength: [[0, 0], [fr(12), 0, 'linear'], [fr(19), 1, 'linear']], pathOffset: [[0, 0], [fr(20), 0, 'linear'], [fr(24), 1, 'linear']], opacity: shownBetween(12, 24) }),
    },
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

// 디스크 — 판이 비스듬한 축으로 뒤집혀 한 줄로 납작해졌다 펴지고(f12~21, 축 28°), 다른 축으로 한 번 더(f26~35, 축 70°).
// 축 방향으로 돌려 놓고 가로 배율만 줄이는 식(3D 뒤집기의 평면 근사).
const discFlip = (deg: number, at: number, mid: number, end: number): IconPart => ({
  attrs: { transform: `rotate(${deg} 12 12)` },
  parts: [{ origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(at), 1, 'linear'], [fr(mid), 0.03, 'easeIn'], [fr(end), 1, 'easeOut']] }), parts: [{ attrs: { transform: `rotate(${-deg} 12 12)` }, node: [0, 1] }] }],
})
const DISC: IconSpec = {
  parts: [
    { play: play({ opacity: hiddenBetween(12, 21) }), parts: [discFlip(70, 26, 30, 35)] },
    { play: play({ opacity: shownBetween(12, 21) }), parts: [{ attrs: { transform: 'rotate(28 12 12)' }, parts: [{ origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(12), 1, 'linear'], [fr(16), 0.03, 'easeIn'], [fr(21), 1, 'easeOut']] }), parts: [{ attrs: { transform: 'rotate(-28 12 12)' }, shape: ['circle', { cx: 12, cy: 12, r: 10 }] }, { attrs: { transform: 'rotate(-28 12 12)' }, shape: ['circle', { cx: 12, cy: 12, r: 3 }] }] }] }] },
  ],
}

/** disc */
export function DiscIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="disc" spec={DISC} />
}

// 달러 — 기둥이 양 끝에서 줄어 사라지고(f12~18) S가 비스듬히 누우며 납작해졌다(f8~30) 다시 서고, 기둥이 가운데서
// 위아래로 다시 뻗는다(f30~36). 영상은 S가 2·c 모양을 거치는데 그건 기울기·배율로 줄인 근사.
const DOLLAR_SIGN: IconSpec = {
  parts: [
    { node: 0, play: play({ pathLength: [[0, 1], [fr(12), 1, 'linear'], [fr(18), 0], [fr(30), 0, 'linear'], [fr(36), 1]], pathOffset: [[0, 0], [fr(12), 0, 'linear'], [fr(18), 0.5], [fr(30), 0.5, 'linear'], [fr(36), 0]], opacity: hiddenBetween(18, 30) }) },
    { node: 1, origin: [12, 12], play: play({ rotate: [[0, 0], [fr(8), 0, 'linear'], [fr(16), -18], [fr(24), -40], [fr(30), -10], [fr(36), 0]], scaleY: [[0, 1], [fr(10), 1, 'linear'], [fr(20), 0.55], [fr(29), 0.55, 'linear'], [fr(36), 1]] }) },
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

// 드리블 — 0.8로 작아진 공이 굴러간다(f9~49): 솔기(안쪽 곡선)가 가운데 기준으로 한 바퀴 돌며 가로로 출렁여(f9~48) 입체로 도는 느낌을 낸다. 근사.
const DRIBBBLE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [[0, 1], [fr(9), 1, 'linear'], [fr(14), 0.8], [fr(44), 0.8, 'linear'], [fr(49), 1]] }),
      parts: [{ node: 0 }, { node: 1, origin: [12, 12], play: play({ rotate: [[0, 0], [fr(9), 0, 'linear'], [fr(48), -360]], scaleX: [[0, 1], [fr(9), 1, 'linear'], [fr(16), 0.55], [fr(24), 1], [fr(32), 0.6], [fr(40), 1], [fr(45), 0.9], [fr(48), 1]] }) }],
    },
  ],
}

/** dribbble */
export function DribbbleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="dribbble" spec={DRIBBBLE} />
}

// 편집 — 네모 틀이 시작점(위)부터 지워져 사라지고(f8~17) 연필은 가운데로 작아졌다가, 틀이 끝점(오른쪽)부터
// 거꾸로 다시 그려지며(f19~28) 연필이 제자리로 돌아온다.
const EDIT_DRAW: Key[] = [[0, 1], [fr(8), 1, 'linear'], [fr(17), 0], [fr(19), 0, 'linear'], [fr(28), 1]]
const EDIT: IconSpec = {
  parts: [
    {
      node: 0,
      play: play({
        pathLength: EDIT_DRAW,
        pathOffset: [[0, 0], [fr(8), 0, 'linear'], [fr(17), 1], [fr(17.1), 1, 'linear'], [fr(19), 1, 'linear'], [fr(28), 0]],
        opacity: hiddenBetween(17, 19),
      }),
    },
    { node: 1, origin: [15, 9], play: play({ scale: [[0, 1], [fr(10), 1, 'linear'], [fr(15), 0.85], [fr(23), 0.85, 'linear'], [fr(28), 1]], x: [[0, 0], [fr(10), 0, 'linear'], [fr(15), -2], [fr(23), -2, 'linear'], [fr(28), 0]], y: [[0, 0], [fr(10), 0, 'linear'], [fr(15), 2], [fr(23), 2, 'linear'], [fr(28), 0]] }) },
  ],
}

/** edit */
export function EditIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="edit" spec={EDIT} />
}

// 연필 — 섰다가(f8~11) 반대로 누워 촉이 오른아래로 가고(f11~14) 왼아래에 글줄 두 개가 그어진다(f11~15).
// f26~29에 다시 서고 f29~33에 제자리로 눕는다(글줄은 그사이 걷힌다).
const EDIT_2: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, origin: [12, 12], play: play({ rotate: [[0, 0], [fr(8), 0, 'linear'], [fr(11), -45], [fr(14), -90], [fr(26), -90, 'linear'], [fr(29), -45], [fr(33), 0]], scale: [[0, 1], [fr(9), 1, 'linear'], [fr(14), 0.85], [fr(26), 0.85, 'linear'], [fr(33), 1]] }) },
    ...[18.8, 21.2].map((y, i) => ({
      shape: ['line', { x1: 3, y1: y, x2: 10 - i * 2, y2: y }] as const,
      play: play({ pathLength: [[0, 0], [fr(11 + i), 0, 'linear'], [fr(15 + i), 1], [fr(28), 1, 'linear'], [fr(33), 0]], opacity: shownBetween(11 + i, 33) }),
    })),
  ],
}

/** edit-2 */
export function Edit2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="edit-2" spec={EDIT_2} />
}
