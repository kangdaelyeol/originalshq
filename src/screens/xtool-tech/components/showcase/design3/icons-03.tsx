import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import { ICON_NODES } from './icon-nodes'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 4~5줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]

// 영상의 아이콘 칸은 24 상자보다 사방 3씩 넓은 창(30×30)에서 잘린다 — 빠져나가는 움직임은 이 창 끝에서 사라진다.
const WINDOW: readonly IconNode[] = [['rect', { x: -3, y: -3, width: 30, height: 30 }]]

// 외겹 갈매기 — 반대쪽으로 5 물러섰다(f6~12, 살짝 튕김) 진행 방향으로 빠져나가고(f15~22),
// 반대편에서 굵은 복제본(선 1.45배)이 들어와 f25에 멈춘 뒤 f30에 원래 굵기로 바뀐다. 영상 4개 아이콘 × 5주기 평균.
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
        stroke: 1.45,
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
      // 첫 키 값은 지연 동안에도 보이므로(motion) 꺼져 있는 f8부터 밀린 자리로 옮긴다
      { node: 1, play: play({ [axis]: [[0, 0], [fr(8), 0, 'linear'], ...trace(14, at(0, drift.s1)), ...trace(drift.s1end ? 28 : 26, at(0, drift.s1end ?? [0]))], opacity: trace(5, FLOW_OP.s1) }) },
      { node: 0, play: play({ [axis]: [[0, 0], [fr(8), 0, 'linear'], ...trace(17, at(0, drift.s2)), [fr(29), 0, 'linear']], opacity: trace(5, FLOW_OP.s2) }) },
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

// 달력 — (12,17.7) 기준 0.8배로 줄고(f10~12) 맨 앞 장이 위 끝(경첩)을 축으로 넘어간다: 아래 끝이 올라와(f11~16)
// 경첩을 지나 위로 젖혀지고(f17~22) 머물다 더 넘어가 사라진 뒤(f26~33) 제 크기로(f33~35). 넘어가는 장은 옆선·끝선과
// 머리줄 하나(장 길이의 0.3~0.5 자리)로 그린다. 장 [끝 y, 경첩 y, 머리줄 비율]은 영상에서 프레임마다 맞춘 값.
const CALENDAR_PAGE: readonly (readonly number[])[] = [[20.92, 4, 0.31], [20.05, 4, 0.27], [18.04, 4, 0.3], [15.28, 4, 0.21], [10.67, 4, 0.27], [3.74, 5.6, 0.04], [1.39, 4.07, 0.66], [-1.62, 4.57, 0.56], [-3.3, 3.49, 0.46], [-4.51, 3.31, 0.42], [-5.15, 3.67, 0.46], [-5.45, 3.7, 0.46], [-5.45, 3.7, 0.46], [-5.45, 3.7, 0.46], [-5.3, 3.66, 0.47], [-5.03, 3.25, 0.47], [-4.47, 3.56, 0.48], [-3.58, 3.62, 0.45], [-1.83, 4.08, 0.46], [0.32, 4.32, 0.52], [2.02, 4.33, 0.45], [2.84, 6.84, 0.66], [3.37, 8.77, 0.01]] // f11~33
const calendarPage = ([edge, hinge, band]: readonly number[]) => {
  const q = (v: number) => Math.round(v * 100) / 100, dir = edge > hinge ? 1 : -1, r = Math.min(2, Math.abs(edge - hinge) / 2)
  return `M3 ${q(hinge)}V${q(edge - dir * r)}Q3 ${q(edge)} ${q(3 + r)} ${q(edge)}H${q(21 - r)}Q21 ${q(edge)} 21 ${q(edge - dir * r)}V${q(hinge)}M3 ${q(hinge + (edge - hinge) * band)}H21`
}
const CALENDAR: IconSpec = {
  overflow: true,
  parts: [
    {
      origin: [12, 17.7],
      clip: WINDOW,
      play: play({ scale: trace(9, [1, 0.99, 0.91, 0.81, ...Array<number>(20).fill(0.8), 0.83, 0.97, 1]) }),
      parts: [
        { node: [0, 1, 2, 3] },
        { shape: ['path', { d: calendarPage(CALENDAR_PAGE[0]) }], play: play({ d: trace(11, CALENDAR_PAGE.map(calendarPage)), opacity: shownBetween(10.5, 33.5) }) },
      ],
    },
  ],
}

/** calendar */
export function CalendarIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="calendar" spec={CALENDAR} />
}

// 카메라 — 몸을 옆으로 돌린다: 렌즈가 왼쪽으로 3.96 옮기고 몸통이 가운데 기준 0.886배로 좁아지며 0.34 왼쪽으로,
// 오른쪽 위에 작은 점(뷰파인더)이 생겨(f8) 3.3칸 따라간다(f9~17). f34부터 되돌아오고(f44) 점이 사라진다(f44.5).
// 렌즈 원 중심을 프레임마다 잰 진행도(영상 3주기 평균)로 몸통·점도 같이 움직인다.
const CAMERA_TURN = [0, 0.063, 0.139, 0.295, 0.497, 0.699, 0.846, 0.939, 1] // f9~17
const CAMERA_BACK = [1, 0.957, 0.879, 0.76, 0.591, 0.422, 0.26, 0.124, 0.058, 0.01, 0] // f34~44
const turnTrack = (amount: number, turn: readonly number[], back: readonly number[], at: readonly [number, number], base = 0): Key[] => [
  ...trace(at[0], turn.map((v) => Math.round((base + amount * v) * 1000) / 1000)),
  ...trace(at[1], back.map((v) => Math.round((base + amount * v) * 1000) / 1000)),
]
const CAMERA: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: turnTrack(-0.114, CAMERA_TURN, CAMERA_BACK, [9, 34], 1), x: turnTrack(-0.34, CAMERA_TURN, CAMERA_BACK, [9, 34]) }) },
    { node: 1, play: play({ x: turnTrack(-3.96, CAMERA_TURN, CAMERA_BACK, [9, 34]) }) },
    { shape: ['line', { x1: 18.2, y1: 9.3, x2: 18.21, y2: 9.3 }], play: play({ x: turnTrack(-3.31, CAMERA_TURN, CAMERA_BACK, [9, 34]), opacity: shownBetween(7.9, 44.5) }) },
  ],
}

/** camera */
export function CameraIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="camera" spec={CAMERA} />
}

// 꺼진 카메라 — 사선이 (23,23) 끝부터 (1,1)로 빨려 들고(f5~12, f7~9에 확) 그사이(f6.5) 끊긴 몸통·렌즈 호가 온전한
// 카메라로 바뀐 뒤, 카메라처럼 옆으로 돈다(f9~17). 돌아오기 시작할 무렵(f35.5) 다시 끊긴 모양으로 바뀌고 사선이
// (1,1)에서 다시 그어진다(f31.5~40, f35~37에 확). 사선 길이·렌즈 위치를 프레임마다 잰 값(영상 4주기 평균).
const CAMERA_OFF_TURN = [0, 0.034, 0.12, 0.28, 0.484, 0.68, 0.84, 0.945, 1] // f9~17
const CAMERA_OFF_BACK = [1, 0.97, 0.84, 0.67, 0.55, 0.4, 0.25, 0.12, 0.05, 0] // f34~43
const camOffTurn = (amount: number, base = 0) => turnTrack(amount, CAMERA_OFF_TURN, CAMERA_OFF_BACK, [9, 34], base)
const CAMERA_OFF: IconSpec = {
  nodes: [
    ['line', { x1: 1, y1: 1, x2: 23, y2: 23 }],
    ['path', { d: 'M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34' }],
    ['path', { d: 'M15.28 15.28a4 4 0 1 1-5.56-5.56' }],
    ['path', { d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }],
    ['circle', { cx: 12, cy: 13, r: 4 }],
  ],
  parts: [
    {
      node: 0,
      play: play({
        pathLength: [...trace(5, [1, 0.949, 0.911, 0.492, 0.105, 0.039, 0.015, 0.003]), ...trace(31, [0, 0.001, 0.01, 0.021, 0.072, 0.234, 0.867, 0.912, 0.959, 1])],
        opacity: hiddenBetween(12.5, 31.4),
      }),
    },
    {
      // 몸통 — 끊긴 몸통과 온전한 몸통을 바꿔 끼우고, 둘 다 같이 돈다
      origin: [12, 12],
      play: play({ scaleX: camOffTurn(-0.117, 1), x: camOffTurn(-0.22) }),
      parts: [
        { node: 1, play: play({ opacity: hiddenBetween(6.5, 35.5) }) },
        { node: 3, play: play({ opacity: shownBetween(6.5, 35.5) }) },
      ],
    },
    {
      // 렌즈 — 끊긴 호와 온전한 원
      play: play({ x: camOffTurn(-3.82) }),
      parts: [
        { node: 2, play: play({ opacity: hiddenBetween(6.5, 35.5) }) },
        { node: 4, play: play({ opacity: shownBetween(6.5, 35.5) }) },
      ],
    },
    { shape: ['line', { x1: 18.3, y1: 9.3, x2: 18.31, y2: 9.3 }], play: play({ x: camOffTurn(-3.44), opacity: shownBetween(7.9, 43.5) }) },
  ],
}

/** camera-off */
export function CameraOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="camera-off" spec={CAMERA_OFF} />
}

// 캐스트 — 아이콘 전체가 오른쪽으로 1.4 밀렸다(f9~16) 왼쪽 0.7로 되튀고(f18~25) 제자리로(f28~33) 흔들리기를 두 번
// (f39~63) 하는 동안, 신호 점 → 작은 호 → 큰 호가 차례로 꺼졌다(f10~26) 켜지고(f20~37), 다시 꺼졌다(f30~46)
// 켜진다(f39~61). 전체 이동과 셋의 밝기를 프레임마다 잰 값(영상 3주기 평균, 틀까지 넣은 모형 맞춤).
const CAST_SHAKE = [0, 0.16, 0.31, 0.56, 0.88, 1.18, 1.28, 1.41, 1.41, 1.41, 1.18, 1.03, 0.61, 0.13, -0.29, -0.49, -0.72, -0.72, -0.72, -0.72, -0.49, -0.32, -0.19, -0.02, 0]
const CAST: IconSpec = {
  nodes: [
    ['path', { d: 'M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6' }],
    ['path', { d: 'M2 16.1A5 5 0 0 1 5.9 20' }],
    ['path', { d: 'M2 12.05A9 9 0 0 1 9.95 20' }],
    ['line', { x1: 2, y1: 20, x2: 2.01, y2: 20 }],
  ],
  parts: [
    {
      play: play({ x: [...trace(9, CAST_SHAKE), ...trace(39, CAST_SHAKE)] }),
      parts: [
        { node: 0 },
        { node: 3, play: play({ opacity: trace(9, [1, 0.94, 0.75, 0.67, 0.48, 0.37, 0.24, 0.1, 0.07, 0.01, 0.01, 0.03, 0.17, 0.33, 0.46, 0.57, 0.69, 0.8, 0.83, 0.87, 0.8, 0.8, 0.71, 0.58, 0.47, 0.34, 0.25, 0.11, 0.08, 0.03, 0.07, 0.1, 0.17, 0.36, 0.47, 0.66, 0.76, 0.9, 0.91, 0.94, 0.93, 0.93, 0.97, 0.95, 0.97, 0.96, 0.98, 1]) }) },
        { node: 1, play: play({ opacity: trace(9, [1, 0.99, 0.97, 0.98, 0.96, 0.9, 0.77, 0.61, 0.45, 0.27, 0.14, 0.07, 0.03, 0.03, 0.07, 0.13, 0.26, 0.37, 0.5, 0.63, 0.73, 0.88, 0.92, 0.95, 0.95, 0.92, 0.89, 0.78, 0.61, 0.45, 0.26, 0.1, 0.07, 0.03, 0.04, 0.07, 0.1, 0.22, 0.35, 0.47, 0.6, 0.73, 0.85, 0.92, 0.96, 0.96, 0.99, 1]) }) },
        { node: 2, play: play({ opacity: trace(9, [1, 0.98, 0.97, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 0.97, 0.91, 0.78, 0.6, 0.43, 0.21, 0.1, 0.01, 0, 0.01, 0.01, 0.13, 0.24, 0.35, 0.48, 0.59, 0.72, 0.81, 0.91, 0.93, 0.94, 0.93, 0.91, 0.75, 0.59, 0.42, 0.26, 0.1, 0.01, 0.01, 0.01, 0.04, 0.1, 0.19, 0.29, 0.42, 0.52, 0.67, 0.78, 0.88, 0.93, 0.95, 0.98, 1]) }) },
      ],
    },
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

// 체크 원 — 원만 가운데 기준 0.8로 오그라들며(f11~15, f13에 확) 원의 틈(오른쪽 위)이 양 끝에서 가운데로 메워져
// 온전한 원이 되고(f11~17), 체크는 크기 그대로 긴 획 끝부터 짧은 획 끝 점까지 걷힌다(f11~23). f26~32에 거꾸로
// 다시 그어지고 원이 펴지며 틈이 열린다(f29~32). 원 배율·틈·체크 시작점을 프레임마다 잰 값(영상 3주기 평균).
const CHECK_CIRCLE_GAP: Key[] = [...trace(10, [0, 0.03, 0.1, 0.2, 0.45, 0.68, 0.83, 0.92, 1]), ...trace(28, [1, 0.85, 0.25, 0.1, 0])]
const CHECK_CIRCLE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [...trace(10, [1, 0.99, 0.97, 0.835, 0.814, 0.804]), ...trace(28, [0.804, 0.819, 0.905, 0.985, 0.995, 1])] }),
      parts: [
        { node: 0 },
        // 틈 메우기 — 호 끝(16.07,2.86)과 시작(22,11.08)에서 틈 가운데(20.13,6.17)로
        { shape: ['path', { d: 'M16.07 2.86A10 10 0 0 1 20.13 6.17' }], play: play({ pathLength: CHECK_CIRCLE_GAP }) },
        { shape: ['path', { d: 'M22 11.08A10 10 0 0 0 20.13 6.17' }], play: play({ pathLength: CHECK_CIRCLE_GAP }) },
      ],
    },
    {
      // 체크 — pathOffset은 pathLength가 같이 있어야 대시가 생긴다
      node: 1,
      play: play({
        pathLength: [[0, 1], [fr(33), 1, 'linear']],
        pathOffset: [...trace(10, [0, 0.01, 0.04, 0.11, 0.17, 0.25, 0.4, 0.57, 0.74, 0.84, 0.9, 0.94, 0.96, 0.98, 0.98, 0.97, 0.9, 0.82, 0.62, 0.33, 0.14, 0.04, 0.01, 0])],
      }),
    },
  ],
}

/** check-circle */
export function CheckCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="check-circle" spec={CHECK_CIRCLE} />
}

// 체크 상자 — 상자만 가운데 기준 0.85로 오그라들며(f11~15) 열린 오른쪽 위 모서리가 양 끝에서 가운데로 메워지고
// (f13~15), 체크는 크기 그대로 긴 획 끝부터 짧은 획 첫머리 2칸만 남을 때까지 걷힌다(f10~22). f29~34에 거꾸로.
// 상자 배율·틈·체크 길이를 프레임마다 잰 값(영상 3주기 평균).
const CHECK_SQUARE_GAP: Key[] = [...trace(12, [0, 0.1, 0.5, 0.93, 1]), ...trace(28, [1, 0.93, 0.18, 0])]
const CHECK_SQUARE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [...trace(10, [1, 0.995, 0.98, 0.87, 0.855, 0.85]), ...trace(28, [0.85, 0.86, 0.925, 0.995, 1])] }),
      parts: [
        { node: 1 },
        // 틈(16,3 → 모서리 → 21,12)의 가운데는 (21,5.43)
        { shape: ['path', { d: 'M16 3h3a2 2 0 0 1 2 2v.43' }], play: play({ pathLength: CHECK_SQUARE_GAP }) },
        { shape: ['path', { d: 'M21 12V5.43' }], play: play({ pathLength: CHECK_SQUARE_GAP }) },
      ],
    },
    { node: 0, play: play({ pathLength: [...trace(9, [1, 0.99, 0.95, 0.9, 0.83, 0.73, 0.61, 0.5, 0.38, 0.29, 0.21, 0.17, 0.13, 0.11]), ...trace(28, [0.11, 0.12, 0.22, 0.42, 0.7, 0.9, 1])] }) },
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

// 크롬 — 안쪽 원(눈동자)이 왼위(f9~15) → 오른위(f21~25) → 왼아래(f33~39) → 오른아래(f44~49)로 옮겨 다니다 가운데로
// 돌아오며(f56~66) 1.1배로 커지고, 세 날은 바깥 원 위 끝점이 조금씩 돌면서 늘 눈동자에 접한다(접선).
// 눈동자 중심·반지름과 날마다 바깥 끝 각도를 프레임마다 잰 값(영상 4주기 평균, f5~66) — 접점은 그 둘로 계산한다.
const CHROME_CX = [0, -0.05, -0.11, -0.12, -0.28, -0.48, -0.79, -0.91, -0.96, -1.01, -1.04, -1.04, -1.04, -1.04, -1.05, -1.04, -0.83, -0.54, 0.44, 0.94, 1.16, 1.16, 1.16, 1.16, 1.16, 1.17, 1.17, 1.17, 1.05, 0.91, 0.5, -0.32, -0.63, -0.84, -0.92, -0.95, -0.95, -0.95, -0.95, -0.84, -0.57, 0.16, 0.88, 1.01, 1.21, 1.24, 1.24, 1.24, 1.24, 1.24, 1.24, 1.22, 1.21, 1.12, 1.02, 0.79, 0.47, 0.3, 0.13, 0.06, 0.01, 0]
const CHROME_CY = [0, -0.03, -0.06, -0.09, -0.36, -0.69, -0.94, -1.21, -1.31, -1.4, -1.45, -1.46, -1.46, -1.46, -1.46, -1.46, -1.45, -1.45, -1.46, -1.47, -1.45, -1.45, -1.45, -1.45, -1.45, -1.45, -1.45, -1.45, -1.23, -1.11, -0.45, 0.36, 1, 1.08, 1.22, 1.22, 1.22, 1.22, 1.22, 1.22, 1.19, 1.22, 1.23, 1.24, 1.24, 1.24, 1.24, 1.24, 1.24, 1.24, 1.24, 1.24, 1.2, 1.19, 1.07, 0.77, 0.55, 0.21, 0.08, 0.05, 0.02, 0]
const CHROME_R = [4, 4.06, 4.09, 4.09, 4.19, 4.19, 4.21, 4.29, 4.29, 4.32, 4.34, 4.37, 4.37, 4.37, 4.37, 4.37, 4.39, 4.39, 4.39, 4.37, 4.37, 4.37, 4.37, 4.37, 4.37, 4.37, 4.37, 4.37, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.39, 4.37, 4.32, 4.32, 4.29, 4.24, 4.19, 4.19, 4.09, 4.09, 4.04, 4]
const CHROME_RIM = [
  [0, -0.28, -0.53, -1.03, -4.53, -6.03, -10.53, -11.28, -15.03, -15.53, -15.53, -15.53, -15.53, -15.53, -15.53, -15.53, -14.78, -8.28, 0.47, 2.97, 4.47, 4.47, 4.47, 4.47, 4.47, 4.72, 4.72, 4.72, 4.22, 4.22, 1.72, 0.22, -1.53, -1.78, -2.03, -2.03, -2.03, -2.03, -2.03, -2.78, -5.53, -11.28, -16.53, -17.53, -18.53, -18.53, -18.53, -18.53, -18.53, -18.53, -18.53, -18.53, -17.78, -17.03, -14.53, -12.03, -7.28, -2.03, -1.28, -0.53, -0.03, 0],
  [0, -0.12, -0.62, -1.12, -3.12, -6.12, -8.37, -9.62, -10.37, -11.12, -11.37, -11.37, -11.62, -11.62, -11.62, -11.37, -11.12, -8.12, -1.37, 3.13, 4.63, 4.63, 4.63, 4.63, 4.63, 4.63, 4.63, 4.63, 4.63, 3.63, 1.88, -0.62, -1.62, -2.12, -2.12, -2.12, -2.12, -2.37, -2.62, -3.37, -6.37, -13.37, -20.87, -22.62, -24.62, -24.87, -24.87, -24.87, -24.87, -24.87, -24.62, -24.37, -23.37, -21.87, -19.37, -14.87, -7.87, -3.87, -2.12, -0.87, -0.12, 0],
  [0, -0.31, -1.31, -1.81, -4.31, -7.31, -11.06, -13.06, -14.06, -14.56, -15.06, -15.06, -15.31, -15.31, -15.31, -15.31, -13.81, -9.31, -0.06, 5.19, 5.94, 6.19, 6.19, 6.19, 6.19, 6.19, 6.19, 5.94, 5.94, 5.44, 2.94, 0.19, -1.06, -1.81, -2.06, -2.06, -2.06, -2.06, -2.31, -3.06, -5.56, -10.31, -15.31, -17.56, -18.06, -18.31, -18.31, -18.31, -18.31, -18.31, -18.31, -18.31, -17.81, -16.81, -15.31, -12.56, -7.81, -3.31, -2.06, -1.06, -0.31, 0],
]
const CHROME_RIM0 = [-23.57, -143.59, 96.43] // 쉬는 바깥 끝 각도(도, 시계 방향 +)
const CHROME_TAN0 = [-90, 150, 30] // 쉬는 접점 각도

/** 바깥 점 (px,py)에서 원(cx,cy,r)에 그은 두 접선 중 hint 각도 쪽 접점 */
function tangentPoint(px: number, py: number, cx: number, cy: number, r: number, hint: number): [number, number] {
  const base = Math.atan2(py - cy, px - cx), spread = Math.acos(Math.min(1, r / Math.hypot(px - cx, py - cy)))
  const h = (hint * Math.PI) / 180
  const miss = (a: number) => Math.abs(Math.atan2(Math.sin(a - h), Math.cos(a - h)))
  const a = miss(base + spread) < miss(base - spread) ? base + spread : base - spread
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function chromeBlade(k: number): IconPart {
  const ends = CHROME_RIM[k].map((d, i) => {
    const a = ((CHROME_RIM0[k] + d) * Math.PI) / 180
    const px = 12 + 10 * Math.cos(a), py = 12 + 10 * Math.sin(a)
    return [px, py, ...tangentPoint(px, py, 12 + CHROME_CX[i], 12 + CHROME_CY[i], CHROME_R[i], CHROME_TAN0[k] + d)].map((v) => Math.round(v * 1000) / 1000)
  })
  const track = (j: number) => trace(5, ends.map((e) => e[j]))
  return { node: k + 2, play: play({ x1: track(0), y1: track(1), x2: track(2), y2: track(3) }) }
}

const CHROME: IconSpec = {
  parts: [
    { node: 1, play: play({ cx: trace(5, CHROME_CX.map((v) => 12 + v)), cy: trace(5, CHROME_CY.map((v) => 12 + v)), r: trace(5, CHROME_R) }) },
    chromeBlade(0),
    chromeBlade(1),
    chromeBlade(2),
  ],
}

/** chrome */
export function ChromeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="chrome" spec={CHROME} />
}

// 클립보드 — 왼쪽에 글머리 점 셋이 찍히고(f9) 오른쪽으로 줄이 그어지는(f10~16) 사이 판이 위로 들리며 바닥이
// 올라와 납작해지고(f10~15), 머물다(f16~19) 아래로 내려앉아 쟁반처럼 낮아진 뒤(f20~29), 바닥은 둔 채 위로
// 다시 펴지며(f32~40) 줄은 왼쪽부터 걷혀 오른쪽 점으로 남았다 사라진다(f32~40.5). 집게(위 네모)와 줄은 판 윗변을
// 따라 움직이고, 줄은 바닥선 아래로는 내려가지 않는다(바닥선에 겹쳐 묻힌다). 판 윗변·바닥과 줄 양 끝을 프레임마다
// 잰 값(영상 3주기 평균, f9~40) — 판 모서리는 둥근 채로 길이만 바뀐다.
const CLIP_TOP = [4, 3.87, 3.58, 2.87, 1.82, 1.2, 1.42, 1.57, 1.6, 1.65, 1.92, 2.32, 3.04, 4.32, 6.52, 9.47, 11.75, 13.05, 13.77, 14.17, 14.37, 14.4, 14.37, 14.2, 13.67, 12.64, 10.72, 7.82, 5.81, 4.9, 4.32, 4]
const CLIP_BOTTOM = [22, 21.62, 20.88, 18.98, 16.02, 14.3, 14.05, 14, 14, 14, 14.15, 14.35, 14.9, 15.75, 17.2, 19.28, 20.75, 21.5, 22.18, 22.25, 22.55, 22.55, 22.55, 22.55, 22.43, 22.43, 22.4, 22.33, 22.06, 22.03, 22.03, 22]
const CLIP_LINE_FROM = [7.9, 7.9, 7.9, 7.95, 7.95, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 7.95, 7.95, 7.9, 7.9, 7.9, 7.9, 7.95, 7.95, 7.95, 8, 8.38, 9.25, 10.94, 13.44, 14.88, 15.81, 15.94, 16.13]
const CLIP_LINE_TO = [7.9, 8.25, 9, 10.69, 13.44, 15.19, 15.81, 16.25, 16.25, 16.31, 16.31, 16.38, 16.38, 16.31, 16.38, 16.38, 16.38, 16.31, 16.38, 16.31, 16.31, 16.31, 16.31, 16.31, 16.44, 16.31, 16.38, 16.44, 16.44, 16.44, 16.5, 16.5]
const CLIP_LINE_Y = [6.05, 9.3, 12.55] // 판 윗변에서 줄까지
const clipBoardD = (top: number, bottom: number) => `M16 ${top}h2a2 2 0 0 1 2 2V${bottom - 2}a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V${top + 2}a2 2 0 0 1 2-2h2`
const CLIPBOARD: IconSpec = {
  parts: [
    { node: 0, play: play({ d: trace(9, CLIP_TOP.map((t, i) => clipBoardD(t, CLIP_BOTTOM[i]))) }) },
    { node: 1, play: play({ y: trace(9, CLIP_TOP.map((t) => Math.round((t - 4) * 100) / 100)) }) },
    ...CLIP_LINE_Y.map((dy) => ({
      shape: ['line', { x1: 7.9, y1: 4 + dy, x2: 7.9, y2: 4 + dy }] as const,
      play: play({
        x1: trace(9, CLIP_LINE_FROM),
        x2: trace(9, CLIP_LINE_TO),
        y: trace(9, CLIP_TOP.map((t, i) => Math.round((Math.min(t + dy, CLIP_BOTTOM[i]) - 4 - dy) * 100) / 100)),
        // 줄은 본선보다 살짝 옅다(0.9) — 점으로 나타났다(f9) 점으로 사라진다(f40.5)
        opacity: [[0, 0], [fr(8.5), 0, 'linear'], [fr(9), 0.9, 'linear'], [fr(40.4), 0.9, 'linear'], [fr(40.6), 0, 'linear']],
      }),
    })),
  ],
}

/** clipboard */
export function ClipboardIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="clipboard" spec={CLIPBOARD} />
}
