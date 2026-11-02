import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import { ICON_NODES } from './icon-nodes'
import type { AnimatedIconProps, IconNode, IconSpec } from './icon-types'

// 영상 4~5줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]

// 영상의 아이콘 칸은 24 상자보다 사방 3씩 넓은 창(30×30)에서 잘린다 — 빠져나가는 움직임은 이 창 끝에서 사라진다.
const WINDOW: readonly IconNode[] = [['rect', { x: -3, y: -3, width: 30, height: 30 }]]

// 외겹 갈매기 — 반대쪽으로 5 물러섰다(f6~12, 살짝 튕김) 진행 방향으로 빠져나가고(f15~22),
// 반대편에서 굵은 복제본(선 2.4)이 들어와 f25에 멈춘 뒤 f30에 원래 굵기로 바뀐다. 영상 4개 아이콘 × 5주기 평균.
const WRAP_OUT = [0, 0.17, -0.18, -0.91, -2.04, -3.43, -4.54, -4.92, -4.54, -4.47, -4.1, -2.94, -0.62, 3.0, 7.76, 12.44, 15.97, 18.33, 20, 21]
const WRAP_IN = [-20.3, -19.6, -18.26, -16.36, -13.4, -9.65, -5.97, -3.0, -1.18, -0.28, 0]

function chevronWrap(node: IconNode, axis: 'x' | 'y', sign: 1 | -1): IconSpec {
  const out: Key[] = [...trace(5, WRAP_OUT.map((v) => v * sign)), [fr(28), 21 * sign, 'linear'], [fr(28.01), 0, 'linear']]
  return {
    overflow: true,
    parts: [
      { node: 0, clip: WINDOW, play: play({ [axis]: out }) },
      {
        shape: node,
        clip: WINDOW,
        attrs: { strokeWidth: 2.4 },
        play: play({
          [axis]: trace(15, WRAP_IN.map((v) => v * sign)),
          opacity: [[fr(16), 0], [fr(16.1), 1, 'linear'], [fr(29.5), 1, 'linear'], [fr(30.5), 0, 'linear']],
        }),
      },
    ],
  }
}

// 겹 갈매기 — 네 자리(앞 복제 · 원래 둘 · 뒤 복제)가 흐름 방향으로 차례로 켜졌다 꺼진다. 처음엔 둘 다 꺼지고(f5~8),
// 앞 복제(f11~19) → 원래 앞(f14~22) → 원래 뒤(f17~25) → 뒤 복제(f21~28) → 앞 복제(f23~31) 순으로 2~3프레임씩 번지며
// 켜졌다 꺼진 뒤, 원래 둘이 천천히 돌아온다(f28~41). 불투명도는 네 아이콘이 같다(영상 4개 × 5주기 평균).
const FLOW_OP = {
  s0: [0, 0.07, 0.48, 0.93, 0.95, 0.96, 0.96, 0.92, 0.5, 0.09, 0, 0, 0, 0.08, 0.49, 0.94, 0.96, 0.96, 0.95, 0.93, 0.51, 0.09, 0], // f10~
  s1: [1, 0.78, 0.26, 0, 0, 0, 0, 0, 0, 0.1, 0.5, 0.88, 0.95, 0.96, 0.95, 0.9, 0.52, 0.1, 0, 0, 0, 0, 0.05, 0.1, 0.21, 0.42, 0.6, 0.77, 0.89, 0.94, 0.97, 0.98, 0.98, 0.99, 0.99, 1], // f5~
  s2: [1, 0.77, 0.26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.16, 0.49, 0.88, 0.96, 0.96, 0.97, 0.92, 0.52, 0.1, 0, 0, 0, 0, 0.05, 0.14, 0.26, 0.43, 0.59, 0.77, 0.92, 0.96, 0.98, 0.98, 0.98, 0.99, 1], // f5~
  s3: [0, 0.07, 0.5, 0.9, 0.96, 0.96, 0.97, 0.77, 0.25, 0], // f20~
}

/** 켜져 있는 동안 자리마다 흐름 방향으로 조금씩 밀리는 양(아이콘마다 다르다) — s0a f11~, s0b f23~, s1 f14~, s2 f17~, s3 f21~, s1end f28~ */
interface FlowDrift {
  s0a: readonly number[]
  s0b: readonly number[]
  s1: readonly number[]
  s2: readonly number[]
  s3: readonly number[]
  s1end?: readonly number[]
}

function chevronsFlow(nodes: readonly IconNode[], axis: 'x' | 'y', sign: 1 | -1, drift: FlowDrift): IconSpec {
  // nodes[0]은 흐름 쪽(아래·왼쪽·위), nodes[1]은 거슬러 쪽 갈매기 — 복제는 그 바깥 7칸에 선다
  const at = (base: number, list: readonly number[]) => list.map((d) => (base + d) * sign)
  return {
    overflow: true,
    parts: [
      { node: 1, play: play({ [axis]: [...trace(14, at(0, drift.s1)), ...trace(drift.s1end ? 28 : 26, drift.s1end ?? [0])], opacity: trace(5, FLOW_OP.s1) }) },
      { node: 0, play: play({ [axis]: [...trace(17, at(0, drift.s2)), [fr(29), 0, 'linear']], opacity: trace(5, FLOW_OP.s2) }) },
      { shape: nodes[1], clip: WINDOW, play: play({ [axis]: [...trace(11, at(-7, drift.s0a)), ...trace(23, at(-7, drift.s0b))], opacity: trace(10, FLOW_OP.s0) }) },
      { shape: nodes[0], clip: WINDOW, play: play({ [axis]: trace(21, at(7, drift.s3)), opacity: trace(20, FLOW_OP.s3) }) },
    ],
  }
}

// 서류가방 — 툭 떨어졌다(f9~13) 17.8° 기울고(f13~16) 오른쪽으로 미끄러져 30칸 창 밖으로 나가고, 같은 가방이
// 왼쪽에서 기운 채 들어와(f22~28) 제자리로 서며 올라온다(f30~41). 회전+이동 추적값(영상 3주기).
const BRIEFCASE_TILT = trace(12, [0, 0.8, 6.8, 16, 17.5, 17.8, 18, 17.8, 17.8, 17.8, 18, 18, 18, 18, 18, 18, 17.5, 17.5, 17.5, 16.5, 15.5, 14, 9, 4, 2.3, 1.3, 0.8, 0])
const BRIEFCASE: IconSpec = {
  overflow: true,
  nodes: [
    ...ICON_NODES.briefcase,
    ['rect', { x: -28, y: 7, width: 20, height: 14, rx: 2, ry: 2 }],
    ['path', { d: 'M-14 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
  ],
  parts: [
    {
      clip: WINDOW,
      play: play({
        x: trace(12, [0, -0.15, -0.8, -1.9, -2.1, -2.15, -2, -1.65, -1, 0.17, 2.18, 6.9, 11.7, 16.4, 21.2, 24.5, 25.95, 27, 27.58, 27.95, 28.15, 28.4, 28.92, 29.47, 29.75, 29.82, 29.92, 29.97, 30]),
        y: trace(8, [0, 0.12, 0.35, 1.4, 2.75, 3.02, 2.9, 2.55, 2.48, 2.45, 2.42, 2.45, 2.27, 2.13, 1.88, 1.2, 0.4, -0.5, -1.3, -1.8, -2.02, -2, -2, -2, -1.95, -1.9, -1.77, -1.73, -1.7, -1.7, -1.63, -0.57, -0.1, 0]),
      }),
      parts: [
        { node: [0, 1], origin: [12, 12], play: play({ rotate: BRIEFCASE_TILT }) },
        { node: [2, 3], origin: [-18, 12], play: play({ rotate: BRIEFCASE_TILT }) },
      ],
    },
  ],
}

/** briefcase */
export function BriefcaseIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="briefcase" spec={BRIEFCASE} />
}

// 달력 — 0.8로 줄어든 뒤(f10~12.5) 맨 위 장(머리 칸)이 고리 위로 넘어갔다가(f14~19) 머물고, 다시 넘어와(f28~31)
// 제 크기로 돌아온다(f31.5~34). 넘기는 장은 위 끝(y 4) 기준 세로 배율로 옮긴 근사.
const CALENDAR: IconSpec = {
  parts: [
    {
      origin: [12, 13],
      play: play({ scale: [[0, 1], [fr(10), 1, 'linear'], [fr(12.5), 0.82], [fr(31.5), 0.82, 'linear'], [fr(34), 1]] }),
      parts: [
        { node: [0, 1, 2, 3] },
        {
          shape: ['rect', { x: 3, y: 4, width: 18, height: 6, rx: 2, ry: 2 }],
          origin: [12, 4],
          play: play({ scaleY: [[0, 1], [fr(13.5), 1, 'linear'], [fr(19), -0.85, 'easeInOut'], [fr(28), -0.85, 'linear'], [fr(31), 1, 'easeInOut']], opacity: shownBetween(13.5, 31) }),
        },
      ],
    },
  ],
}

/** calendar */
export function CalendarIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="calendar" spec={CALENDAR} />
}

// 카메라 — 몸을 옆으로 돌린다: 렌즈가 왼쪽으로 4 옮기고 몸통이 0.9배로 좁아지며, 오른쪽 위에 작은 점(뷰파인더)이
// 생겨 렌즈를 따라간다(f8~17). f34.5부터 되돌아온다(f43). 렌즈·점·몸통 덩어리 위치를 프레임마다 잼.
const CAMERA_TURN: Key[] = [[0, 0], [fr(9.5), 0, 'linear'], [fr(16.5), 1], [fr(34.5), 1, 'linear'], [fr(43), 0]]
const CAMERA: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: CAMERA_TURN.map(([t, v, e]) => [t, 1 - 0.1 * Number(v), e] as Key), x: CAMERA_TURN.map(([t, v, e]) => [t, -0.3 * Number(v), e] as Key) }) },
    { node: 1, play: play({ x: CAMERA_TURN.map(([t, v, e]) => [t, -4 * Number(v), e] as Key) }) },
    {
      shape: ['line', { x1: 18.2, y1: 9.3, x2: 18.21, y2: 9.3 }],
      play: play({ x: CAMERA_TURN.map(([t, v, e]) => [t, -3.4 * Number(v), e] as Key), opacity: shownBetween(7.9, 44.5) }),
    },
  ],
}

/** camera */
export function CameraIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="camera" spec={CAMERA} />
}

// 꺼진 카메라 — 사선이 왼위로 빨려 들며(f3~8.5) 끊긴 몸통이 온전한 카메라로 이어지고, 카메라처럼 옆으로 돌았다가
// (f9~16, f35~42) 사선이 다시 그어지며(f33.5~40) 도로 끊긴다(f35~36).
const CAMERA_OFF_TURN: Key[] = [[0, 0], [fr(9), 0, 'linear'], [fr(16), 1], [fr(35), 1, 'linear'], [fr(42.5), 0]]
const CAMERA_OFF: IconSpec = {
  parts: [
    { node: 0, play: play({ pathLength: [[0, 1], [fr(3), 1, 'linear'], [fr(8.5), 0, 'easeIn'], [fr(33.5), 0, 'linear'], [fr(40), 1, 'easeOut']], opacity: hiddenBetween(8.5, 33.5) }) },
    { node: 1, play: play({ opacity: hiddenBetween(7, 35.5) }) },
    {
      shape: ['path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }],
      origin: [12, 12],
      play: play({ scaleX: CAMERA_OFF_TURN.map(([t, v, e]) => [t, 1 - 0.1 * Number(v), e] as Key), x: CAMERA_OFF_TURN.map(([t, v, e]) => [t, -0.3 * Number(v), e] as Key), opacity: shownBetween(7, 35.5) }),
    },
    { shape: ['circle', { cx: 12, cy: 13, r: 4 }], play: play({ x: CAMERA_OFF_TURN.map(([t, v, e]) => [t, -4 * Number(v), e] as Key), opacity: shownBetween(7, 35.5) }) },
    { shape: ['line', { x1: 18.2, y1: 9.3, x2: 18.21, y2: 9.3 }], play: play({ x: CAMERA_OFF_TURN.map(([t, v, e]) => [t, -3.4 * Number(v), e] as Key), opacity: shownBetween(7.9, 43) }) },
  ],
}

/** camera-off */
export function CameraOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="camera-off" spec={CAMERA_OFF} />
}

// 캐스트 — 신호 점·안쪽 호·바깥 호가 차례로 흐려졌다 켜지기를 두 번(f10~60). 띠마다 밝기 질량을 프레임마다 잰 값.
const CAST: IconSpec = {
  nodes: [
    ['path', { d: 'M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6' }],
    ['path', { d: 'M2 16.1A5 5 0 0 1 5.9 20' }],
    ['path', { d: 'M2 12.05A9 9 0 0 1 9.95 20' }],
    ['line', { x1: 2, y1: 20, x2: 2.01, y2: 20 }],
  ],
  parts: [
    { node: 3, play: play({ opacity: trace(9, [1, 0.95, 0.75, 0.61, 0.35, 0.16, 0.05, 0, 0, 0, 0, 0, 0.09, 0.26, 0.45, 0.68, 0.77, 0.86, 0.93, 1, 0.88, 0.81, 0.69, 0.55, 0.4, 0.24, 0.11, 0.04, 0.02, 0.01, 0, 0, 0.11, 0.25, 0.26, 0.3, 0.34, 0.38, 0.41, 0.45, 0.5, 0.65, 0.88, 1]) }) },
    { node: 1, play: play({ opacity: trace(11, [1, 0.93, 0.81, 0.6, 0.47, 0.36, 0.23, 0.1, 0.04, 0, 0, 0, 0, 0, 0.12, 0.26, 0.41, 0.55, 0.71, 0.89, 0.88, 0.92, 0.91, 0.89, 0.85, 0.81, 0.6, 0.39, 0.12, 0.06, 0.02, 0, 0, 0, 0.03, 0.1, 0.17, 0.24, 0.35, 0.52, 0.77, 0.91, 0.95, 1]) }) },
    { node: 2, play: play({ opacity: trace(12, [1, 0.82, 0.73, 0.65, 0.64, 0.63, 0.62, 0.61, 0.61, 0.49, 0.32, 0.12, 0, 0, 0, 0, 0, 0.03, 0.13, 0.25, 0.38, 0.52, 0.65, 0.79, 0.92, 0.93, 0.94, 0.94, 0.87, 0.69, 0.52, 0.31, 0.12, 0, 0, 0, 0, 0, 0.05, 0.08, 0.22, 0.35, 0.47, 0.6, 0.73, 0.87, 0.92, 0.95, 0.98, 1]) }) },
  ],
}

/** cast */
export function CastIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="cast" spec={CAST} />
}

// 막대그래프 — 짧은 막대부터 차례로 바닥으로 툭 떨어졌다(점이 됨) 튀어 오르듯 다시 자란다(f14~38). 막대 끝 위치를 프레임마다 잼.
const BAR_CHART: IconSpec = {
  parts: [
    { node: 2, play: play({ y2: trace(14, [16, 17.5, 19.2, 19.25, 19.35, 19.3, 19.2, 18.35, 17.6, 16.85, 16.35, 16.2, 16.1, 16]) }) },
    { node: 0, play: play({ y2: trace(19, [10, 10.1, 10.35, 10.72, 18.98, 19.48, 18.85, 18.48, 17.48, 15.97, 13.97, 12.35, 11.22, 10.35, 10.22, 10]) }) },
    { node: 1, play: play({ y2: trace(20, [4, 4, 4, 4.1, 4.22, 4.6, 17.98, 19.48, 19.48, 18.35, 17.73, 16.23, 13.35, 10.35, 7.85, 5.97, 4.97, 4.47, 4]) }) },
  ],
}

/** bar-chart */
export function BarChartIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="bar-chart" spec={BAR_CHART} />
}

// 막대그래프 2 — 왼쪽 → 가운데 → 오른쪽 차례로 떨어졌다 다시 자란다(f15~43).
const BAR_CHART_2: IconSpec = {
  parts: [
    { node: 2, play: play({ y2: trace(15, [14.25, 14.37, 14.37, 14.5, 14.75, 19.13, 19.25, 19.25, 18.88, 18.63, 17.75, 16.38, 15.5, 14.87, 14.5, 14.25, 14.12, 14]) }) },
    { node: 1, play: play({ y2: trace(20, [4, 4.13, 4.25, 4.25, 4.5, 4.75, 12.6, 19.25, 19.13, 17.75, 17.63, 15.75, 12.87, 9.75, 7.37, 5.62, 4.75, 4.13, 4]) }) },
    { node: 0, play: play({ y2: trace(25, [10, 10.12, 10.12, 10.25, 10.5, 19.13, 19.25, 19.5, 19.5, 19, 18, 16.5, 14.75, 12.87, 11.62, 10.87, 10.37, 10.12, 10]) }) },
  ],
}

/** bar-chart-2 */
export function BarChart2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="bar-chart-2" spec={BAR_CHART_2} />
}

// 체크 — 긴 획이 꼭짓점 쪽으로 빨려 들어 작은 체크가 됐다가(f11.5~15) 머물고, 다시 뻗는다(f28~31).
const CHECK: IconSpec = {
  parts: [{ node: 0, play: play({ pathOffset: [[0, 0], [fr(11.5), 0, 'linear'], [fr(15), 0.48, 'easeOut'], [fr(28), 0.48, 'linear'], [fr(31), 0, 'easeOut']] }) }],
}

/** check */
export function CheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="check" spec={CHECK} />
}

// 체크 원 — 체크가 왼쪽 끝 작은 점까지 빨려 들면서(f12~17) 원의 틈(오른쪽 위)이 메워져 온전한 원이 되고,
// f28~31에 체크가 다시 뻗으며 틈이 열린다.
const CHECK_CIRCLE: IconSpec = {
  parts: [
    { node: 1, play: play({ pathOffset: [[0, 0], [fr(12), 0, 'linear'], [fr(17), 0.9, 'easeOut'], [fr(28), 0.9, 'linear'], [fr(31), 0, 'easeOut']] }) },
    { shape: ['path', { d: 'M16.07 2.86A10 10 0 0 1 22 12' }], play: play({ pathLength: [[0, 0], [fr(12.5), 0, 'linear'], [fr(16.5), 1], [fr(28), 1, 'linear'], [fr(30.5), 0]], opacity: shownBetween(12.5, 30.5) }) },
  ],
}

/** check-circle */
export function CheckCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="check-circle" spec={CHECK_CIRCLE} />
}

// 체크 상자 — 체크가 짧은 획 쪽 작은 점까지 줄어들며(f12~17) 상자의 열린 오른쪽 위 모서리가 닫히고, f28~31에 되돌아온다.
const CHECK_SQUARE: IconSpec = {
  parts: [
    { node: 0, play: play({ pathLength: [[0, 1], [fr(12), 1, 'linear'], [fr(17), 0.12, 'easeOut'], [fr(28), 0.12, 'linear'], [fr(31), 1, 'easeOut']] }) },
    { shape: ['path', { d: 'M16 3h3a2 2 0 0 1 2 2v7' }], play: play({ pathLength: [[0, 0], [fr(12.5), 0, 'linear'], [fr(16.5), 1], [fr(28.5), 1, 'linear'], [fr(31), 0]], opacity: shownBetween(12.5, 31) }) },
  ],
}

/** check-square */
export function CheckSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="check-square" spec={CHECK_SQUARE} />
}

const CHEVRON_DOWN = chevronWrap(ICON_NODES['chevron-down'][0], 'y', 1)

/** chevron-down */
export function ChevronDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevron-down" spec={CHEVRON_DOWN} />
}

const CHEVRON_LEFT = chevronWrap(ICON_NODES['chevron-left'][0], 'x', -1)

/** chevron-left */
export function ChevronLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevron-left" spec={CHEVRON_LEFT} />
}

const CHEVRON_RIGHT = chevronWrap(ICON_NODES['chevron-right'][0], 'x', 1)

/** chevron-right */
export function ChevronRightIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevron-right" spec={CHEVRON_RIGHT} />
}

const CHEVRONS_DOWN = chevronsFlow(ICON_NODES['chevrons-down'], 'y', 1, {
  s0a: [0.5, 0.5, 0.51, 0.53, 0.6, 0.62, 0.67, 0.73, 0.76],
  s0b: [0.88, 0.88, 0.84, 0.7, 0.65, 0.5, 0.47, 0.48, 0.48],
  s1: [-0.05, 0.1, 0.18, 0.27, 0.38, 0.57, 0.88, 1.44, 1.44],
  s2: [0.32, 0.46, 0.61, 0.93, 1.45, 1.45, 0.99, 0.8, 0.69],
  s3: [0.8, 0.76, 0.28, -0.08, -0.3, -0.44, -0.5, -0.56],
})

/** chevrons-down */
export function ChevronsDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevrons-down" spec={CHEVRONS_DOWN} />
}

const CHEVRONS_LEFT = chevronsFlow(ICON_NODES['chevrons-left'], 'x', -1, {
  s0a: [1.03, 1.03, 1.05, 1.15, 1.24, 1.27, 1.27, 1.27, 1.27],
  s0b: [1.29, 1.29, 1.29, 1.27, 1.23, 1.2, 1.15, 1.07, 1.07],
  s1: [0.44, 0.74, 0.79, 0.81, 0.82, 0.83, 0.84, 0.86, 0.88],
  s2: [0.67, 0.81, 0.84, 0.84, 0.83, 0.8, 0.79, 0.81, 0.77],
  s3: [0.05, 0.05, 0.05, 0.01, 0.01, 0.02, -0.01, -0.06],
  s1end: [0.6, 0.48, 0.3, 0.24, 0.18, 0.11, 0.1, 0.06, 0.04, 0],
})

/** chevrons-left */
export function ChevronsLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevrons-left" spec={CHEVRONS_LEFT} />
}

// 위로 흐르는 두 칸(6·7칸)은 영상에서 움직임이 같다(두 칸 × 5주기 평균) — 같은 흐름을 쓴다
const CHEVRONS_UP_FLOW: FlowDrift = {
  s0a: [0.43, 0.43, 0.43, 0.44, 0.43, 0.43, 0.41, 0.34, 0.34],
  s0b: [0.17, 0.17, 0.16, 0.32, 0.4, 0.46, 0.48, 0.49, 0.49],
  s1: [-0.15, -0.15, -0.13, -0.2, -0.24, -0.34, -0.55, -1.04, -1.04],
  s2: [-0.3, -0.3, -0.32, -0.57, -1, -1.11, -0.69, -0.55, -0.37],
  s3: [-1.85, -1.85, -1.42, -1.17, -1.05, -0.85, -0.79, -0.77],
}

const CHEVRONS_UP = chevronsFlow(ICON_NODES['chevrons-up'], 'y', -1, CHEVRONS_UP_FLOW)

/** chevrons-up */
export function ChevronsUpIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevrons-up" spec={CHEVRONS_UP} />
}

const CHEVRONS_UP_2 = chevronsFlow(ICON_NODES['chevrons-up'], 'y', -1, CHEVRONS_UP_FLOW)

/** chevrons-up — 영상 5줄 7칸(6칸과 같은 모양이지만 움직임이 다를 수 있어 따로 둔다) */
export function ChevronsUp2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevrons-up" spec={CHEVRONS_UP_2} />
}

const CHEVRON_UP = chevronWrap(ICON_NODES['chevron-up'][0], 'y', -1)

/** chevron-up */
export function ChevronUpIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chevron-up" spec={CHEVRON_UP} />
}

// 크롬 — 안쪽 무늬(세 획)가 반시계로 120°씩 두 번 돈다(f7~22, f34~60, 사이에 멈춤). 세 획이 120° 대칭이라
// 끝나면 처음과 같은 모양. 영상은 회전 중 획 길이도 조금 바뀌는데 그건 옮기지 않은 근사.
const CHROME: IconSpec = {
  parts: [{ node: [2, 3, 4], origin: [12, 12], play: play({ rotate: [[0, 0], [fr(7), 0, 'linear'], [fr(22), -120], [fr(34), -120, 'linear'], [fr(60), -240]] }) }],
}

/** chrome */
export function ChromeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chrome" spec={CHROME} />
}

// 클립보드 — 왼쪽에 글머리 점이 찍히고(f9~11) 줄이 그어져 목록이 되고(f12~15), 판 전체가 아래 끝 기준으로
// 납작해져 쟁반처럼 됐다가(f14~24) 머물고, 다시 서며(f34~37) 목록이 오른쪽으로 걷혀 사라진다(f37~41).
const CLIP_LIST = [10, 13.5, 17]
const CLIPBOARD: IconSpec = {
  parts: [
    {
      origin: [12, 22],
      play: play({ scaleY: [[0, 1], [fr(14), 1, 'linear'], [fr(24), 0.5], [fr(34), 0.5, 'linear'], [fr(37), 1]] }),
      parts: [
        { node: [0, 1] },
        ...CLIP_LIST.map((y, i) => ({ shape: ['line', { x1: 8, y1: y, x2: 8.01, y2: y }] as const, play: play({ opacity: shownBetween(9 + i * 0.7, 40.5) }) })),
        ...CLIP_LIST.map((y, i) => ({
          shape: ['line', { x1: 10.5, y1: y, x2: 16, y2: y }] as const,
          play: play({ pathLength: [[0, 0], [fr(11.5 + i * 0.6), 0, 'linear'], [fr(14.5 + i * 0.6), 1], [fr(37), 1, 'linear'], [fr(40), 0]], pathOffset: [[0, 0], [fr(37), 0, 'linear'], [fr(40), 1]], opacity: shownBetween(11.5 + i * 0.6, 40) }),
        })),
      ],
    },
  ],
}

/** clipboard */
export function ClipboardIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="clipboard" spec={CLIPBOARD} />
}
