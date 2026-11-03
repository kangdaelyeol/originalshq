import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 14~15줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// 영상 프레임 번호(이 줄 묶음은 주기 시작이 f5) → 초
const f5 = (frame: number) => fr(frame - 5)
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [f5(a), 0, 'linear'], [f5(a + 0.1), 1, 'linear'], [f5(b), 1, 'linear'], [f5(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [f5(a), 1, 'linear'], [f5(a + 0.1), 0, 'linear'], [f5(b), 0, 'linear'], [f5(b + 0.1), 1, 'linear']]
/** a에서 b로 갔다가 머물고 c에서 d로 돌아오는 값(영상 프레임 번호) */
const goBack = (from: number | string, to: number | string, a: number, b: number, c: number, d: number): Key[] => [[0, from], [f5(a), from, 'linear'], [f5(b), to], [f5(c), to, 'linear'], [f5(d), from]]
/** 더하기 — 돌며 점 넷으로 줄었다 다시 펴지기를 두 번(f9~14 → f20~23, f35~41 → f44~50) */
const plusSpin = (nodes: number[]): IconPart => ({
  node: nodes,
  origin: [12, 12],
  play: play({ rotate: [[0, 0], [f5(9), 0, 'linear'], [f5(14), 90], [f5(23), 90, 'linear'], [f5(35), 90, 'linear'], [f5(41), 180]], scale: [[0, 1], [f5(9), 1, 'linear'], [f5(16), 0.25], [f5(20), 0.25, 'linear'], [f5(23), 1], [f5(35), 1, 'linear'], [f5(42), 0.25], [f5(45), 0.25, 'linear'], [f5(50), 1]] }),
})
// 곡선은 영상에서 프레임마다 잰 값에 맞춘 것 — 이름은 흔히 쓰는 CSS easing 이름(cubic-bezier 근사).
const CUBIC_IN_OUT = [0.645, 0.045, 0.355, 1] as const
const QUAD_IN_OUT = [0.455, 0.03, 0.515, 0.955] as const
const SINE_IN_OUT = [0.445, 0.05, 0.55, 0.95] as const
const QUAD_OUT = [0.25, 0.46, 0.45, 0.94] as const
const EXPO_OUT = [0.19, 1, 0.22, 1] as const

// 영상의 이 아이콘들은 24칸보다 사방 3칸 넓은 창(30칸)에서 잘린다 — 날아 나가는 부품에 단다.
const WIDE_WINDOW: IconNode[] = [['rect', { x: -3, y: -3, width: 30, height: 30 }]]

const NAV2_ARROW: IconNode = ['polygon', { points: '12 2 19 21 12 17 5 21 12 2' }]

const NAVIGATION_2: IconSpec = {
  overflow: true,
  parts: [
    {
      // 화살 — 오른쪽 위로 45° 돌아(f2.7~11.3) 그 방향으로 날아가고, 왼쪽 아래에서 다른 한 장이 날아 들어온 뒤(f16~24.7)
      // 제자리로 돌아온다(f25.6~33.5). 영상 화살은 Feather보다 (0.12, 0.25) 아래에 쉰다. 넓은 창(30칸)에서 잘린다.
      clip: WIDE_WINDOW,
      origin: [11.97, 11.09],
      play: play({
        x: [[0, 0.12]],
        y: [[0, 0.25]],
        rotate: [[fr(2.69), 0], [fr(11.29), 45, CUBIC_IN_OUT], [fr(25.64), 45, 'linear'], [fr(33.46), 0, CUBIC_IN_OUT]],
      }),
      parts: [
        {
          // 떠나는 화살(돌아간 좌표계라 y −가 오른쪽 위) — 창 밖에 나가면 숨겨 몰래 제자리로, 들어온 화살과 f25에 바꿔 선다
          node: 0,
          play: play({
            y: [[fr(11.63), 0], [fr(19.72), -30, CUBIC_IN_OUT], [fr(22), -30, 'linear'], [fr(22.01), 0, 'linear']],
            opacity: [[fr(19.8), 1], [fr(19.81), 0, 'linear'], [fr(25), 0, 'linear'], [fr(25.01), 1, 'linear']],
          }),
        },
        {
          // 들어오는 화살 — 쉴 때는 창 밖(왼쪽 아래 37칸)에 숨어 있다
          shape: NAV2_ARROW,
          play: play({
            y: [[fr(15.96), 37], [fr(24.65), 0, CUBIC_IN_OUT], [fr(26), 0, 'linear'], [fr(26.01), 37, 'linear']],
            opacity: [[fr(25), 1], [fr(25.01), 0, 'linear'], [fr(27), 0, 'linear'], [fr(27.01), 1, 'linear']],
          }),
        },
      ],
    },
    {
      // 바람 줄(점선) — 오른쪽 위 끝(s=15.3)에서 점으로 생겨 왼쪽 아래로 뻗고(f11.9~18.7), 무늬는 왼쪽 아래로 흘러 서며(f14.3~18.8),
      // 위 끝부터 거둬져(f18.8~25.6) 마지막 한 토막이 점으로 사라진다(f26.4). 무늬 기준이 위 끝이라 끝을 옮기는 만큼 offset을 되민다.
      shape: ['line', { x1: 1.67, y1: 22.03, x2: 1.24, y2: 22.46 }],
      attrs: { strokeDasharray: '2.9 5.75' },
      play: play({
        opacity: [[fr(11.85), 0], [fr(11.9), 1, 'linear'], [fr(26.4), 1, 'linear'], [fr(26.45), 0, 'linear']],
        x1: [[fr(11), 22.67], [fr(18.75), 22.67, 'linear'], [fr(25.56), 1.67, SINE_IN_OUT]],
        y1: [[fr(11), 1.03], [fr(18.75), 1.03, 'linear'], [fr(25.56), 22.03, SINE_IN_OUT]],
        x2: [[fr(11), 22.67], [fr(11.88), 22.67, 'linear'], [fr(18.66), 1.24, QUAD_IN_OUT]],
        y2: [[fr(11), 1.03], [fr(11.88), 1.03, 'linear'], [fr(18.66), 22.46, QUAD_IN_OUT]],
        strokeDashoffset: [[fr(11), 0.75], [fr(14.33), 0.75, 'linear'], [fr(18.75), -27.05, QUAD_OUT], [fr(25.56), 2.65, SINE_IN_OUT]],
      }),
    },
  ],
}

/** navigation-2 */
export function Navigation2Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="navigation-2" spec={NAVIGATION_2} />
}

const NAVIGATION: IconSpec = {
  parts: [
    {
      // 화살 — 시계 반대로 90° 돌아(f0.5~8.5) 머물다, 45°까지 되돌아(f14.3~18.7) 잠깐 서고 제자리로(f19.5~27.5).
      // 영상의 쉬는 자세는 Feather보다 왼쪽 아래로 (−1.81, +1.6) 옮겨지고 0.969배 — 그대로 둔 채 돌린다(축은 영상에서 잰 점).
      node: 0,
      origin: [14.95, 8.65],
      play: play({
        x: [[0, -1.81]],
        y: [[0, 1.6]],
        scale: [[0, 0.969]],
        rotate: [[fr(0.48), 0], [fr(8.54), -90, SINE_IN_OUT], [fr(14.29), -90, 'linear'], [fr(18.73), -45, SINE_IN_OUT], [fr(19.5), -45, 'linear'], [fr(27.52), 0, SINE_IN_OUT]],
      }),
    },
  ],
}

/** navigation */
export function NavigationIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="navigation" spec={NAVIGATION} />
}

// 꾸러미 — 0.78로 작아지며(f8~14) 윗날개가 위로 열렸다가(f18~38) 닫히고 제 크기로(f41~49). 근사.
const PACKAGE: IconSpec = {
  parts: [
    {
      origin: [12, 21],
      play: play({ scale: goBack(1, 0.78, 8, 14, 41, 49) }),
      parts: [
        { node: [0, 1, 2, 3] },
        { shape: ['polyline', { points: '3.3 7 1 3.5 9 0.5 12 2' }], play: play({ pathLength: goBack(0, 1, 18, 22, 35, 39), opacity: shownBetween(18, 39) }) },
        { shape: ['polyline', { points: '20.7 7 23 3.5 15 0.5 12 2' }], play: play({ pathLength: goBack(0, 1, 18, 22, 35, 39), opacity: shownBetween(18, 39) }) },
      ],
    },
  ],
}

/** package */
export function PackageIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="package" spec={PACKAGE} />
}

// 클립 — 왼쪽으로 25° 기울며 0.85로 작아졌다가(f8~16) 머물고 돌아온다(f42~52). 근사.
const PAPERCLIP: IconSpec = {
  parts: [{ node: 0, origin: [12, 12], play: play({ rotate: goBack(0, -25, 8, 16, 42, 52), scale: goBack(1, 0.85, 8, 16, 42, 52) }) }],
}

/** paperclip */
export function PaperclipIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="paperclip" spec={PAPERCLIP} />
}

// 펜 도구 — 촉이 아래로 서도록 돌며(f12~23) 길쭉한 선처럼 늘어났다가(f26~41) 다시 줄어 제자리로 돌아온다(f44~55). 근사.
const PEN_TOOL: IconSpec = {
  parts: [{ node: [0, 1, 2, 3], origin: [12, 12], play: play({ rotate: [[0, 0], [f5(12), 0, 'linear'], [f5(23), 135], [f5(41), 135, 'linear'], [f5(52), 0]], scaleX: [[0, 1], [f5(24), 1, 'linear'], [f5(30), 0.25], [f5(40), 0.25, 'linear'], [f5(46), 1]] }) }],
}

/** pen-tool */
export function PenToolIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="pen-tool" spec={PEN_TOOL} />
}

// 퍼센트 — 시계 방향으로 18° 돌며 가로로 뒤집혀(f8~14, 가운데쯤 세로가 1.1배로 늘어 입체로 도는 것처럼) 머물다가
// 거꾸로 뒤집혀 돌아온다(f29~36). 뒤집힌 %는 90° 돈 %와 같아 영상에선 108° 돈 것처럼 보인다. 프레임마다 영상에 맞춘 값 — f7~37.
const PERCENT_FLIP: readonly (readonly [sx: number, sy: number, turn: number])[] = [
  [1, 1, 0], [0.85, 1.02, 1.9], [0.65, 1.05, 5.9], [0.24, 1.11, 12.3], [-0.53, 1.07, 12.3], [-0.8, 1.04, 16.1], [-0.92, 1.02, 17.9], [-1, 1, 18.15],
  ...Array.from({ length: 14 }, () => [-1, 1, 18.15] as const),
  [-0.84, 1.02, 16.9], [-0.67, 1.05, 14.45], [-0.32, 1.1, 10.4], [0.43, 1.08, 8.75], [0.73, 1.04, 3.8], [0.87, 1.03, 1.5], [0.95, 1, 0.4], [0.99, 1, 0.1], [1, 1, 0],
]
// motion은 한 요소에서 배율을 회전 뒤에 건다(scale·rotate 순) — 찌그러뜨린 뒤 돌리려고 회전을 바깥 묶음에 둔다.
const PERCENT: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: [[0, 0], ...trace(7 - 5, PERCENT_FLIP.map(([, , turn]) => turn))] }),
      parts: [
        {
          node: [0, 1, 2],
          origin: [12, 12],
          play: play({
            scaleX: [[0, 1], ...trace(7 - 5, PERCENT_FLIP.map(([sx]) => sx))],
            scaleY: [[0, 1], ...trace(7 - 5, PERCENT_FLIP.map(([, sy]) => sy))],
          }),
        },
      ],
    },
  ],
}

/** percent */
export function PercentIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="percent" spec={PERCENT} />
}

// 전화 — 0.8배로 작아지며 반시계로 11° 기울고(f9~15) 벨이 울리듯 위아래로 ±1.6씩 떨다가(f9~41, 4~5프레임 간격)
// 바로 서며 제 크기로(f33~41). 프레임마다 모형(배율·회전·이동)을 영상에 맞춰 잰 값 — f8~42.
const PHONE_SCALE = [1, 1, 0.99, 0.98, 0.94, 0.86, 0.83, 0.81, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.81, 0.82, 0.84, 0.9, 0.96, 0.98, 0.99, 0.99, 1, 1]
const PHONE_SHAKE = [-0.07, -0.89, -1.75, -1.78, -1.64, -0.18, 1.34, 1.46, 1.33, 0.8, -1.21, -1.74, -1.79, -1.63, -0.18, 1.28, 1.45, 1.28, -0.19, -1.64, -1.83, -1.65, -0.19, 1.26, 1.45, 1.27, -0.2, -1.62, -1.79, -1.44, 1.12, 1.43, 1.37, 0.19, 0]
const PHONE_TURN = [0.1, -0.3, -0.6, -1.5, -3.4, -7.5, -9.5, -10.3, -10.9, -11.1, -11, -11, -11, -11.1, -11.2, -11.2, -11.1, -11, -11, -11, -11, -10.9, -10.9, -10.9, -10.7, -10.2, -9.7, -8.5, -5.7, -2.2, -1.1, -0.7, -0.3, 0.1, 0]
const phoneShake = (turn: readonly number[]) => play({ scale: [[0, 1], ...trace(8 - 5, PHONE_SCALE)], rotate: [[0, 0], ...trace(8 - 5, turn)], y: [[0, 0], ...trace(8 - 5, PHONE_SHAKE)] })
const PHONE: IconSpec = {
  parts: [{ node: 0, origin: [12, 12], play: phoneShake(PHONE_TURN) }],
}

/** phone */
export function PhoneIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone" spec={PHONE} />
}

// 걸려 온 전화 — 전화와 같은 떨림이지만 시계 방향으로 11° 기운다. 소리 물결(호 둘)은 수화기를 따라 움직이며
// 안쪽·바깥쪽이 엇갈려 꺼졌다 켜지기를 되풀이한다. 영상의 물결은 Feather보다 (−0.2, 0.24) 수화기 쪽에 쉰다. f8~42.
const PHONE_CALL_TURN = [0.2, 0.2, 0.8, 1.4, 3.4, 7.7, 9.5, 10.2, 10.6, 10.9, 10.9, 10.9, 11, 11.1, 11, 10.9, 11, 10.9, 11, 11, 11, 11, 11, 11, 10.9, 10.3, 10.1, 8.8, 5.6, 2.2, 1.2, 0.5, 0.5, 0, 0]
const PHONE_CALL_WAVES = [
  [1, 0.96, 0.52, 0.08, 0.03, 0.04, 0.04, 0.41, 0.79, 0.9, 0.95, 0.94, 0.75, 0.48, 0.26, 0.14, 0.04, 0.09, 0.47, 0.75, 0.83, 0.91, 0.91, 0.9, 0.51, 0.18, 0.17, 0.04, 0.03, 0.42, 0.8, 1, 1, 1, 1],
  [1, 1, 1, 0.77, 0.28, 0.01, 0.01, 0.01, 0.01, 0.45, 0.83, 0.84, 0.9, 0.9, 0.75, 0.4, 0.02, 0.02, 0.06, 0.05, 0.31, 0.9, 0.94, 0.94, 0.92, 0.85, 0.37, 0.01, 0.01, 0.05, 0.05, 0.42, 0.94, 1, 1],
]
const PHONE_CALL: IconSpec = {
  nodes: [
    ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
    ['path', { d: 'M14.85 5.24A5 5 0 0 1 18.8 9.19' }],
    ['path', { d: 'M14.8 1.25A9 9 0 0 1 22.75 9.19' }],
  ],
  parts: [
    {
      origin: [12, 12],
      play: phoneShake(PHONE_CALL_TURN),
      parts: [{ node: 0 }, ...PHONE_CALL_WAVES.map((alpha, k) => ({ node: k + 1, play: play({ opacity: [[0, 1], ...trace(8 - 5, alpha)] }) }))],
    },
  ],
}

/** phone-call */
export function PhoneCallIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone-call" spec={PHONE_CALL} />
}

// 꺼진 전화 — 전화와 같은 떨림. 사선은 수화기 묶음 안에서 같이 떨며 아래 끝부터 걷혀(f9~12) 위 끝의 점으로 사라지고,
// 끊긴 수화기는 그 사이 온전한 수화기로 메워진다(f10~12). 떨림이 끝날 무렵 사선이 위에서부터 다시 그어지며(f37~41)
// 메운 부분이 빠진다. 프레임마다 모형(묶음 변형·사선 구간·온전한 수화기 불투명)을 영상에 맞춰 잰 값.
const PHONE_OFF_SLASH: readonly (readonly [number, number])[] = [[8, 0.97], [9, 0.87], [10, 0.49], [11, 0.14], [12, 0.02], [36, 0.02], [37, 0.23], [38, 0.57], [39, 0.78], [40, 0.93], [41, 1]]
const PHONE_OFF_FULL: readonly (readonly [number, number])[] = [[9, 0], [10, 0.63], [11, 0.9], [12, 1], [36, 1], [37, 0.89], [38, 0.52], [39, 0.19], [40, 0.1], [41, 0]]
const PHONE_OFF: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: phoneShake(PHONE_TURN),
      parts: [
        { node: 0 },
        {
          shape: ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
          attrs: { opacity: 0 },
          play: play({ opacity: [[0, 0], ...PHONE_OFF_FULL.map(([f, v]): Key => [f5(f), v, 'linear'])] }),
        },
        {
          node: 1,
          play: play({
            pathLength: [[0, 1], ...PHONE_OFF_SLASH.map(([f, v]): Key => [f5(f), v, 'linear'])],
            opacity: hiddenBetween(12.5, 36.5),
          }),
        },
      ],
    },
  ],
}

/** phone-off */
export function PhoneOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone-off" spec={PHONE_OFF} />
}

// 핀 — 2.7 떠올랐다가(f13~20) 끝(12,23.16)을 축으로 시계 방향으로 기울며 내려앉아 1.8 아래에서 18°까지 기울고
// (f23~34), 한 번에 반대쪽(−18°)으로 넘어갔다가(f37~39) 바로 서며 제자리로 올라온다(f46~52). 그동안 안 동그라미의
// 선이 1.4배 굵어진다(f16~51). 프레임마다 모형(회전·이동·동그라미 굵기)을 영상에 맞춰 잰 값 — 시작 프레임 f12.
const MAP_PIN_Y = [0, -0.15, -0.18, -0.35, -1.29, -2.35, -2.52, -2.59, -2.66, -2.66, -2.66, -2.66, -2.58, -2.45, -2.26, -1.83, 0.95, 1.4, 1.64, 1.71, 1.77, 1.77, 1.8, 1.8, 1.8, 1.8, 1.8, 1.84, 1.85, 1.8, 1.8, 1.8, 1.8, 1.8, 1.7, 1.67, 0.91, 0.19, 0.07, 0.02, 0]
const MAP_PIN_TURN = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 2.2, 3.9, 5.9, 7.8, 10.3, 12.4, 13.9, 15.5, 17.1, 18, 18, 17.5, 16.2, 13.9, 0, -13.5, -15.5, -17, -17.8, -17.8, -17.8, -17.8, -17.1, -15.4, -9.1, -2.2, -0.8, -0.4, -0.3, 0]
const MAP_PIN_THICK = [1, 1, 1, 1, 1.14, 1.35, 1.33, 1.32, 1.31, 1.31, 1.31, 1.36, 1.39, 1.39, 1.41, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.36, 1.32, 1.24, 1.13, 1.1, 1.04, 1.02, 1]
const MAP_PIN: IconSpec = {
  parts: [
    {
      origin: [12, 23.16],
      play: play({ y: [[0, 0], ...trace(12 - 5, MAP_PIN_Y)], rotate: [[0, 0], ...trace(12 - 5, MAP_PIN_TURN)] }),
      parts: [{ node: 0 }, { node: 1, play: play({ '--d3-k': [[0, 1], ...trace(12 - 5, MAP_PIN_THICK)] }) }],
    },
  ],
}

/** map-pin */
export function MapPinIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="map-pin" spec={MAP_PIN} />
}

// 재생 — 삼각형(영상은 Feather보다 작고 오른쪽, 선이 1.58배 굵다)이 빠르게 돌며 뒤집혀(f10~14) 일시정지 막대(1.21배 굵기)로
// 바뀌고, 막대는 1.23배로 컸다가 제 크기로(f19~25) 머문 뒤 다시 커져(f39~41) 거꾸로 돌며 삼각형으로 돌아온다(f44~54).
// 프레임마다 일반 2차원 변환(가운데 11,12.05)을 영상에 맞춰 회전 θ·기울임·가로/세로 배율로 나눈 값(f9~54).
// motion은 한 요소에서 배율을 회전 뒤에 걸어서, 회전·이동은 바깥 묶음, 배율·기울임은 안쪽 묶음에 둔다.
const PLAY_TRACK = {
  turn: [-0.1, -2.6, -8.2, 96.7, 208, 269.9, 219.1, 198.8, 188.7, 182.7, 180.7, 180.9, 180.9, 180.9, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180.5, 180, 180, 180, 182.7, 188, 198, 218.2, 269.9, 207.9, 97, -8.2, -2.6, -0.1, 0],
  sx: [1, 0.994, 0.973, 1.112, 1.139, 0.811, 1.027, 1.129, 1.209, 1.221, 1.229, 1.23, 1.23, 1.23, 1.12, 1.02, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.04, 1.21, 1.23, 1.23, 1.23, 1.225, 1.203, 1.122, 0.974, 0.808, 1.135, 1.113, 0.973, 0.994, 1, 1],
  sy: [1, 1.001, 1.007, -0.859, -0.818, -1.028, -1.271, -1.25, -1.247, -1.245, -1.238, -1.24, -1.24, -1.24, -1.13, -1.03, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1.05, -1.2, -1.25, -1.25, -1.25, -1.242, -1.245, -1.243, -1.254, -1.03, -0.822, -0.857, 1.007, 1.001, 1, 1],
  skew: [-0.1, -0.5, 0.5, 8.3, -11.4, 0.1, -1.1, -0.3, -0.6, 0.5, -0.7, -0.9, -0.9, -0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.5, 0, 0, 0, 0.4, 0.6, 0.1, 0.5, 0.1, -11.6, 7.9, 0.5, -0.5, -0.1, 0],
  x: [0, 0, -0.06, -0.11, -0.07, -0.08, 0.83, 0.7, 0.58, 0.55, 0.37, 0.48, 0.48, 0.48, 0.26, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.09, 0.43, 0.48, 0.48, 0.49, 0.53, 0.57, 0.63, 0.74, -0.05, -0.06, -0.12, -0.06, 0, 0, 0],
  y: [0.03, 0.04, 0.07, 0.05, 0.23, 0.79, 0.73, 0.25, 0.12, 0.08, 0.05, 0.05, 0.05, 0.05, 0.11, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.02, 0.04, 0.04, 0.03, 0.11, 0.21, 0.26, 0.74, 0.76, 0.23, 0.06, 0.07, 0.04, 0.03, 0],
  tri: [1, 1, 0.99, 1, 1, 0.97, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.16, 0.99, 1, 1, 0.99, 1, 1, 1],
  bars: [0, 0, 0.16, 0.35, 0.91, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.99, 0.89, 0.28, 0.16, 0, 0, 0],
}
const playKeys = (list: readonly number[], rest: number): Key[] => [[0, rest], ...trace(9 - 5, list)]
const PLAY: IconSpec = {
  nodes: [
    ['polygon', { points: '6.96 4.09 19.12 12.05 6.94 20.03' }],
    ['line', { x1: 8.15, y1: 5.64, x2: 8.15, y2: 18.46 }],
    ['line', { x1: 13.77, y1: 5.64, x2: 13.77, y2: 18.46 }],
  ],
  parts: [
    {
      origin: [11, 12.05],
      play: play({ rotate: playKeys(PLAY_TRACK.turn, 0), x: playKeys(PLAY_TRACK.x, 0), y: playKeys(PLAY_TRACK.y, 0) }),
      parts: [
        {
          origin: [11, 12.05],
          play: play({ scaleX: playKeys(PLAY_TRACK.sx, 1), scaleY: playKeys(PLAY_TRACK.sy, 1), skewX: playKeys(PLAY_TRACK.skew, 0) }),
          parts: [
            { node: 0, stroke: 1.58, play: play({ opacity: playKeys(PLAY_TRACK.tri, 1) }) },
            { node: [1, 2], stroke: 1.21, attrs: { opacity: 0 }, play: play({ opacity: playKeys(PLAY_TRACK.bars, 0) }) },
          ],
        },
      ],
    },
  ],
}

/** play */
export function PlayIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="play" spec={PLAY} />
}

// 재생(원) — 원째 반시계로 한 바퀴 돌며 입체로 뒤집혀(f11~16, f14에 원이 비스듬한 선이 된다) 삼각형이 일시정지
// 막대로 바뀐다. 막대는 1.27배 길고 넓게 섰다가 제 크기로(f22~24) 머문 뒤 다시 커지고(f40~42), 들어올 때의 움직임을
// 거꾸로 되짚어 돌아온다(f43~53 = f19~9). 프레임마다 일반 2차원 변환을 영상에 맞춰 잰 값(f9~53).
const PLAY_CIRCLE_TRACK = {
  turn: [0, -0.8, -2.3, -22.9, -54.8, -217.9, -356, -352.9, -357.4, -357.7, -359.9, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -359.9, -357.7, -357.4, -352.9, -356, -217.9, -54.8, -22.9, -2.3, -0.8, 0],
  sx: [1, 0.971, 0.91, 0.845, 0.941, 0.848, 0.876, 0.968, 0.995, 0.998, 0.999, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.999, 0.998, 0.995, 0.968, 0.876, 0.848, 0.941, 0.845, 0.91, 0.971, 1],
  sy: [1, 0.999, 0.996, 0.946, 0.63, -0.189, 0.673, 0.818, 0.904, 0.961, 0.986, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.986, 0.961, 0.904, 0.818, 0.673, -0.189, 0.63, 0.946, 0.996, 0.999, 1],
  skew: [0, -0.3, -1.1, -11.7, -15.7, 34.8, -23.1, -7.5, -1.2, -0.4, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, -0.4, -1.2, -7.5, -23.1, 34.8, -15.7, -11.7, -1.1, -0.3, 0],
  x: [-0.01, -0.02, 0, -0.03, 0.03, 0.08, 0.01, 0, 0, 0.01, 0.04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.04, 0.01, 0, 0, 0.01, 0.08, 0.03, -0.03, 0, -0.02, -0.01],
  y: [0, 0, 0.03, 0.02, 0.06, -0.26, 0.01, 0.08, 0.09, 0.05, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.05, 0.09, 0.08, 0.01, -0.26, 0.06, 0.02, 0.03, 0, 0],
  tri: [1, 0.98, 0.98, 1, 1, 1, 0.9, 0.39, 0.17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.17, 0.39, 0.9, 1, 1, 1, 0.98, 0.98, 1],
  bars: [0, 0, 0.28, 0.43, 1, 0.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.6, 1, 0.43, 0.28, 0, 0],
  size: [1, 1.01, 1.04, 1.07, 1.18, 1.16, 1.14, 1.09, 1.21, 1.24, 1.28, 1.27, 1.27, 1.24, 1.13, 1.02, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.25, 1.25, 1.27, 1.28, 1.24, 1.21, 1.09, 1.14, 1.16, 1.18, 1.07, 1.04, 1.01, 1],
}
const pcKeys = (list: readonly number[], rest: number): Key[] => [[0, rest], ...trace(9 - 5, list)]
// 막대 — 가운데(12, 12.01)에서 간격 반 1.44·k, 반길이 3.01·k (굵기는 그대로)
const pcBar = (side: number): IconPart => ({
  shape: ['line', { x1: 12 + side * 1.44, y1: 9, x2: 12 + side * 1.44, y2: 15.02 }],
  attrs: { opacity: 0 },
  play: play({
    x1: pcKeys(PLAY_CIRCLE_TRACK.size.map((k) => +(12 + side * 1.44 * k).toFixed(2)), 12 + side * 1.44),
    x2: pcKeys(PLAY_CIRCLE_TRACK.size.map((k) => +(12 + side * 1.44 * k).toFixed(2)), 12 + side * 1.44),
    y1: pcKeys(PLAY_CIRCLE_TRACK.size.map((k) => +(12.01 - 3.01 * k).toFixed(2)), 9),
    y2: pcKeys(PLAY_CIRCLE_TRACK.size.map((k) => +(12.01 + 3.01 * k).toFixed(2)), 15.02),
    opacity: pcKeys(PLAY_CIRCLE_TRACK.bars, 0),
  }),
})
const PLAY_CIRCLE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: pcKeys(PLAY_CIRCLE_TRACK.turn, 0), x: pcKeys(PLAY_CIRCLE_TRACK.x, 0), y: pcKeys(PLAY_CIRCLE_TRACK.y, 0) }),
      parts: [
        {
          origin: [12, 12],
          play: play({ scaleX: pcKeys(PLAY_CIRCLE_TRACK.sx, 1), scaleY: pcKeys(PLAY_CIRCLE_TRACK.sy, 1), skewX: pcKeys(PLAY_CIRCLE_TRACK.skew, 0) }),
          parts: [{ node: 0 }, { node: 1, play: play({ opacity: pcKeys(PLAY_CIRCLE_TRACK.tri, 1) }) }, pcBar(-1), pcBar(1)],
        },
      ],
    },
  ],
}

/** play-circle */
export function PlayCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="play-circle" spec={PLAY_CIRCLE} />
}

const PLUS_CIRCLE: IconSpec = { parts: [plusSpin([1, 2])] }

/** plus-circle */
export function PlusCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="plus-circle" spec={PLUS_CIRCLE} />
}

const PLUS_SQUARE: IconSpec = { parts: [plusSpin([1, 2])] }

/** plus-square */
export function PlusSquareIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="plus-square" spec={PLUS_SQUARE} />
}

// 포켓 — 주머니째 오른쪽으로 1.3 비켜나는 동안(f9~16) 안쪽 갈매기가 왼끝부터 지워져 오른끝의 점이 되고, 양끝에 점 둘이
// (두 눈) 찍히며 주머니가 왼쪽으로 1.7 넘어간다(f16~18). 갈매기가 왼끝부터 다시 그려지며(f18~25) 제자리로(f23~26).
// 대시 주기를 경로 길이(1)로 두면 길이 0인 대시가 양끝에 점으로 찍힌다. 프레임마다 영상에 맞춰 잰 값.
const POCKET: IconSpec = {
  parts: [
    {
      play: play({ x: [[0, 0], ...trace(8 - 5, [0.07, 0.16, 1.16, 1.29, 1.3, 1.29, 1.29, 1.22, 0.91, -1.22, -1.56, -1.63, -1.7, -1.7, -1.71, -1.52, -0.25, -0.07, 0])] }),
      parts: [
        { node: 0 },
        {
          node: 1,
          play: play({
            pathOffset: [[0, 0], ...trace(7 - 5, [0, 0.05, 0.09, 0.13, 0.22, 0.5, 0.78, 0.89, 0.95, 1, 1]), [f5(17.9), 1, 'linear'], [f5(17.95), 0, 'linear']],
            pathLength: [[0, 1], ...trace(7 - 5, [1, 0.95, 0.91, 0.87, 0.78, 0.5, 0.22, 0.11, 0.05, 0, 0]), ...trace(18 - 5, [0.04, 0.1, 0.22, 0.45, 0.73, 0.92, 0.97, 1])],
          }),
        },
      ],
    },
  ],
}

/** pocket */
export function PocketIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="pocket" spec={POCKET} />
}

const POWER: IconSpec = {
  parts: [
    {
      // 고리 — 눌리듯 0.856배로 줄며 2칸 올라가고 양 끝이 조금씩 줄어든다(f1.8~6.3), 놓으면 튕기듯 돌아온다(f16.9~21.3)
      node: 0,
      origin: [12, 13.01],
      play: play({
        scale: [[fr(1.78), 1], [fr(6.25), 0.856, CUBIC_IN_OUT], [fr(16.88), 0.856, 'linear'], [fr(21.28), 1, EXPO_OUT]],
        y: [[fr(1.78), 0], [fr(6.25), -2.04, CUBIC_IN_OUT], [fr(16.88), -2.04, 'linear'], [fr(21.28), 0, EXPO_OUT]],
        pathLength: [[fr(1.78), 1], [fr(6.25), 0.79, CUBIC_IN_OUT], [fr(16.88), 0.79, 'linear'], [fr(21.28), 1, EXPO_OUT]],
        pathOffset: [[fr(1.78), 0], [fr(6.25), 0.105, CUBIC_IN_OUT], [fr(16.88), 0.105, 'linear'], [fr(21.28), 0, EXPO_OUT]],
      }),
    },
    {
      // 막대 — 위 끝이 고리 안으로 내려앉아(2→8.84) 짧아진다, 아래 끝도 조금(12→12.75) — 고리와 같은 박자
      node: 1,
      play: play({
        y1: [[fr(1.78), 2], [fr(6.25), 8.84, CUBIC_IN_OUT], [fr(16.88), 8.84, 'linear'], [fr(21.28), 2, EXPO_OUT]],
        y2: [[fr(1.78), 12], [fr(6.25), 12.75, CUBIC_IN_OUT], [fr(16.88), 12.75, 'linear'], [fr(21.28), 12, EXPO_OUT]],
      }),
    },
  ],
}

/** power */
export function PowerIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="power" spec={POWER} />
}

// 프린터 — 위 종이가 내려가 들어가고(f12~17) 아래로 인쇄된 종이가 밀려 나왔다가(f17~29) 돌아온다(f29~35). 근사.
const PRINTER: IconSpec = {
  overflow: true,
  parts: [
    { node: 0, play: play({ y: goBack(0, 3, 12, 17, 29, 35) }) },
    { node: 2, play: play({ y: [[0, 0], [f5(14), 0, 'linear'], [f5(20), 3], [f5(29), 3, 'linear'], [f5(35), 0]] }) },
  ],
}

/** printer */
export function PrinterIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="printer" spec={PRINTER} />
}

// 라디오 — 가운데 점이 1.72로 줄고 안쪽 물결이 0.82배로 오므라들며 흐려졌다가(f10~16), 바깥 물결도 0.8배로 흐려지고
// 점은 2.4로 커진다(f16~25). 물결은 1.1배로 부푼 채 차례로 다시 밝아지며 제자리로(f20~33). 프레임마다 영상에 맞춘 값(f10~33)
// — [점 반지름, 안 물결 배율, 안 불투명, 바깥 물결 배율, 바깥 불투명].
const RADIO_TRACK: readonly (readonly [number, number, number, number, number])[] = [
  [1.72, 1, 1, 1, 1], [1.72, 1, 0.99, 1, 1], [1.71, 0.98, 0.93, 1, 0.99], [1.71, 0.84, 0.3, 1, 1], [1.71, 0.83, 0.28, 0.99, 1], [1.7, 0.81, 0.29, 0.97, 0.99],
  [1.7, 1.37, 0.27, 0.49, 0.25], [2.09, 0.8, 0.25, 0.81, 0.25], [2.39, 0.8, 0.25, 0.8, 0.25], [2.39, 0.8, 0.25, 0.8, 0.25], [2.45, 1.33, 0.24, 0.57, 0.52],
  [2.46, 1.07, 0.8, 0.8, 0.3], [2.46, 1.08, 0.81, 0.81, 0.31], [2.47, 1.1, 0.84, 0.95, 0.5], [2.48, 1.1, 0.85, 1.07, 0.8], [2.46, 1.1, 0.85, 1.09, 0.83],
  [2.03, 1.1, 0.86, 1.1, 0.86], [2.03, 1.09, 0.9, 1.1, 0.89], [2.04, 1.09, 0.91, 1.1, 0.89], [2.02, 1.01, 1, 1.09, 0.9], [2.02, 1.01, 0.98, 1.09, 0.88],
  [2.03, 1.01, 0.97, 1.08, 0.89], [2.02, 1, 0.98, 1.01, 1], [2, 1, 1, 1, 1],
]
const radioKeys = (k: number, rest: number): Key[] => [[0, rest], ...trace(10 - 5, RADIO_TRACK.map((row) => row[k]))]
const RADIO: IconSpec = {
  nodes: [
    ['circle', { cx: 12, cy: 12, r: 2 }],
    ['path', { d: 'M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49' }],
    ['path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14' }],
  ],
  parts: [
    { node: 0, play: play({ r: radioKeys(0, 2) }) },
    { node: 1, origin: [12, 12], play: play({ scale: radioKeys(1, 1), opacity: radioKeys(2, 1) }) },
    { node: 2, origin: [12, 12], play: play({ scale: radioKeys(3, 1), opacity: radioKeys(4, 1) }) },
  ],
}

/** radio */
export function RadioIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="radio" spec={RADIO} />
}

// 새로고침(반시계) — 영상 15줄 9칸은 refresh-cw가 아니라 좌우가 뒤집힌 refresh-ccw다. 호가 꼬리 끝부터 지워져 머리 쪽으로
// 줄고(f10~17) 머리 ㄱ자도 꼭짓점으로 오그라들어 점이 된 채 시계 방향으로 돌다가(f13~19), 점이 호의 꼬리 끝으로
// 옮겨(f20) 돌면서 다시 그려지고(f20~28) 머리가 돋아 반 바퀴(180°, 모양이 같다) 자리에 선다(f29~36).
// 프레임마다 모형(전체 회전 φ, 호 구간 [a, b], 머리 배율 k·꼭짓점 둘레 회전 ψ)을 영상에 맞춰 잰 값.
// 호 둘은 같은 방향(꼬리 끝 → 머리 꼭짓점)으로 다시 그려 둔다 — 구간 값을 같이 쓰려고.
const REFRESH_NODES: IconNode[] = [
  ['polyline', { points: '1 4 1 10 7 10' }],
  ['polyline', { points: '23 20 23 14 17 14' }],
  ['path', { d: 'M20.49 9A9 9 0 0 0 5.64 5.64L1 10' }],
  ['path', { d: 'M3.51 15A9 9 0 0 0 18.36 18.36L23 14' }],
]
// [프레임, φ, a, b, k, ψ]
const REFRESH_TRACK: readonly (readonly [number, number, number, number, number, number])[] = [
  [10, 0, 0.04, 1, 0.99, 0], [11, 0.05, 0.11, 1, 0.98, 0], [12, 0.1, 0.24, 1, 0.97, 0], [13, 0.5, 0.5, 1, 0.9, 0], [14, 1.8, 0.76, 1, 0.23, 0],
  [15, 2.4, 0.88, 1, 0.07, 0], [16, 6.5, 0.95, 1, 0, 0], [17, 10.6, 0.98, 1, 0, 0], [18, 17.7, 1, 1, 0, 0], [19, 30.3, 1, 1, 0, 0],
  [20, 50.5, 0, 0, 0, 0], [21, 88.6, 0, 0, 0, 0], [22, 128.2, 0, 0.03, 0, 0], [23, 150.6, 0, 0.06, 0, 0], [24, 162.2, 0, 0.07, 0, 0],
  [25, 169.5, 0, 0.13, 0, 0], [26, 175.6, 0, 0.21, 0, 0], [27, 205.6, 0.18, 0.52, 0, 0], [28, 206.7, 0.18, 0.73, 0, 0], [29, 221.1, 0.27, 0.89, 0.77, 10.4],
  [30, 204.8, 0.16, 0.9, 0.83, 9.5], [31, 194.8, 0.1, 0.91, 0.91, 6.9], [32, 188.1, 0.05, 0.92, 0.94, 4.5], [33, 184, 0.03, 1, 0.98, 2.6], [34, 182.2, 0.02, 1, 1, 0.7],
  [35, 180.5, 0.01, 1, 1, 0.7], [36, 180, 0, 1, 1, 0],
]
const refreshKeys = (pick: (row: readonly number[]) => number, rest: number): Key[] => [[0, rest], ...REFRESH_TRACK.map((row) => [f5(row[0]), +pick(row).toFixed(3), 'linear'] as Key)]
const refreshHead = (node: number, corner: readonly [number, number]): IconPart => ({
  node,
  origin: corner,
  play: play({ scale: refreshKeys((row) => row[4], 1), rotate: refreshKeys((row) => row[5], 0) }),
})
const refreshArc = (node: number): IconPart => ({
  node,
  play: play({ pathOffset: refreshKeys((row) => row[2], 0), pathLength: refreshKeys((row) => row[3] - row[2], 1) }),
})
const REFRESH_CCW: IconSpec = {
  nodes: REFRESH_NODES,
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: refreshKeys((row) => row[1], 0) }),
      parts: [refreshHead(0, [1, 10]), refreshHead(1, [23, 14]), refreshArc(2), refreshArc(3)],
    },
  ],
}

/** refresh-ccw */
export function RefreshCcwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="refresh-ccw" spec={REFRESH_CCW} />
}

// 되돌리기 — 호가 꼬리 끝부터 지워져 머리 쪽으로 줄고(f9~16) 머리 ㄱ자도 꼭짓점의 점으로 오그라든다(f14~17). 점이
// 호의 시작(왼쪽 아래)으로 옮겨 가 호가 다시 그려지는 동안(f18~31), 머리는 원 오른쪽에서 흐리게 나타나 원을 따라
// 반시계로 돌아 제자리(왼쪽 위)에 선다(f21~31). 프레임마다 모형(호 구간, 머리 회전·배율·꼭짓점 둘레 회전·불투명)을 잰 값.
// [프레임, 호 시작, 호 길이] — f17.9에 점이 호 끝(꼭짓점)에서 시작점으로 옮긴다
const ROTATE_ARC: readonly (readonly [number, number, number])[] = [
  [8, 0, 1], [9, 0.05, 0.95], [10, 0.12, 0.88], [11, 0.24, 0.76], [12, 0.5, 0.5], [13, 0.76, 0.24], [14, 0.88, 0.12], [15, 0.94, 0.06], [16, 0.98, 0.02], [17, 1, 0],
  [17.9, 1, 0], [18, 0, 0], [20, 0, 0], [21, 0, 0.04], [22, 0, 0.08], [23, 0, 0.14], [24, 0, 0.26], [25, 0, 0.5], [26, 0, 0.74], [27, 0, 0.85], [28, 0, 0.96], [29, 0, 0.98], [30, 0, 0.99], [31, 0, 1],
]
// [프레임, 원 둘레 회전, 배율, 꼭짓점 둘레 회전, 불투명]
const ROTATE_HEAD: readonly (readonly [number, number, number, number, number])[] = [
  [13, 0, 1, 0, 1], [14, 0, 0.97, 0, 1], [15, 2.7, 0.24, 9.6, 1], [16, 3.5, 0.12, 9.6, 1], [17, 0, 0.05, 0, 1], [17.9, 0, 0, 0, 0], [20.9, 163, 0.87, 5.4, 0],
  [21, 163.1, 0.87, 5.4, 0.25], [22, 155.6, 0.84, -1.3, 0.72], [23, 143.8, 0.82, -13.6, 0.75], [24, 119.8, 0.81, -17.2, 0.95], [25, 81.4, 0.83, -13.7, 1], [26, 44.3, 0.8, 6.2, 1],
  [27, 23.8, 0.86, 4.4, 1], [28, 12.8, 0.96, 0.7, 1], [29, 5.1, 0.98, -0.2, 1], [30, 2.2, 0.98, -0.2, 1], [31, 0, 1, 0, 1],
]
const rotateKeys = <T extends readonly number[]>(rows: readonly T[], pick: (row: T) => number, rest: number): Key[] => [[0, rest], ...rows.map((row): Key => [f5(row[0]), pick(row), 'linear'])]
const ROTATE_CCW: IconSpec = {
  parts: [
    { node: 1, play: play({ pathOffset: rotateKeys(ROTATE_ARC, (r) => r[1], 0), pathLength: rotateKeys(ROTATE_ARC, (r) => r[2], 1) }) },
    {
      origin: [12, 12],
      play: play({ rotate: rotateKeys(ROTATE_HEAD, (r) => r[1], 0), opacity: rotateKeys(ROTATE_HEAD, (r) => r[4], 1) }),
      parts: [{ node: 0, origin: [1, 10], play: play({ scale: rotateKeys(ROTATE_HEAD, (r) => r[2], 1), rotate: rotateKeys(ROTATE_HEAD, (r) => r[3], 0) }) }],
    },
  ],
}

/** rotate-ccw */
export function RotateCcwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="rotate-ccw" spec={ROTATE_CCW} />
}
