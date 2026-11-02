import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconPart, IconSpec } from './icon-types'

// 화살표 원 — 반 칸 물러섰다(f5~8) 앞으로 3칸 찌르고(f10~16) 되튕겨(f17~22) 제자리(f26). 영상 6주기 평균.
const ARROW_NUDGE = [0, 0.91, 1.52, 1.85, 1.85, 1.85, 0.41, -1.12, -2.1, -2.6, -3.0, -3.22, -3.22, -1.14, 0.5, 1.32, 1.74, 1.86, 1.25, 0.75, 0.36, 0.07, 0]

// 영상 1줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

const ARROW_DOWN_CIRCLE: IconSpec = {
  parts: [{ node: [1, 2], play: play({ y: trace(5, ARROW_NUDGE.map((v) => -v)) }) }],
}

/** arrow-down-circle */
export function ArrowDownCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="arrow-down-circle" spec={ARROW_DOWN_CIRCLE} />
}

const ALERT_CIRCLE: IconSpec = {
  parts: [
    {
      // 느낌표 막대 — 위로 빨려 나갔다가(f0~7) 비스듬히 떨어져 들어와(f18.5~25.5) 진자처럼 흔들린다(아래 끝 기준)
      node: 1,
      origin: [12, 12],
      play: play({
        y: [[0, 0], [fr(7), -14, 'easeIn'], [fr(18.5), -14, 'linear'], [fr(25.5), 0, [0.25, 0.46, 0.45, 0.94]]],
        rotate: [[0, 0], [fr(18.5), 0, 'linear'], ...trace(19, [-20, -20, -20, -19, -16, -13, -11, -10, -8, -4, 1, 6, 11, 14, 15, 15, 15, 15, 13, 11, 8, 5, 2.5, 1, 0])],
      }),
    },
    {
      // 점 — 막대 자리(y 8)까지 올라가 기다렸다가 막대에 밀려 내려온다
      node: 2,
      play: play({ y: [[0, 0], [fr(17), -7.9, 'easeOut'], [fr(22), -7.9, 'linear'], [fr(29.5), 0, [0.25, 0.46, 0.45, 0.94]]] }),
    },
  ],
}

/** alert-circle */
export function AlertCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="alert-circle" spec={ALERT_CIRCLE} />
}

const ARROW_LEFT_CIRCLE: IconSpec = {
  parts: [{ node: [1, 2], play: play({ x: trace(5, ARROW_NUDGE) }) }],
}

/** arrow-left-circle */
export function ArrowLeftCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="arrow-left-circle" spec={ARROW_LEFT_CIRCLE} />
}

// 바로 다음 순간(0.1프레임 뒤)에 값을 바꾼다 — 안 보일 때 갈아 끼우는 용도
const swap = (frame: number, from: number, to: number): Key[] => [[fr(frame), from, 'linear'], [fr(frame + 0.1), to, 'linear']]

/**
 * 가운데 정렬의 한 줄 — 가운데 토막은 줄 가운데로 오그라들며 흐려지고, 양 끝에 남은 짧은 토막이
 * 가운데로 자라 다시 한 줄이 된다(영상 단면에서 프레임마다 잰 길이). 쉴 때는 원래 선 하나만 보인다.
 */
function splitLine(
  node: number,
  [left, right, y]: readonly [number, number, number],
  centre: { x1: Key[]; x2: Key[]; fade: Key[] },
  stub: { from: number; lengths: readonly number[] },
): IconPart[] {
  const done = stub.from + stub.lengths.length - 1
  const end = (sign: 1 | -1, base: number) => [[0, 12], ...swap(stub.from - 0.6, 12, base + sign * stub.lengths[0]), ...trace(stub.from, stub.lengths.map((l) => base + sign * l)), ...swap(done, 12, 12)] as Key[]
  const shown: Key[] = [[0, 0], ...swap(stub.from - 0.6, 0, 1), ...swap(done, 1, 0)]
  return [
    { node, play: play({ x1: [[0, right], ...centre.x1, ...swap(done, 12, right)], x2: [[0, left], ...centre.x2, ...swap(done, 12, left)], opacity: [[0, 1], ...centre.fade, ...swap(done, 0, 1)] }) },
    { shape: ['line', { x1: left, y1: y, x2: 12, y2: y }], play: play({ x2: end(1, left), opacity: shown }) },
    { shape: ['line', { x1: right, y1: y, x2: 12, y2: y }], play: play({ x2: end(-1, right), opacity: shown }) },
  ]
}

// 긴 줄(y 6·14)의 끝 토막 — f11 0.6 → f22에 가운데(9)에서 만난다
const LONG_STUB = { from: 11, lengths: [0.6, 0.7, 1, 1.55, 2.2, 3.05, 4.1, 5.1, 6, 6.85, 7.75, 9] }
const shrinkTo12 = (from: number, to: number, edge: number): Key[] => [[fr(from), edge, 'linear'], [fr(to), 12, 'linear']]

const ALIGN_CENTER: IconSpec = {
  parts: [
    // 위 긴 줄 — f10부터 가운데 토막이 오그라들며 반쯤 흐려져 f15.5에 사라진다
    ...splitLine(1, [3, 21, 6], { x1: shrinkTo12(10.2, 15.5, 21), x2: shrinkTo12(10.2, 15.5, 3), fade: [[fr(10), 1, 'linear'], [fr(15.5), 0.5, 'linear'], [fr(15.6), 0, 'linear']] }, LONG_STUB),
    // 셋째 긴 줄 — 끝 토막은 같이 자라지만 가운데 토막은 f13에야 빠르게(3프레임) 오그라든다
    ...splitLine(2, [3, 21, 14], { x1: shrinkTo12(13.1, 16, 21), x2: shrinkTo12(13.1, 16, 3), fade: [[fr(13), 1, 'linear'], [fr(14), 0.58, 'linear'], [fr(15.9), 0.5, 'linear'], [fr(16), 0, 'linear']] }, LONG_STUB),
    // 넷째 짧은 줄 — f16.3부터 빨리 줄었다 느려지며 f21.5에 사라지고, 끝 토막은 f17 → f27
    ...splitLine(
      3,
      [6, 18, 18],
      {
        x1: [[fr(16.3), 18, 'linear'], ...trace(17, [16, 14.8, 14, 13.1, 12.3]), [fr(21.5), 12, 'linear']],
        x2: [[fr(16.3), 6, 'linear'], ...trace(17, [8, 9.2, 10, 10.9, 11.7]), [fr(21.5), 12, 'linear']],
        fade: [[fr(16), 0.92, 'linear'], ...trace(17, [0.88, 0.75, 0.64, 0.6, 0.5]), [fr(21.6), 0, 'linear']],
      },
      { from: 17, lengths: [0.4, 0.45, 0.7, 0.9, 1.45, 1.95, 2.7, 3.35, 4.1, 4.85, 6] },
    ),
    // 둘째 짧은 줄 — 가장 늦게(f19.3) 한쪽으로 쏠리며 2프레임 만에 사라진다
    ...splitLine(
      0,
      [6, 18, 10],
      {
        x1: [[fr(19.3), 18, 'linear'], [fr(20), 17, 'linear'], [fr(21), 10.6, 'linear'], [fr(21.3), 10.5, 'linear']],
        x2: [[fr(19.3), 6, 'linear'], [fr(20), 10.2, 'linear'], [fr(21), 10.4, 'linear'], [fr(21.3), 10.5, 'linear']],
        fade: [[fr(20), 0.98, 'linear'], [fr(21), 0.5, 'linear'], [fr(21.4), 0, 'linear']],
      },
      { from: 20, lengths: [1.4, 1.5, 1.85, 2.7, 3.25, 4.05, 4.6, 6] },
    ),
  ],
}

/** align-center */
export function AlignCenterIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="align-center" spec={ALIGN_CENTER} />
}

/**
 * 왼쪽·오른쪽 정렬의 한 줄 — 줄 전체가 옆으로 비켜서는 동안(shift) 원래 선은 한쪽 끝으로 빨려 들며
 * 흐려지고(out), 같은 선이 반대쪽 끝에서 흐릿하게 자라 나와 또렷해진다(grow). done에 원래 선으로 갈아 끼운다.
 * attr는 원래 선에서 움직이는 끝의 속성, from → to는 그 끝이 가는 길(새 선은 from에 붙어 to로 자란다).
 */
function wipeLine(
  node: number,
  { y, attr, from, to }: { y: number; attr: 'x1' | 'x2'; from: number; to: number },
  t: { shift: Key[]; out: Key[]; outFade: Key[]; grow: Key[]; growFade: Key[]; done: number },
): IconPart {
  return {
    play: play({ x: t.shift }),
    parts: [
      { node, play: play({ [attr]: [[0, from], ...t.out, ...swap(t.done, to, from)], opacity: [[0, 1], ...t.outFade, ...swap(t.done, 0, 1)] }) },
      { shape: ['line', { x1: from, y1: y, x2: from, y2: y }], play: play({ x2: [[0, from], ...t.grow, ...swap(t.done, to, from)], opacity: [[0, 0], ...t.growFade, ...swap(t.done, 1, 0)] }) },
    ],
  }
}

const shiftKeys = (start: number, held: number, back: number, end: number, amount: number, ease: number = start + 2.4): Key[] => [
  [fr(start), 0, 'linear'],
  [fr(ease), amount * 0.73, 'linear'],
  [fr(held), amount, 'easeOut'],
  [fr(back), amount, 'linear'],
  [fr(end), 0, 'easeInOut'],
]

// 왼쪽 정렬 — 위 두 줄(y 6·10)이 f8.6, 아래 두 줄(y 14·18)이 2프레임 늦게 왼쪽으로 1.5~1.9 비켜선다.
// 긴 줄은 f9.3부터 왼끝으로 빨려 들고(f15.6) 새 선이 오른끝에서 자라 f26에 다 찬다. 짧은 줄은 5프레임 늦다.
const ALIGN_LEFT: IconSpec = {
  parts: [
    wipeLine(1, { y: 6, attr: 'x1', from: 21, to: 3 }, {
      shift: shiftKeys(8.6, 13, 28.5, 34, -1.75),
      out: [[fr(9.3), 21, 'linear'], [fr(15.6), 3, 'linear']],
      outFade: [[fr(10), 1, 'linear'], [fr(15.5), 0.52, 'linear'], [fr(15.7), 0, 'linear']],
      grow: [[fr(12.8), 21, 'linear'], ...trace(14, [15.7, 13.85, 11.6, 10.2, 8.6, 7.35, 6.2, 5.35, 4.6, 4.1, 3.5, 3.2, 3])],
      growFade: [[fr(12.7), 0, 'linear'], [fr(12.8), 0.5, 'linear'], ...trace(14, [0.54, 0.56, 0.6, 0.69, 0.8, 0.9, 1])],
      done: 26.5,
    }),
    wipeLine(2, { y: 14, attr: 'x1', from: 21, to: 3 }, {
      shift: shiftKeys(10.6, 15, 31.3, 35.8, -1.9),
      out: [[fr(9.3), 21, 'linear'], [fr(15.9), 3, 'linear']],
      outFade: [[fr(10.5), 1, 'linear'], [fr(15.5), 0.5, 'linear'], [fr(16), 0, 'linear']],
      grow: [[fr(13), 21, 'linear'], ...trace(14, [16.6, 13.85, 11.87, 10.25, 8.75, 7.62, 6.37, 5.38, 4.75, 4.25, 3.63, 3.25, 3])],
      growFade: [[fr(12.9), 0, 'linear'], [fr(13), 0.48, 'linear'], ...trace(14, [0.5, 0.55, 0.58, 0.71, 0.84, 0.9, 1])],
      done: 26.5,
    }),
    wipeLine(0, { y: 10, attr: 'x1', from: 17, to: 3 }, {
      shift: shiftKeys(8.6, 13, 29.3, 34, -1.55),
      out: [[fr(14.2), 17, 'linear'], [fr(21.3), 3, 'linear']],
      outFade: [[fr(14.5), 1, 'linear'], [fr(20.5), 0.52, 'linear'], [fr(21.3), 0.45, 'linear'], [fr(21.4), 0, 'linear']],
      grow: [[fr(18.3), 17, 'linear'], ...trace(19, [14.4, 11, 9.9, 8.5, 7.4, 6.27, 5.28, 4.65, 4.03, 3.53, 3.3, 3])],
      growFade: [[fr(18.2), 0, 'linear'], [fr(18.3), 0.44, 'linear'], ...trace(19, [0.46, 0.59, 0.61, 0.75, 0.83, 0.92, 0.96, 0.98, 1])],
      done: 30.5,
    }),
    wipeLine(3, { y: 18, attr: 'x1', from: 17, to: 3 }, {
      shift: shiftKeys(10.6, 14.5, 31.5, 35.3, -1.5),
      out: [[fr(14.1), 17, 'linear'], [fr(21.6), 3, 'linear']],
      outFade: [[fr(14.4), 1, 'linear'], [fr(20.5), 0.47, 'linear'], [fr(21.6), 0.4, 'linear'], [fr(21.7), 0, 'linear']],
      grow: [[fr(18.3), 17, 'linear'], ...trace(19, [13, 11, 9.7, 8.1, 7.1, 6.1, 5.2, 4.5, 4, 3.7, 3])],
      growFade: [[fr(18.2), 0, 'linear'], [fr(18.3), 0.44, 'linear'], ...trace(19, [0.47, 0.6, 0.69, 0.77, 0.86, 0.96, 1])],
      done: 30.5,
    }),
  ],
}

/** align-left */
export function AlignLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="align-left" spec={ALIGN_LEFT} />
}

// 오른쪽 정렬 — 왼쪽 정렬의 거울: 오른쪽으로 비켜서고, 원래 선은 오른끝으로 빨려 들며, 새 선은 왼끝에서 자란다.
const ALIGN_RIGHT: IconSpec = {
  parts: [
    wipeLine(1, { y: 6, attr: 'x2', from: 3, to: 21 }, {
      shift: shiftKeys(8.6, 13, 29.5, 33.5, 1.65),
      out: [[fr(9.2), 3, 'linear'], [fr(15.8), 21, 'linear']],
      outFade: [[fr(10.5), 1, 'linear'], [fr(15.5), 0.5, 'linear'], [fr(15.9), 0, 'linear']],
      grow: [[fr(14.2), 3, 'linear'], [fr(15), 9, 'linear'], ...trace(16, [12.4, 13.9, 15.6, 16.9, 18, 19, 19.6, 20.1, 20.6, 20.9, 21])],
      growFade: [[fr(14.1), 0, 'linear'], [fr(14.2), 0.5, 'linear'], ...trace(15, [0.52, 0.62, 0.71, 0.81, 0.95, 1])],
      done: 27,
    }),
    wipeLine(2, { y: 14, attr: 'x2', from: 3, to: 21 }, {
      shift: shiftKeys(10.6, 15, 31.5, 35.5, 1.62),
      out: [[fr(9.2), 3, 'linear'], [fr(15.6), 21, 'linear']],
      outFade: [[fr(11), 1, 'linear'], [fr(15.3), 0.5, 'linear'], [fr(15.6), 0, 'linear']],
      grow: [[fr(14.2), 3, 'linear'], [fr(15), 9.75, 'linear'], ...trace(16, [12.3, 14, 15.65, 16.9, 18, 18.9, 19.65, 20.3, 20.9, 21.15, 21])],
      growFade: [[fr(14.1), 0, 'linear'], [fr(14.2), 0.52, 'linear'], ...trace(15, [0.55, 0.65, 0.73, 0.82, 0.96, 1])],
      done: 27,
    }),
    wipeLine(0, { y: 10, attr: 'x2', from: 7, to: 21 }, {
      shift: shiftKeys(8.6, 13, 30.5, 33.5, 1.45),
      out: [[fr(14.1), 7, 'linear'], [fr(21), 21, 'linear']],
      outFade: [[fr(15), 1, 'linear'], [fr(20.5), 0.52, 'linear'], [fr(21), 0.45, 'linear'], [fr(21.1), 0, 'linear']],
      grow: [[fr(18.6), 7, 'linear'], ...trace(20, [13.45, 14.7, 15.95, 16.8, 18.2, 19.07, 19.8, 20.3, 20.95, 21])],
      growFade: [[fr(18.5), 0, 'linear'], [fr(18.6), 0.6, 'linear'], ...trace(20, [0.64, 0.62, 0.77, 0.95, 1])],
      done: 30,
    }),
    wipeLine(3, { y: 18, attr: 'x2', from: 7, to: 21 }, {
      shift: shiftKeys(10.6, 14.5, 31.5, 35, 1.5),
      out: [[fr(14.1), 7, 'linear'], [fr(21.1), 21, 'linear']],
      outFade: [[fr(16), 1, 'linear'], [fr(17), 0.8, 'linear'], [fr(19), 0.65, 'linear'], [fr(20.8), 0.5, 'linear'], [fr(21.2), 0, 'linear']],
      grow: [[fr(18.6), 7, 'linear'], ...trace(20, [13.28, 14.77, 15.9, 16.77, 18, 18.77, 19.65, 20.15, 20.65, 21])],
      growFade: [[fr(18.5), 0, 'linear'], [fr(18.6), 0.6, 'linear'], ...trace(20, [0.62, 0.65, 0.77, 0.95, 1])],
      done: 30,
    }),
  ],
}

/** align-right */
export function AlignRightIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="align-right" spec={ALIGN_RIGHT} />
}

// 팔각형 느낌표 — 막대와 점이 위로 솟으며 한 덩이로 뭉쳤다가(f5~11) 작은 방울이 되어 떨어지고(f16~22),
// 다시 늘어나 막대와 점으로 갈라진 뒤 막대가 점(12,16)을 축으로 16° 기울었다 선다(f23~37). 덩어리 길이·위치를 프레임마다 잼.
const ALERT_OCTAGON: IconSpec = {
  parts: [
    {
      node: 1,
      origin: [12, 16],
      play: play({
        y1: trace(4, [8, 6.6, 4.4, 4.1, 4.5, 6.2, 7.6, 7.9, 7.9, 7.9, 7.9, 7.9, 8.1, 8.4, 9.3, 10, 10.6, 11.1, 11.45, 11, 10.8, 10.4, 10.2, 9.3, 9.1, 8.3, 8.4, 8.3, 8]),
        y2: trace(4, [12, 10.6, 9.2, 9.6, 9.7, 9.4, 9.4, 9.4, 9.4, 9.4, 9.4, 9.4, 9.2, 9.8, 10.1, 10.6, 11.2, 11.7, 12, 12.1, 12.1, 12.1, 12.1, 11.9, 11.8, 11.75, 11.8, 11.9, 12]),
        rotate: trace(23, [3, 5, 10, 10, 13.3, 13.5, 15.7, 15.7, 13, 11.3, 8.1, 5.1, 2.4, 0.9, 0]),
      }),
    },
    {
      node: 2,
      play: play({ y: trace(4, [0, -1.46, -3.06, -5.5, -6, -6.6, -6.6, -6.6, -6.6, -6.6, -6.6, -6.6, -6.8, -6.2, -5.9, -5.4, -4.8, -4.3, -4, -3.3, -2.7, -2.2, -1.38, -1.05, -0.89, -0.62, -0.34, -0.23, -0.18, -0.16, -0.14, -0.1, -0.05, 0]) }),
    },
  ],
}

/** alert-octagon */
export function AlertOctagonIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="alert-octagon" spec={ALERT_OCTAGON} />
}

// 삼각형 느낌표 — 막대가 아래 끝으로 빨려 들어(f5~12) 점과 뭉친 방울이 막대 자리까지 떠오르고(f13~21),
// 점이 아래에서 다시 나타나(f23) 막대와 한 줄로 길게 이어졌다가(f27~34) 툭 끊기며 제자리(f35~37).
const ALERT_TRIANGLE: IconSpec = {
  parts: [
    {
      node: 1,
      play: play({
        y1: trace(4, [9, 9.44, 9.72, 10.08, 10.6, 11.2, 11.62, 12.46, 12.86, 15.6, 14.98, 14.25, 13.34, 12.65, 11.89, 11.55, 11.01, 10.69, 10.69, 10.56, 10.56, 10.56, 10.56, 10.65, 10.9, 10.9, 9.8, 8.9, 8.3, 8.15, 8.15, 8.65, 8.8, 9]),
        y2: trace(4, [13, 13, 13, 13, 13, 13, 13, 13, 13, 16.6, 15.98, 15.25, 14.34, 13.65, 12.89, 12.55, 12.01, 11.69, 11.69, 11.56, 11.56, 11.56, 11.56, 15.3, 15.3, 15, 14.5, 14.5, 15.5, 16.1, 16.3, 13, 13, 13]),
      }),
    },
    {
      node: 2,
      play: play({
        y: trace(4, [0, 0, 0, 0, 0, 0, 0, -0.05, -0.37, -0.9, -1.52, -2.25, -3.16, -3.85, -4.61, -4.95, -5.49, -5.81, -5.81, -1.8, -1.8, -2, -2.2, -1.05, -1.04, -1.35, -1.83, -1.82, -0.84, -0.2, 0, -0.09, -0.09, 0]),
      }),
    },
  ],
}

/** alert-triangle */
export function AlertTriangleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="alert-triangle" spec={ALERT_TRIANGLE} />
}

// 닻 — 고리(12,5)를 축으로 22° 기울며 3 떠올랐다가(f8~16) 그대로 아래로 떨어져 30칸 창 밖으로 나가고,
// 같은 닻이 위에서 내려와(f18~24) 2.8 지나쳤다 제자리로 올라온다(f26~35). 영상은 24칸보다 사방 3칸 넓은 창에서 자른다.
const ANCHOR_SWAY = trace(7, [0, 1, 6.5, 15, 20.5, 21.8, 21.8, 21.8, 21.8, 21.8, 22, 21.5, 21, 20.5, 20, 18.8, 10, 4.3, 1.3, 0])
const ANCHOR: IconSpec = {
  overflow: true,
  nodes: [
    ['circle', { cx: 12, cy: 5, r: 3 }],
    ['line', { x1: 12, y1: 22, x2: 12, y2: 8 }],
    ['path', { d: 'M5 12H2a10 10 0 0 0 20 0h-3' }],
    // 위에서 들어오는 같은 닻(30칸 위)
    ['circle', { cx: 12, cy: -25, r: 3 }],
    ['line', { x1: 12, y1: -8, x2: 12, y2: -22 }],
    ['path', { d: 'M5 -18H2a10 10 0 0 0 20 0h-3' }],
  ],
  parts: [
    {
      clip: [['rect', { x: -3, y: -3, width: 30, height: 30 }]],
      play: play({
        y: trace(6, [0, 0, -0.2, -0.95, -2.1, -2.85, -3, -3, -3, -3, -2.3, 0.3, 4.7, 12, 18.6, 23.7, 26.3, 28.2, 30.95, 32.38, 32.8, 32.8, 32.8, 32.65, 32.27, 31.75, 31.2, 30.65, 30.3, 30.02, 30]),
      }),
      parts: [
        { node: [0, 1, 2], origin: [12, 5], play: play({ rotate: ANCHOR_SWAY }) },
        { node: [3, 4, 5], origin: [12, -25], play: play({ rotate: ANCHOR_SWAY }) },
      ],
    },
  ],
}

/** anchor */
export function AnchorIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="anchor" spec={ANCHOR} />
}

// 조리개 — 날 6개 = 중심에서 거리 d만큼 떨어진 직선의 '안쪽 꼭짓점 → 원' 구간(d 4가 Feather 원본).
// 세 번 딸깍 열리며(f12·f21·f30) d 4 → 4.8 → 5.6 → 6.4, 그때마다 시계 방향으로 40° → 60° → 80° 돌고,
// f40부터 반대로 풀리며 닫힌다(f53). 영상 프레임마다 (회전, d)를 모형에 맞춰 찾은 값.
const APERTURE_D = [4, 4.2, 4.7, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.9, 5.5, 5.6, 5.6, 5.6, 5.6, 5.6, 5.6, 5.6, 5.8, 6.3, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.3, 6.2, 6.1, 6, 5.6, 4.8, 4.5, 4.3, 4.2, 4.1, 4.05, 4]
const APERTURE_TURN = [0, 12, 36, 40, 40, 40, 40, 40, 40, 41, 58, 60, 60, 60, 60, 60, 60, 60, 64, 78, 80, 80, 80, 80, 80, 80, 80, 80, 80, 78, 75, 73, 69, 64, 53, 28, 16, 11, 8, 5, 3, 1, 0]

/** 날 i(법선 30°+60°·i)의 끝점 — 이웃 날과 만나는 안쪽 꼭짓점에서 감기는 방향으로 원(r 10)까지 */
function apertureBlade(i: number, d: number): number[] {
  const normal = (k: number) => {
    const a = ((30 + 60 * k) * Math.PI) / 180
    return [Math.cos(a), Math.sin(a)]
  }
  const [nx, ny] = normal(i)
  const [mx, my] = normal((i + 5) % 6)
  const det = nx * my - ny * mx
  const vx = (d * my - d * ny) / det
  const vy = (nx * d - mx * d) / det
  const [dx, dy] = [-ny, nx]
  const b = vx * dx + vy * dy
  const t = -b + Math.sqrt(b * b - (vx * vx + vy * vy - 100))
  return [12 + vx, 12 + vy, 12 + vx + dx * t, 12 + vy + dy * t].map((v) => +v.toFixed(3))
}

const APERTURE: IconSpec = {
  nodes: [['circle', { cx: 12, cy: 12, r: 10 }], ...Array.from({ length: 6 }, (_, i) => ['line', Object.fromEntries(['x1', 'y1', 'x2', 'y2'].map((k, j) => [k, apertureBlade(i, 4)[j]]))] as const)],
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: trace(11, APERTURE_TURN) }),
      parts: Array.from({ length: 6 }, (_, i) => ({
        node: i + 1,
        play: play(Object.fromEntries(['x1', 'y1', 'x2', 'y2'].map((k, j) => [k, trace(11, APERTURE_D.map((d) => apertureBlade(i, d)[j]))]))),
      })),
    },
  ],
}

/** aperture */
export function ApertureIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="aperture" spec={APERTURE} />
}
