import { AnimatedIcon } from './animated-icon'
import { fr, play, type Key } from './icon-motion'
import type { AnimatedIconProps, IconNode, IconPart, IconSpec } from './icon-types'

// 영상 14~15줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// 영상 프레임 번호(이 줄 묶음은 주기 시작이 f5) → 초
const f5 = (frame: number) => fr(frame - 5)
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [f5(a), 0, 'linear'], [f5(a + 0.1), 1, 'linear'], [f5(b), 1, 'linear'], [f5(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [f5(a), 1, 'linear'], [f5(a + 0.1), 0, 'linear'], [f5(b), 0, 'linear'], [f5(b + 0.1), 1, 'linear']]
/** a에서 b로 갔다가 머물고 c에서 d로 돌아오는 값(영상 프레임 번호) */
const goBack = (from: number | string, to: number | string, a: number, b: number, c: number, d: number): Key[] => [[0, from], [f5(a), from, 'linear'], [f5(b), to], [f5(c), to, 'linear'], [f5(d), from]]
/** 재생 → 일시정지 → 재생: 삼각형이 기울며 납작해져 사라지고 막대 둘이 비스듬히 섰다가(f10~17) 거꾸로(f44~50) */
const playPause = (tri: number, bars: readonly (readonly [number, number, number, number])[]): IconPart[] => [
  { node: tri, origin: [12, 12], play: play({ rotate: goBack(0, -25, 10, 14, 46, 50), scaleY: goBack(1, 0.15, 10, 14, 46, 50), opacity: hiddenBetween(14, 46) }) },
  ...bars.map(([x1, y1, x2, y2]) => ({ shape: ['line', { x1, y1, x2, y2 }] as const, origin: [12, 12] as const, play: play({ skewX: goBack(-25, 0, 13, 17, 43, 47), scaleY: goBack(0.3, 1, 13, 17, 43, 47), opacity: shownBetween(13, 47) }) })),
]
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

// 퍼센트 — 가로로 뒤집혀 두 동그라미가 자리를 바꿨다가(f9~14) 다시 뒤집혀 돌아온다(f29~35). 근사.
const PERCENT: IconSpec = {
  parts: [{ node: [0, 1, 2], origin: [12, 12], play: play({ scaleX: goBack(1, -1, 9, 14, 29, 35) }) }],
}

/** percent */
export function PercentIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="percent" spec={PERCENT} />
}

// 전화 — 벨이 울리듯 좌우로 떨린다(f8~42). 근사.
const PHONE: IconSpec = {
  parts: [{ node: 0, origin: [12, 12], play: play({ rotate: [[0, 0], [f5(8), 0, 'linear'], [f5(11), -10], [f5(14), 10], [f5(17), -9], [f5(20), 9], [f5(23), -8], [f5(26), 8], [f5(29), -6], [f5(32), 6], [f5(36), -3], [f5(42), 0]] }) }],
}

/** phone */
export function PhoneIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone" spec={PHONE} />
}

// 걸려 온 전화 — 소리 물결(호 둘)이 꺼졌다 안쪽부터 차례로 켜지기를 되풀이한다(f8~42). 근사.
const PHONE_CALL: IconSpec = {
  nodes: [
    ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
    ['path', { d: 'M15.05 5A5 5 0 0 1 19 8.95' }],
    ['path', { d: 'M15.05 1A9 9 0 0 1 23 8.94' }],
  ],
  parts: [
    { node: 1, play: play({ opacity: [[0, 1], [f5(8), 1, 'linear'], [f5(11), 0], [f5(15), 0, 'linear'], [f5(18), 1], [f5(24), 1, 'linear'], [f5(26), 0], [f5(29), 0, 'linear'], [f5(32), 1]] }) },
    { node: 2, play: play({ opacity: [[0, 1], [f5(8), 1, 'linear'], [f5(10), 0], [f5(18), 0, 'linear'], [f5(21), 1], [f5(24), 1, 'linear'], [f5(25), 0], [f5(32), 0, 'linear'], [f5(36), 1]] }) },
  ],
}

/** phone-call */
export function PhoneCallIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone-call" spec={PHONE_CALL} />
}

// 꺼진 전화 — 사선이 걷히며 온전한 수화기가 되어 떨리다가(f11~38) 사선이 다시 그어진다(f38~44). 근사.
const PHONE_OFF: IconSpec = {
  parts: [
    { node: 1, play: play({ pathLength: [[0, 1], [f5(9), 1, 'linear'], [f5(14), 0, 'easeIn'], [f5(38), 0, 'linear'], [f5(44), 1, 'easeOut']], opacity: hiddenBetween(14, 38) }) },
    { node: 0, play: play({ opacity: hiddenBetween(12, 40) }) },
    {
      shape: ['path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }],
      origin: [12, 12],
      play: play({ opacity: shownBetween(12, 40), rotate: [[0, 0], [f5(14), 0, 'linear'], [f5(17), -9], [f5(20), 9], [f5(23), -8], [f5(26), 8], [f5(29), -6], [f5(32), 6], [f5(36), 0]] }),
    },
  ],
}

/** phone-off */
export function PhoneOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="phone-off" spec={PHONE_OFF} />
}

// 핀 — 통통 튄 뒤(f13~22) 0.8로 작아지며 끝(아래)을 축으로 15° 기울었다가(f22~45) 돌아온다(f45~52). 근사.
const MAP_PIN: IconSpec = {
  parts: [
    {
      origin: [12, 23],
      play: play({ y: [[0, 0], [f5(13), 0, 'linear'], [f5(17), -3, 'easeOut'], [f5(22), 0, 'easeIn']], scale: [[0, 1], [f5(21), 1, 'linear'], [f5(27), 0.8], [f5(45), 0.8, 'linear'], [f5(52), 1]], rotate: [[0, 0], [f5(22), 0, 'linear'], [f5(28), 15], [f5(45), 15, 'linear'], [f5(52), 0]] }),
      parts: [{ node: [0, 1] }],
    },
  ],
}

/** map-pin */
export function MapPinIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="map-pin" spec={MAP_PIN} />
}

const PLAY: IconSpec = { parts: playPause(0, [[8, 5, 8, 19], [16, 5, 16, 19]]) }

/** play */
export function PlayIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="play" spec={PLAY} />
}

const PLAY_CIRCLE: IconSpec = { parts: playPause(1, [[10, 8.5, 10, 15.5], [14, 8.5, 14, 15.5]]) }

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

// 포켓 — 안쪽 갈매기가 체크 → 두 눈(웃는 얼굴)으로 바뀌었다가(f11~20) 갈매기로 돌아온다(f20~23). 근사.
const POCKET: IconSpec = {
  parts: [
    { node: 1, play: play({ points: [[0, '8 10 12 14 16 10'], [f5(10), '8 10 12 14 16 10', 'linear'], [f5(12), '8.5 11 11 13.5 16 9'], [f5(15), '9 10 9 10 9 10'], [f5(20), '9 10 9 10 9 10', 'linear'], [f5(23), '8 10 12 14 16 10']] }) },
    { shape: ['line', { x1: 15, y1: 10, x2: 15.01, y2: 10 }], play: play({ opacity: shownBetween(15, 20) }) },
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

// 라디오 — 안쪽·바깥 전파가 꺼졌다 차례로 다시 켜진다(f10~33). 근사.
const RADIO: IconSpec = {
  nodes: [
    ['circle', { cx: 12, cy: 12, r: 2 }],
    ['path', { d: 'M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49' }],
    ['path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14' }],
  ],
  parts: [
    { node: 1, play: play({ opacity: [[0, 1], [f5(10), 1, 'linear'], [f5(14), 0.2], [f5(20), 0.2, 'linear'], [f5(26), 1]] }) },
    { node: 2, play: play({ opacity: [[0, 1], [f5(10), 1, 'linear'], [f5(13), 0], [f5(23), 0, 'linear'], [f5(31), 1]] }) },
  ],
}

/** radio */
export function RadioIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="radio" spec={RADIO} />
}

// 새로고침 — 화살표 둘이 돌며 점으로 줄었다가(f9~17) 다시 자라며 한 바퀴를 마저 돈다(f23~32). 근사.
const REFRESH_CW: IconSpec = {
  parts: [{ node: [0, 1, 2], origin: [12, 12], play: play({ rotate: [[0, 0], [f5(9), 0, 'linear'], [f5(32), 360]], scale: [[0, 1], [f5(9), 1, 'linear'], [f5(16), 0.1], [f5(23), 0.1, 'linear'], [f5(31), 1]] }) }],
}

/** refresh-cw */
export function RefreshCwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="refresh-cw" spec={REFRESH_CW} />
}

// 되돌리기 — 반시계로 돌며 점으로 줄었다가(f8~18) 다시 자라 제자리(f22~30). 근사.
const ROTATE_CCW: IconSpec = {
  parts: [{ node: [0, 1], origin: [12, 12], play: play({ rotate: [[0, 0], [f5(8), 0, 'linear'], [f5(30), -360]], scale: [[0, 1], [f5(8), 1, 'linear'], [f5(16), 0.1], [f5(22), 0.1, 'linear'], [f5(29), 1]] }) }],
}

/** rotate-ccw */
export function RotateCcwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="rotate-ccw" spec={ROTATE_CCW} />
}
