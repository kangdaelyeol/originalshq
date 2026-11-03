import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconPart, IconSpec } from './icon-types'

// 영상 8~9줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]
// 같은 값을 n프레임 동안 그대로
const hold = (n: number, row: readonly number[]) => Array<readonly number[]>(n).fill(row)

// 펜과 밑줄 — 전체가 (12,18) 기준 0.8로 줄고(f4~8), 연필이 촉을 축으로 81° 반대로 눕으며 오른쪽 끝(촉 x 21)까지
// 미끄러진다(f8~18). 지나간 자리의 밑줄은 지워지고 왼쪽에 글줄 두 개가 그려진다(f10~17). f24~36에 거꾸로 돌아온다.
// 영상 4주기(f71~) 맞춤값 — 연필은 촉 이동·각도, 줄은 끝 위치를 길이 비율로.
const EDIT_TEXT_LINE = [0, 0.236, 0.52, 0.698, 0.834, 0.904, 0.97, 0.992, 1, 1, 1, 1, 1, 1, 1, 0.764, 0.48, 0.25, 0.088, 0]
const EDIT_TEXT_SHORT = [0, 0.25, 0.607, 0.757, 0.895, 0.99, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.835, 0.524, 0.29, 0.12, 0]
// 길이 0인 줄도 둥근 끝 점이 남아서 — 그리는 동안만 보이게
const EDIT_TEXT_SHOW: Key[] = [[fr(10), 0], [fr(10.5), 1, 'linear'], [fr(28.5), 1, 'linear'], [fr(29), 0, 'linear']]

const EDIT_3: IconSpec = {
  parts: [
    {
      origin: [12, 18],
      play: play({ scale: [...trace(3, [1, 0.916, 0.856, 0.822, 0.804, 0.8]), ...trace(36, [0.8, 0.881, 0.944, 0.983, 1])] }),
      parts: [
        {
          // 연필 — 촉(3,20)을 축으로 돌며 촉이 밑줄을 따라 오른쪽 끝까지
          node: 1,
          origin: [3, 20],
          play: play({
            x: trace(8, [0, 3.29, 7.555, 10.81, 13.42, 15.2, 16.35, 17.27, 17.7, 18.06, 18.13, 18.13, 18.13, 18.13, 18.13, 18.13, 18.13, 15.67, 11.965, 8.835, 6.33, 4.536, 3.02, 2.03, 1.22, 0.624, 0.353, 0.099, 0]),
            rotate: trace(8, [0, -14.5, -33.8, -48.3, -59.7, -67.6, -72.9, -76.9, -79, -80.8, -81, -81, -81, -81, -81, -81, -81, -69.8, -53.6, -39.4, -28.3, -20, -13.4, -9.2, -5.5, -2.7, -1.4, -0.3, 0]),
          }),
        },
        // 밑줄 — 촉이 지나가는 대로 왼쪽부터 지워졌다가, 돌아올 땐 오른쪽 끝부터 다시 그려진다
        // (pathOffset만으론 대시가 안 생겨 pathLength 1을 같이 둔다)
        { node: 0, play: play({ pathLength: [[0, 1], [fr(34), 1, 'linear']], pathOffset: trace(10, [0, 0.2, 0.49, 0.69, 0.82, 0.92, 0.97, 1, 1, 1, 1, 1, 1, 1, 1, 0.81, 0.643, 0.478, 0.321, 0.208, 0.13, 0.088, 0.03, 0.016, 0]) }) },
        // 왼쪽 글줄 둘 — 같이 그려지고(f10~17) 같이 거둬진다(f24~29)
        { shape: ['line', { x1: 5.1, y1: 20, x2: 14.05, y2: 20 }], play: play({ pathLength: trace(10, EDIT_TEXT_LINE), opacity: EDIT_TEXT_SHOW }) },
        { shape: ['line', { x1: 5.1, y1: 15.75, x2: 10.25, y2: 15.75 }], play: play({ pathLength: trace(10, EDIT_TEXT_SHORT), opacity: EDIT_TEXT_SHOW }) },
      ],
    },
  ],
}

/** edit-3 */
export function Edit3Icon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="edit-3" spec={EDIT_3} />
}

// 바깥 링크 — 화살표가 상자 안쪽으로 대각선 5칸 들어가고(f8~17) 그만큼 상자 입구가 양쪽에서 3칸씩 벌어지며
// 아이콘 전체가 0.9로 줄었다가(f9~16) f26~35에 되돌아온다. 영상 3주기 평균(촉 모서리 위치, 상자 배율·끝 위치).
const EXT_X = [-0.1, -0.21, -0.37, -0.96, -2.61, -4.12, -4.74, -4.88, -5.03, -5.07, -5.07, -5.07, -5.07, -5.07, -5.07, -5.07, -5.07, -5.07, -5.03, -4.9, -4.78, -4.33, -3.53, -1.58, -0.7, -0.3, -0.21, -0.1, 0]
const EXT_Y = [0.09, 0.2, 0.51, 1.1, 2.57, 4.06, 4.67, 4.82, 4.96, 5.17, 5.17, 5.17, 5.17, 5.17, 5.17, 5.17, 5.17, 5.17, 5.06, 4.84, 4.72, 4.47, 3.46, 1.68, 0.72, 0.45, 0.17, 0.09, 0]

const EXTERNAL_LINK: IconSpec = {
  root: play({
    scale: trace(8, [1, 0.998, 0.992, 0.981, 0.953, 0.921, 0.909, 0.908, 0.903, 0.902, 0.902, 0.902, 0.902, 0.902, 0.902, 0.902, 0.902, 0.902, 0.903, 0.905, 0.908, 0.918, 0.937, 0.971, 0.982, 0.996, 0.998, 1]),
  }),
  parts: [
    {
      // 상자 — 열린 두 끝(오른쪽 변 위, 윗변 오른쪽)이 3칸씩 물러나 화살표 들어올 자리를 낸다
      node: 0,
      play: play({
        pathOffset: trace(8, [0, 0.006, 0.014, 0.025, 0.039, 0.055, 0.063, 0.072, 0.077, 0.077, 0.077, 0.077, 0.077, 0.077, 0.077, 0.077, 0.077, 0.077, 0.076, 0.071, 0.065, 0.06, 0.047, 0.031, 0.022, 0.009, 0.006, 0.003, 0]),
        pathLength: trace(8, [1, 0.994, 0.976, 0.945, 0.921, 0.896, 0.871, 0.86, 0.851, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.851, 0.858, 0.867, 0.879, 0.909, 0.943, 0.955, 0.98, 0.986, 0.997, 1]),
      }),
    },
    // 화살촉 — 모서리가 대각선으로 상자 안까지
    { node: 1, play: play({ x: trace(8, EXT_X), y: trace(8, EXT_Y) }) },
    // 화살대 — 시작점(10,14)은 두고 끝점만 촉 모서리를 따라간다
    { node: 2, play: play({ x2: trace(8, EXT_X.map((v) => 21 + v)), y2: trace(8, EXT_Y.map((v) => 3 + v)) }) },
  ],
}

/** external-link */
export function ExternalLinkIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="external-link" spec={EXTERNAL_LINK} />
}

// 눈 — 깜빡(f6~11, 위아래 곡선 높이 8→5.4→8)과 함께 전체가 0.9로 줄고, 눈매가 -14.8° 기울며(f9~14)
// 눈동자가 왼쪽 아래로 3.3칸 가며 1.2배로 커진다(f10~17). f28~33 돌아오고 f32~36 한 번 더 깜빡이며 원래 크기로.
// 깜빡임은 선 굵기가 그대로라 scaleY가 아니라 경로 모양(d)을 바꾼다. 영상 3주기 평균.
const eyeD = (a: number) => `M1 12s4-${a} 11-${a} 11 ${a} 11 ${a}-4 ${a}-11 ${a}-11-${a}-11-${a}z`
const EYE_BLINK = [...trace(5, [8, 7.657, 5.609, 5.356, 5.553, 7.761, 7.984, 8]), ...trace(31, [8, 7.788, 5.566, 5.382, 5.601, 7.673, 8])]
const EYE_LOOK_X = [...trace(9, [0, -0.189, -0.349, -0.73, -1.644, -2.634, -3.016, -3.173, -3.287, -3.29]), ...trace(27, [-3.29, -3.093, -2.717, -1.683, -0.584, -0.224, -0.037, -0.04, -0.056, 0])]
const EYE_LOOK_Y = [...trace(9, [0, 0.036, 0.043, 0.187, 0.446, 0.713, 0.819, 0.848, 0.866, 0.875]), ...trace(27, [0.875, 0.868, 0.754, 0.419, 0.12, 0.05, 0.023, 0.036, -0.02, 0])]
const EYE_LOOK_S = [...trace(9, [1, 1.02, 1.027, 1.044, 1.107, 1.157, 1.187, 1.19, 1.196, 1.2]), ...trace(27, [1.2, 1.197, 1.182, 1.105, 1.041, 1.022, 1.012, 1.005, 1.002, 1])]

const EYE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [...trace(6, [1, 0.985, 0.945, 0.913, 0.899, 0.9]), ...trace(32, [0.9, 0.913, 0.943, 0.984, 1])] }),
      parts: [
        {
          // 눈매 — 깜빡임(경로 높이)과 기울기
          node: 0,
          origin: [12, 12],
          play: play({
            d: EYE_BLINK.map(([t, a, ease]) => [t, eyeD(+a), ease] as const),
            rotate: [...trace(9, [0, -1.83, -7.43, -12.93, -14.57, -14.77, -14.83]), ...trace(28, [-14.83, -14.73, -13.07, -7.63, -2.43, -0.2, -0.2, -0.1, 0])],
          }),
        },
        // 눈동자 — 왼쪽 아래를 보며 커진다
        { node: 1, origin: [12, 12], play: play({ x: EYE_LOOK_X, y: EYE_LOOK_Y, scale: EYE_LOOK_S }) },
      ],
    },
  ],
}

/** eye */
export function EyeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="eye" spec={EYE} />
}

// 눈 감춤 — 사선이 (1,1) 쪽으로 걷히는 동안(f4~9) 끊긴 눈매·눈동자가 시계 방향으로 이어져 온전한 눈이 되고,
// 그 눈이 '눈'과 같은 동작(깜빡·기울기·눈동자)을 4프레임 늦게 한 뒤, 덜 뜬 채로 사선이 다시 그어지며(f39~44)
// 끊긴 자리가 거꾸로 걷힌다. 눈매는 Feather eye 곡선을 eye-off 끊김 자리에서 나눈 두 조각(이어질 부분까지 포함).
const EYE_OFF_P1 = [[17.941, 17.942], [16.316, 19.119], [14.323, 20], [12, 20], [5, 20], [1, 12], [1, 12], [1, 12], [2.786, 8.429], [6.059, 6.058], [7.172, 5.252], [8.456, 4.585], [9.901, 4.245]]
const EYE_OFF_P2 = [[9.901, 4.245], [10.567, 4.088], [11.267, 4], [12, 4], [19, 4], [23, 12], [23, 12], [23, 12], [22.253, 13.494], [20.84, 15.19], [20.068, 16.117], [19.098, 17.104], [17.941, 17.942]]
// 조각 경로 — 깜빡임은 y를 12 기준으로 a/8배
const pieceD = (pts: number[][], a: number) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : i % 3 === 1 ? 'C' : ''}${x} ${+(12 + (a / 8) * (y - 12)).toFixed(3)}`).join(' ')
const EYE_OFF_BLINK = [...trace(9, [8, 7.72, 5.61, 5.41, 5.61, 7.76, 7.99, 8]), ...trace(35, [8, 7.76, 5.62, 5.43, 5.42, 5.66, 6.7, 7.74, 8])]
const piecePlay = (pts: number[][], rest: number, open: number[], close: number[]) =>
  play({
    d: EYE_OFF_BLINK.map(([t, a, ease]) => [t, pieceD(pts, +a), ease] as const),
    pathLength: [...trace(4, [rest, ...open]), ...trace(42, [1, ...close])],
  })

const EYE_OFF: IconSpec = {
  nodes: [
    ['path', { d: pieceD(EYE_OFF_P1, 8) }],
    ['path', { d: pieceD(EYE_OFF_P2, 8) }],
    ['path', { d: 'M14.121 14.121A3 3 0 1 1 9.879 9.879A3 3 0 1 1 14.121 14.121' }],
    ['line', { x1: 1, y1: 1, x2: 23, y2: 23 }],
  ],
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [...trace(10, [1, 0.985, 0.938, 0.908, 0.9]), ...trace(36, [0.9, 0.913, 0.939, 0.981, 0.991, 0.996, 1])] }),
      parts: [
        {
          // 눈매 두 조각 — 끊긴 끝이 이어졌다(f4~7) 다시 끊긴다(f42~44)
          origin: [12, 12],
          play: play({ rotate: [...trace(13, [0, -2.2, -7.5, -12.9, -14.65, -14.8, -14.85]), ...trace(33, [-14.85, -13.25, -7.65, -1.85, -0.3, -0.1, 0])] }),
          parts: [
            { node: 0, play: piecePlay(EYE_OFF_P1, 0.8696, [0.9244, 0.9948, 1], [0.8696]) },
            { node: 1, play: piecePlay(EYE_OFF_P2, 0.8347, [0.9537, 1], [0.901, 0.8347]) },
          ],
        },
        {
          // 눈동자 — 반원이 시계 방향으로 마저 그려져 원이 되고, '눈'처럼 왼쪽 아래를 본다
          node: 2,
          origin: [12, 12],
          play: play({
            pathLength: [...trace(4, [0.5, 0.53, 0.665, 0.9, 0.995, 1]), ...trace(38, [1, 0.99, 0.945, 0.755, 0.61, 0.5])],
            x: [...trace(13, [0, -0.158, -0.329, -0.672, -1.66, -2.678, -3.024, -3.127, -3.229, -3.237]), ...trace(31, [-3.237, -3.057, -2.783, -1.688, -0.573, -0.218, -0.026, -0.03, 0])],
            y: [...trace(13, [0, 0.036, 0.023, 0.179, 0.432, 0.697, 0.818, 0.847, 0.858, 0.86]), ...trace(31, [0.86, 0.829, 0.746, 0.399, 0.118, 0.029, 0.005, -0.02, 0])],
            scale: [...trace(13, [1, 0.997, 1.018, 1.039, 1.089, 1.143, 1.18, 1.181, 1.189, 1.188]), ...trace(31, [1.188, 1.178, 1.158, 1.091, 1.02, 1.006, 0.992, 1, 1])],
          }),
        },
      ],
    },
    {
      // 사선 — (1,1) 쪽으로 걷혔다가(f4~9) 다시 그어진다(f38~44)
      node: 3,
      play: play({
        pathLength: [...trace(4, [1, 0.941, 0.696, 0.295, 0.058, 0]), ...trace(38, [0, 0.041, 0.183, 0.504, 0.809, 0.963, 1])],
        opacity: [[fr(8.5), 1], [fr(9), 0, 'linear'], [fr(38.5), 0, 'linear'], [fr(39), 1, 'linear']],
      }),
    },
  ],
}

/** eye-off */
export function EyeOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="eye-off" spec={EYE_OFF} />
}

const FF_SHRINK: Key[] = [...trace(7, [1, 0.996, 0.976, 0.946, 0.899, 0.847, 0.823, 0.808, 0.803, 0.8]), [fr(17.3), 0.8, 'linear'], [fr(17.35), 1, 'linear']]

// 빨리 감기 — 세모 둘이 제자리에서 0.8로 줄며 흐려지다가(f7~16) 오른쪽으로 빠져나가고(f12~17),
// 왼쪽 밖에서 원래 크기·밝기로 미끄러져 들어온다(f18~24). 영상은 24 상자가 아니라 x -3~28 창에서 잘린다.
// 영상의 두 세모는 Feather보다 0.24칸씩 붙어 있다(쉬는 모양 맞춤).
const FAST_FORWARD: IconSpec = {
  nodes: [
    ['polygon', { points: '12.75 19 21.75 12 12.75 5 12.75 19' }],
    ['polygon', { points: '2.22 19 11.22 12 2.22 5 2.22 19' }],
  ],
  overflow: true,
  parts: [
    {
      clip: [['rect', { x: -3, y: -6, width: 31, height: 36 }]],
      play: play({
        x: [...trace(11, [0, 0.55, 2.49, 6.65, 13.37, 20.1, 26.8]), [fr(17.2), 26.8, 'linear'], [fr(17.3), -27, 'linear'], ...trace(18, [-23.5, -19.8, -13.25, -6.58, -2.47, -0.54, 0])],
        // 넘어가는 순간(f17)은 숨긴다 — 오른쪽 끝에서 왼쪽 끝으로 건너뛰는 사이가 보이지 않게
        opacity: [...trace(7, [1, 0.961, 0.875, 0.783, 0.706, 0.629, 0.541, 0.49, 0.41, 0.37]), [fr(17), 0.33, 'linear'], [fr(17.1), 0, 'linear'], [fr(17.4), 0, 'linear'], [fr(17.5), 1, 'linear']],
      }),
      parts: [
        { node: 0, origin: [17.25, 12], play: play({ scale: FF_SHRINK }) },
        { node: 1, origin: [6.72, 12], play: play({ scale: FF_SHRINK }) },
      ],
    },
  ],
}

/** fast-forward */
export function FastForwardIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="fast-forward" spec={FAST_FORWARD} />
}

// 피그마 — 아래 물방울이 (12,16) 모서리로 오그라들어 사라지고(f4~8) 가운뎃줄이 가로로 눌려 세로 막대가 되며 내려가는
// 사이(f8~12) 윗줄 알약이 가운데로 내려온다(f10~13). 알약은 가로로 누운 캡슐이 세로축으로 도는 것처럼 길이가 줄었다
// 늘었다 하며(원 ↔ 알약) 이음매(반타원)가 이쪽저쪽으로 넘어간다(f13~53). 되돌아갈 때는 막대가 다시 생겨 가운뎃줄로
// 펴지고(f54~60) 알약이 위로 올라가며(f56~59) 물방울이 모서리에서 다시 자란다(f58~65).
// 알약 [곧은 반길이, 가운데 x 이동, 가운데 y, 반지름, 이음매 x, 이음매 부풂, 이음매 불투명]은 영상에서 프레임마다 맞춘 값.
const FIGMA_SPIN: readonly (readonly number[])[] = [
  [3.32, 0.35, 12.21, 3.5, 11.82, 0.59, 1],
  [2.61, 0.52, 12.21, 3.51, 10.97, 2.36, 1],
  [2.12, 0.43, 12.23, 3.5, 11.65, 2.25, 1],
  [1.24, 0.59, 12.21, 3.48, 12.08, 3.1, 1],
  [0.38, 0.74, 12.2, 3.5, 12.34, 3.58, 0.7],
  [0.02, 0.94, 12.2, 3.51, 13.69, 2.93, 0.7],
  [0.35, 0.85, 12.21, 3.5, 12.5, -2.09, 0.88],
  [1.24, 0.7, 12.2, 3.5, 13.94, -1.5, 0.91],
  [2.35, 0.49, 12.21, 3.48, 14.62, 0.73, 1],
  [3.4, 0.29, 12.21, 3.46, 15.88, 2.1, 0.94],
  [3.96, 0.12, 12.21, 3.47, 16.92, 2.89, 0.45],
  [3.87, 0.21, 12.2, 3.46, 16.98, 2.9, 0.39],
  [2.14, 0.51, 12.22, 3.47, 8.27, -0.58, 0.27],
  [0.41, 0.75, 12.21, 3.47, 11.23, -0.61, 0.1],
  [0.26, 0.89, 12.2, 3.49, 11.27, -1.4, 0.56],
  [0.92, 0.8, 12.2, 3.49, 12.48, -1.89, 0.96],
  [1.81, 0.64, 12.21, 3.49, 12.73, -0.64, 0.89],
  [2.54, 0.6, 12.2, 3.5, 13.25, -0.04, 0.94],
  [2.48, 0.58, 12.2, 3.5, 12.8, 0.65, 0.93],
  [1.29, 0.69, 12.2, 3.53, 13.37, 1.44, 0.93],
  [0.35, 0.8, 12.18, 3.47, 12.93, 3.1, 0.83],
  [0.21, 1.02, 12.2, 3.48, 12.5, 2.81, 0.15],
  [0.82, 0.9, 12.23, 3.5, 12.6, -1.24, 0.93],
  [1.77, 0.63, 12.23, 3.5, 14.57, -0.61, 0.86],
  [2.86, 0.41, 12.23, 3.48, 15.98, 0.73, 0.99],
  [3.7, 0.17, 12.23, 3.48, 16.4, 1.29, 0.2],
  [4.1, 0.21, 12.23, 3.48, 16.62, 1.84, 0.15],
  [3.16, 0.42, 12.22, 3.48, 14.79, 2.75, 0.12],
  [1.27, 0.68, 12.21, 3.48, 15.93, 0.81, 0.27],
  [0.23, 0.91, 12.23, 3.49, 10.69, -0.15, 0.19],
  [0.51, 0.85, 12.23, 3.47, 12.03, -2.11, 0.84],
  [1.38, 0.78, 12.21, 3.49, 12.71, -1.43, 0.93],
  [2.29, 0.62, 12.22, 3.48, 12.72, -0.03, 0.92],
  [2.64, 0.57, 12.22, 3.47, 11.58, 1.8, 0.89],
  [2.07, 0.65, 12.22, 3.46, 12.21, 1.95, 0.91],
  [0.77, 0.74, 12.22, 3.49, 12.79, 2.82, 0.93],
  [0.01, 0.78, 12.2, 3.5, 13.35, 3.13, 0.75],
  [0.08, 1.03, 12.23, 3.49, 12.76, 2.4, 0.88],
  [0.06, 1.71, 12.2, 3.52, 11.31, 1.21, 1],
  [1.02, 1.56, 12.22, 3.48, 9.91, 1.39, 1],
  [3.01, 0.45, 12.21, 3.49, 12.09, -0.09, 0.99],
] // f13~53
const figmaPill = ([len, dx, cy, r]: readonly number[]) => {
  const x0 = Math.round((12 + dx - len) * 100) / 100, x1 = Math.round((12 + dx + len) * 100) / 100, top = Math.round((cy - r) * 100) / 100, low = Math.round((cy + r) * 100) / 100
  return `M${x0} ${top}H${x1}A${r} ${r} 0 0 1 ${x1} ${low}H${x0}A${r} ${r} 0 0 1 ${x0} ${top}Z`
}
const figmaSeam = ([, , cy, r, x, bulge]: readonly number[]) => {
  const q = (v: number) => Math.round(v * 100) / 100
  return `M${x} ${q(cy - r)}C${q(x + 0.5523 * bulge)} ${q(cy - r)} ${q(x + bulge)} ${q(cy - 0.5523 * r)} ${q(x + bulge)} ${cy}S${q(x + 0.5523 * bulge)} ${q(cy + r)} ${x} ${q(cy + r)}`
}
// 가운뎃줄(왼쪽 D + 오른쪽 원)을 x=12 기준 가로 sx, 세로 sy로 누르고 가운데를 y=cy로 — 선 굵기가 그대로이게 좌표를 바꾼다
const figmaMiddle = ([sx, sy, cy]: readonly number[]) => {
  const q = (v: number) => Math.round(v * 100) / 100
  const rx = q(3.5 * sx), ry = q(3.5 * sy), top = q(cy - 3.5 * sy), low = q(cy + 3.5 * sy)
  return [
    `M${q(12 - 7 * sx)} ${cy}A${rx} ${ry} 0 0 1 ${q(12 - 3.5 * sx)} ${top}H12V${low}H${q(12 - 3.5 * sx)}A${rx} ${ry} 0 0 1 ${q(12 - 7 * sx)} ${cy}z`,
    `M12 ${cy}A${rx} ${ry} 0 1 1 ${q(12 + 7 * sx)} ${cy}A${rx} ${ry} 0 1 1 12 ${cy}z`,
  ]
}
const FIGMA_MIDDLE_IN = [[1, 1, 12.5], [0.97, 1, 12.53], [0.82, 1, 12.55], [0.38, 1, 13.13], [0.1, 0.84, 16.55], [0, 0.95, 17.58]] // f7~12
const FIGMA_MIDDLE_OUT = [[0.03, 1.33, 17.98], [0.2, 1.03, 18.91], [0.37, 0.99, 18.2], [0.62, 1, 13.64], [0.83, 1, 12.7], [0.95, 1, 12.52], [1, 1, 12.5]] // f54~60
// 물방울을 (12,16) 모서리 기준 s배로 — 이것도 좌표로
const figmaDrop = (k: number) => {
  const q = (v: number) => Math.round(v * 1000) / 1000
  return `M${q(12 - 7 * k)} ${q(16 + 3.5 * k)}A${q(3.5 * k)} ${q(3.5 * k)} 0 0 1 ${q(12 - 3.5 * k)} 16H12V${q(16 + 3.5 * k)}A${q(3.5 * k)} ${q(3.5 * k)} 0 1 1 ${q(12 - 7 * k)} ${q(16 + 3.5 * k)}z`
}
const middleKeys = (i: number): Key[] => [...trace(7, FIGMA_MIDDLE_IN.map((m) => figmaMiddle(m)[i])), ...trace(54, FIGMA_MIDDLE_OUT.map((m) => figmaMiddle(m)[i]))]
const FIGMA: IconSpec = {
  nodes: [
    ['path', { d: 'M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z' }],
    ['path', { d: 'M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z' }],
    ['path', { d: figmaMiddle([1, 1, 12.5])[1] }],
    ['path', { d: figmaDrop(1) }],
    ['path', { d: figmaMiddle([1, 1, 12.5])[0] }],
  ],
  parts: [
    { node: [0, 1], play: play({ y: [...trace(9, [0, 0.62, 5.06, 6.51]), ...trace(54, [6.72, 6.54, 5.64, 1.07, 0.14, 0])], opacity: hiddenBetween(12.5, 53.5) }) },
    { node: 4, play: play({ d: middleKeys(0), opacity: hiddenBetween(12.5, 53.5) }) },
    { node: 2, play: play({ d: middleKeys(1), opacity: hiddenBetween(12.5, 53.5) }) },
    { node: 3, play: play({ d: [...trace(4, [1, 0.9, 0.55, 0.12, 0].map(figmaDrop)), ...trace(58, [0.07, 0.1, 0.14, 0.33, 0.54, 0.77, 0.95, 1].map(figmaDrop))], opacity: hiddenBetween(7.5, 57.5) }) },
    { shape: ['path', { d: figmaPill(FIGMA_SPIN[0]) }], play: play({ d: trace(13, FIGMA_SPIN.map(figmaPill)), opacity: shownBetween(12.5, 53.5) }) },
    {
      shape: ['path', { d: figmaSeam(FIGMA_SPIN[0]) }],
      play: play({ d: trace(13, FIGMA_SPIN.map(figmaSeam)), opacity: [[0, 0, 'linear'], [fr(12.5), 0, 'linear'], ...trace(13, FIGMA_SPIN.map((p) => p[6])), [fr(53.5), FIGMA_SPIN[FIGMA_SPIN.length - 1][6], 'linear'], [fr(53.6), 0, 'linear']] }),
    },
  ],
}

/** figma */
export function FigmaIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="figma" spec={FIGMA} />
}

// 종이 — 영상의 이 칸은 귀가 (14,8)인 종이(빼기·더하기 종이와 같은 판)다. 귀가 펴지며(f5~12) 0.8로 줄고(f9~11),
// (12,12) 기준 시계로 기울며 아래로 떨어져 30칸 창 밖으로 나갔다가(f13~18) 위에서 25° 기운 채 내려와(f21~27)
// 서며 제 크기·귀로 돌아온다(f24~29). 귀·배율·기울기·높이를 프레임마다 맞춘 값(영상, 래스터 모형 맞춤).
const filePage = (u: number) => {
  const e = Math.round((14 + 6 * u) * 100) / 100, b = Math.round((8 - 6 * u) * 100) / 100
  return { d: `M${e} 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V${b}z`, points: `${e} 2 ${e} ${b} 20 ${b}` }
}
const FILE_FOLD = [0, 0.05, 0.11, 0.21, 0.22, 0.29, 0.49, 0.75, 0.81, 0.85] // f4~13 (펴짐)
const FILE_UNFOLD = [0.85, 0.74, 0.39, 0.2, 0.12, 0.07, 0] // f21~27 (다시 접힘)
const FILE: IconSpec = {
  overflow: true,
  nodes: [['path', { d: filePage(0).d }], ['polyline', { points: filePage(0).points }]],
  parts: [
    {
      clip: [['rect', { x: -3, y: -3, width: 30, height: 30 }]],
      origin: [12, 12],
      play: play({
        y: [...trace(12, [0, 0.64, 2.8, 7, 13, 20, 28]), [fr(19.5), 28, 'linear'], [fr(19.6), -28, 'linear'], ...trace(21, [-21.6, -15.32, -9.68, -5.07, -2.01, -0.44, 0])],
        rotate: [...trace(12, [0, 0.26, 2.76, 7.2, 12.4, 18, 22]), [fr(19.5), 23, 'linear'], ...trace(21, [25, 25, 22.9, 20.3, 16, 10.1, 5.27, 1.97, 0])],
        scale: [...trace(8, [1, 0.98, 0.9, 0.81, 0.8]), ...trace(23, [0.8, 0.8, 0.85, 0.9, 0.95, 0.98, 1])],
      }),
      parts: [
        { node: 0, play: play({ d: [...trace(4, FILE_FOLD.map((u) => filePage(u).d)), ...trace(21, FILE_UNFOLD.map((u) => filePage(u).d))] }) },
        { node: 1, play: play({ points: [...trace(4, FILE_FOLD.map((u) => filePage(u).points)), ...trace(21, FILE_UNFOLD.map((u) => filePage(u).points))] }) },
      ],
    },
  ],
}

/** file */
export function FileIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file" spec={FILE} />
}

// 종이 셋(빼기·더하기·글) 공통 — 귀의 접힌 선이 빗변 쪽으로 접혀 들어가 없어지고(f4~9) 종이가 (12,12) 기준 0.8배로
// 줄며 귀는 작은 빗변만 남는다(f8~12). f22~26에 커지며 빗변이 길어지고 접힌 선이 다시 펴져 나온다(f25~30). 선 굵기는
// 줄지 않는다(--d3-k). 속 줄은 종이 밖에서 자리·길이를 따로 옮긴다(f8~26). 모두 영상에서 프레임마다 맞춘 값.
const SHEET_SCALE = trace(8, [1, 0.98, 0.9, 0.815, ...Array<number>(10).fill(0.8), 0.81, 0.86, 0.94, 0.985, 1]) // f8~26
const SHEET_CUT = [1, 0.92, 0.7, 0.3, 0.21, ...Array<number>(9).fill(0.2), 0.26, 0.54, 0.74, 0.96, 1] // f8~26, 귀 빗변 크기(1 = 14·8 귀)
const SHEET_TUCK = [0, 0.22, 0.47, 0.67, 0.93, 0.97, ...Array<number>(13).fill(1), 0.75, 0.89, 0.98, 0.94, 0.68, 0.48, 0.23, 0] // f4~30, 접힌 선이 빗변으로 들어간 정도
const sheetR = (v: number) => Math.round(v * 1000) / 1000
const sheetBody = (u: number) => `M${sheetR(20 - 6 * u)} 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V${sheetR(2 + 6 * u)}z`
const sheetFold = (u: number, v: number) => {
  const c = 20 - 6 * u, e = 2 + 6 * u
  return `${sheetR(c)} 2 ${sheetR(c + (v * (20 - c)) / 2)} ${sheetR(e - (v * (e - 2)) / 2)} 20 ${sheetR(e)}`
}
// 속 줄 하나 — f8~26 프레임마다 [x1, y1, x2, y2]
const sheetLine = (rows: readonly (readonly number[])[]): IconPart => ({
  shape: ['line', { x1: rows[0][0], y1: rows[0][1], x2: rows[0][2], y2: rows[0][3] }],
  play: play({ x1: trace(8, rows.map((r) => r[0])), y1: trace(8, rows.map((r) => r[1])), x2: trace(8, rows.map((r) => r[2])), y2: trace(8, rows.map((r) => r[3])) }),
})
const sheet = (lines: readonly (readonly (readonly number[])[])[]): IconSpec => ({
  nodes: [['path', { d: sheetBody(1) }], ['polyline', { points: sheetFold(1, 0) }]],
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: SHEET_SCALE, '--d3-k': SHEET_SCALE.map(([t, v, e]) => [t, 1 / Number(v), e] as Key) }),
      parts: [
        { node: 0, play: play({ d: trace(8, SHEET_CUT.map(sheetBody)) }) },
        { node: 1, play: play({ points: trace(4, SHEET_TUCK.map((v, i) => sheetFold(SHEET_CUT[i - 4] ?? 1, v))) }) },
      ],
    },
    ...lines.map(sheetLine),
  ],
})

// 빼기 종이 — 빼기가 종이 가운데로 올라가며 4.4 길이로 줄었다(f8~12) 돌아온다(f22~26).
const FILE_MINUS: IconSpec = sheet([[[9, 15, 15, 15], [9.1, 14.67, 15.03, 14.67], [9.5, 13.55, 14.58, 13.55], [9.42, 12.66, 14.48, 12.66], [9.67, 12.54, 14.29, 12.54], ...hold(9, [9.72, 12.45, 14.28, 12.45]), [9.68, 12.46, 14.28, 12.46], [9.73, 13.22, 14.47, 13.22], [9.15, 14.12, 14.91, 14.12], [9.01, 14.82, 14.99, 14.82], [9, 15, 15, 15]]])

/** file-minus */
export function FileMinusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file-minus" spec={FILE_MINUS} />
}

// 더하기 종이 — 영상의 더하기는 팔이 2.5(Feather는 3)라 그 크기로. 종이 가운데로 올라가며 팔이 1.9로 줄었다 돌아온다.
const FILE_PLUS: IconSpec = sheet([
  [[12, 12.5, 12, 17.5], [12, 12.03, 12, 17.32], [12, 11.35, 12, 15.42], [12, 10.88, 12, 14.51], [12, 10.73, 12, 14.35], ...hold(9, [12, 10.71, 12, 14.32]), [12, 10.75, 12, 14.46], [12, 10.94, 12, 15.2], [12, 11.85, 12, 16.3], [12, 12.39, 12, 17.1], [12, 12.5, 12, 17.5]],
  [[9.5, 15, 14.5, 15], [9.53, 14.66, 14.3, 14.66], [9.79, 13.71, 14.11, 13.71], [10, 12.65, 13.92, 12.65], [9.97, 12.47, 13.82, 12.47], ...hold(9, [10, 12.47, 13.84, 12.47]), [10.02, 12.63, 13.75, 12.63], [9.7, 13.2, 14.15, 13.2], [9.78, 14.09, 14.29, 14.09], [9.61, 14.76, 14.32, 14.76], [9.5, 15, 14.5, 15]],
])

/** file-plus */
export function FilePlusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file-plus" spec={FILE_PLUS} />
}

// 글 종이 — 글줄 셋이 다시 흘러 짧은 윗줄은 길게, 긴 아랫줄은 짧게 바뀌며(f8~12) 종이 안에 모이고 f22~26에 돌아온다.
const FILE_TEXT: IconSpec = sheet([
  [[8, 13, 16, 13], [8.24, 13.01, 15.95, 13.01], [8.59, 12.97, 15.37, 12.97], [8.99, 12.83, 15.23, 12.83], [8.99, 12.82, 15.01, 12.82], ...hold(9, [8.98, 12.83, 14.97, 12.83]), [8.98, 12.83, 14.95, 12.83], [8.62, 12.88, 15.29, 12.88], [8.31, 13.01, 15.77, 13.01], [8.19, 12.99, 15.96, 12.99], [8, 13, 16, 13]],
  [[8, 17, 16, 17], [8.15, 16.85, 15.44, 16.85], [8.52, 16.49, 12.69, 16.49], [8.99, 16.16, 10.48, 16.16], [8.95, 16.03, 10.23, 16.03], ...hold(9, [8.96, 16.02, 10.21, 16.02]), [9.01, 16.13, 10.46, 16.13], [8.67, 16.31, 11.79, 16.31], [8.26, 16.68, 13.99, 16.68], [8.02, 16.97, 15.66, 16.97], [8, 17, 16, 17]],
  [[8, 9, 10, 9], [8.28, 9, 10.38, 9], [8.52, 9.25, 12.61, 9.25], [8.82, 9.51, 15.06, 9.51], [9, 9.6, 15.06, 9.6], ...hold(9, [8.99, 9.6, 15.05, 9.6]), [9.01, 9.6, 15.05, 9.6], [8.81, 9.41, 13.91, 9.41], [8.17, 9.21, 11.87, 9.21], [8.18, 9.03, 10.44, 9.03], [8, 9, 10, 9]],
])

/** file-text */
export function FileTextIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file-text" spec={FILE_TEXT} />
}

// 필름 — 0.82로 작아지고(f9~13) 가운데 칸에 산 모양 그림이 그려졌다(f21~27) 지워지고(f51~55) 제 크기로(f53~58). 근사.
const FILM: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [[0, 1], [fr(9), 1, 'linear'], [fr(13), 0.82], [fr(53), 0.82, 'linear'], [fr(58), 1]] }),
      parts: [
        { node: [0, 1, 2, 3, 4, 5, 6, 7] },
        { shape: ['polyline', { points: '7.5 16 10.5 11 12.5 14 14 12 16.5 16' }], play: play({ pathLength: [[0, 0], [fr(21), 0, 'linear'], [fr(27), 1], [fr(51), 1, 'linear'], [fr(55), 0]], opacity: shownBetween(21, 55) }) },
      ],
    },
  ],
}

/** film */
export function FilmIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="film" spec={FILM} />
}

// 거름망 — 깔때기가 그린 순서의 끝에서부터 지워지고(f9~16: 오른쪽 빗변 → 기둥 → 왼쪽 빗변 → 윗변 순) 그사이
// 가로줄 셋이 그어지며 자리를 잡는다(가운데 줄은 오른쪽 빗변 자리에서 왼쪽으로, 아래 줄은 왼쪽에서 오른쪽으로 f11~19,
// 윗줄은 지워지는 윗변을 따라 왼쪽에서 오른쪽으로 f13~25). f37~45에 줄이 깔때기 자리로 돌아가 붙으며 깔때기가
// 처음부터 다시 그려진다(f42~47). 줄 [x1, x2, y]와 깔때기 그린 양은 영상에서 프레임마다 맞춘 값.
const FILTER_TOP: readonly (readonly number[])[] = [[3.7, 8.4, 3.27], [3.98, 9.91, 3.45], [4.15, 10.57, 3.77], [4.51, 11.63, 3.98], [4.69, 12.93, 4.16], [4.85, 14.61, 4.35], [4.85, 16.49, 4.36], [4.99, 17.81, 4.46], [4.99, 18.54, 4.46], [4.98, 19.05, 4.46], [4.98, 19.1, 4.46], [4.98, 19.18, 4.46], ...hold(13, [5, 19.27, 4.45]), [4.84, 19.33, 4.27], [4.65, 19.4, 4.13], [4.27, 20.85, 3.89], [4.09, 21.04, 3.61], [3.79, 21.35, 3.32], [3.49, 20.99, 3.32], [3.42, 21.45, 2.86], [2.73, 21.92, 2.61]] // f13~45
const FILTER_MID: readonly (readonly number[])[] = [[14.22, 15.62, 10.45], [13.44, 15.46, 10.45], [12.13, 15.41, 10.47], [11.06, 15.05, 10.63], [10.1, 15.08, 10.64], [9.55, 14.95, 10.65], [9.55, 14.84, 10.65], [9.5, 14.79, 10.66], [9.46, 14.74, 10.66], ...hold(18, [9.45, 14.75, 10.66]), [9.43, 14.82, 10.65], [9.32, 14.94, 10.63], [9.53, 14.91, 10.63], [9.68, 15.09, 10.6], [10.62, 15.11, 10.55], [12.04, 15.48, 10.5], [13.56, 15.7, 10.45], [14.58, 15.76, 10.5]] // f11~45
const FILTER_LOW: readonly (readonly number[])[] = [[10.53, 11.42, 18.52], [10.55, 12.1, 18.35], [10.52, 12.79, 18.15], [10.71, 13.31, 17.92], [10.78, 13.37, 17.73], [10.74, 13.53, 17.58], [10.76, 13.54, 17.5], ...hold(19, [10.77, 13.56, 17.43]), [10.72, 13.58, 17.53], [10.64, 13.63, 17.65], [10.7, 13.56, 17.77], [10.65, 13.17, 18.06], [10.69, 12.95, 18.32], [10.45, 12.23, 18.53]] // f12~43
const filterLine = (rows: readonly (readonly number[])[], start: number, shown: [number, number]) => ({
  shape: ['line', { x1: rows[0][0], y1: rows[0][2], x2: rows[0][1], y2: rows[0][2] }] as const,
  play: play({
    x1: trace(start, rows.map((r) => r[0])),
    x2: trace(start, rows.map((r) => r[1])),
    y1: trace(start, rows.map((r) => r[2])),
    y2: trace(start, rows.map((r) => r[2])),
    opacity: shownBetween(...shown),
  }),
})
const FILTER: IconSpec = {
  nodes: [['path', { d: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' }]],
  parts: [
    {
      node: 0,
      play: play({
        pathLength: [...trace(8, [1, 1, 0.9, 0.74, 0.5, 0.284, 0.1, 0.03, 0]), ...trace(42, [0, 0.5, 0.74, 0.9, 0.98, 1])],
        opacity: hiddenBetween(15.5, 42.5),
      }),
    },
    filterLine(FILTER_TOP, 13, [12.5, 45.5]),
    filterLine(FILTER_MID, 11, [10.5, 45.5]),
    filterLine(FILTER_LOW, 12, [11.5, 43.5]),
  ],
}

/** filter */
export function FilterIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="filter" spec={FILTER} />
}

// 깃발 — 깃폭이 (12,12) 기준 16°쯤 기울며(f8~13) Feather의 S자 물결이 뒤집혔다(f8~16) 되돌고(f20~27) 다시 뒤집혔다
// (f31~39) 서며(f44~52) 제자리. 깃폭 안쪽 두 꼭짓점(x 8·16)의 높이를 반대로 w만큼 옮기는 물결 — 기울기·물결을 프레임마다
// 맞춘 값(영상, 래스터 모형 맞춤).
const FLAG_TILT = [0.52, 2.52, 5.65, 10.23, 14.07, 15.23, 15.57, 15.71, 15.85, 15.85, 15.85, 15.85, 15.85, 15.85, 15.85, 15.6, 15.6, 15.6, 15.6, 15.6, 15.6, 15.6, 15.6, 15.6, 15.65, 15.7, 15.75, 15.75, 15.75, 15.8, 15.8, 15.8, 15.8, 15.75, 15.7, 15.65, 15.6, 15.6, 14.05, 11.7, 8.0, 4.34, 2.07, 0.08, 0] // f8~52
const FLAG_WAVE = [0.02, 0.12, 0.25, 0.56, 0.86, 1.17, 1.47, 1.73, 1.94, 1.94, 1.94, 1.94, 1.88, 1.75, 1.55, 1.14, 0.81, 0.5, 0.27, 0.06, 0.03, 0.03, 0.03, 0.03, 0.25, 0.48, 0.78, 1.12, 1.48, 1.66, 1.83, 1.97, 1.97, 1.97, 1.91, 1.73, 1.53, 1.34, 1.07, 0.75, 0.46, 0.23, 0.12, 0.01, 0]
const flagCloth = (w: number) => {
  const r = (v: number) => Math.round(v * 1000) / 1000
  return `M4 15S5 ${r(14 + w)} 8 ${r(14 + w)}S13 ${r(16 - w)} 16 ${r(16 - w)}S20 15 20 15L20 3S19 ${r(4 - w)} 16 ${r(4 - w)}S11 ${r(2 + w)} 8 ${r(2 + w)}S4 3 4 3Z`
}
const FLAG: IconSpec = {
  nodes: [['path', { d: flagCloth(0) }], ['line', { x1: 4, y1: 22, x2: 4, y2: 15 }]],
  parts: [
    {
      origin: [12, 12],
      play: play({ rotate: trace(7, [0, ...FLAG_TILT]) }),
      parts: [{ node: 0, play: play({ d: trace(7, [0, ...FLAG_WAVE].map(flagCloth)) }) }, { node: 1 }],
    },
  ],
}

/** flag */
export function FlagIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="flag" spec={FLAG} />
}

// 폴더 — 가운데 기준 0.85로 오그라든 뒤(f4~9) 앞판이 열린다: 앞판 윗변이 폴더 윗변(6.9)에서 5로 올라가며 오른쪽 끝이
// 22.3까지 비스듬히 젖혀지고(f9~16, 아래 끝은 폴더 오른쪽 아래에 붙은 채) 폴더는 그만큼 왼쪽으로 1.4 비켜난다.
// f29~35에 거꾸로 닫히고 f36~40에 제 크기로. 세 폴더(빈·빼기·더하기)가 같다 — 폴더 배율·이동·앞판 꼭짓점을 프레임마다
// 맞춘 값(영상, 래스터 모형 맞춤).
const FOLDER_SCALE: Key[] = [...trace(4, [1, 0.98, 0.945, 0.9, 0.87, 0.85]), ...trace(35, [0.85, 0.87, 0.9, 0.94, 0.98, 1])]
const FOLDER_SHIFT: Key[] = [...trace(8, [0, -0.19, -0.38, -0.56, -0.84, -1.08, -1.22, -1.37, -1.39, -1.4]), ...trace(28, [-1.4, -1.32, -1.19, -1.06, -0.82, -0.57, -0.37, -0.18, -0.08, -0.04, 0])]
// 앞판 [윗변 왼끝 x, 윗변 y, 오른쪽 위 x, 아래 끝 x] — 아래 끝 y는 18.8
const FOLDER_FLAP_OPEN = [[11.08, 6.89, 20.69, 20.21], [10.74, 6.75, 20.89, 20.02], [10.26, 6.42, 21.13, 19.84], [9.93, 5.81, 21.48, 19.56], [9.27, 5.62, 21.77, 19.32], [9.13, 5.31, 22.03, 19.18], [8.98, 5.06, 22.21, 19.03], [8.95, 5.01, 22.26, 19]]
const FOLDER_FLAP_CLOSE = [[8.95, 5.01, 22.26, 19], [9.03, 5.09, 22.25, 19.08], [9.16, 5.21, 22.02, 19.21], [9.29, 5.55, 21.8, 19.34], [9.6, 5.8, 21.52, 19.58], [10.32, 6.36, 21.29, 19.83], [10.78, 6.77, 20.96, 20.03], [11.04, 6.89, 20.71, 20.22]]
const flapPoints = ([x0, y, x1, x2]: readonly number[]) => `${x0} ${y} ${x1} ${y} ${x2} 18.8`
const folderOpen = (inner: number[]): IconSpec => ({
  parts: [
    { node: [0, ...inner], origin: [12, 12], play: play({ scale: FOLDER_SCALE, x: FOLDER_SHIFT }) },
    {
      shape: ['polyline', { points: flapPoints(FOLDER_FLAP_OPEN[0]) }],
      play: play({ points: [...trace(9, FOLDER_FLAP_OPEN.map(flapPoints)), ...trace(28, FOLDER_FLAP_CLOSE.map(flapPoints))], opacity: shownBetween(8.9, 35.5) }),
    },
  ],
})
const FOLDER: IconSpec = folderOpen([])

/** folder */
export function FolderIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="folder" spec={FOLDER} />
}

const FOLDER_MINUS: IconSpec = folderOpen([1])

/** folder-minus */
export function FolderMinusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="folder-minus" spec={FOLDER_MINUS} />
}

const FOLDER_PLUS: IconSpec = folderOpen([1, 2])

/** folder-plus */
export function FolderPlusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="folder-plus" spec={FOLDER_PLUS} />
}

// 프레이머 — 꼬리가 아래 막대 쪽으로 접혀 들며(f8~15, f11~12에 확) 로고 전체가 3.5 내려와 Z자 상자가 되고,
// 가로로 뒤집혀 거울 Z가 됐다(f36~44, f39~40 사이에 0을 지나감) 다시 뒤집히고(f53~61) 마지막에 꼬리를 펴며
// 올라간다(f64~70). 세로 이동·꼬리 접힘(꼬리 윗변 y 16 기준 세로 배율)·가로 배율을 프레임마다 맞춘 값(영상).
const FRAMER: IconSpec = {
  nodes: [
    ['path', { d: 'M5 16V9h14V2H5l14 14h-7' }],
    ['path', { d: 'M5 16h7' }],
    ['path', { d: 'M5 16l7 7v-7' }],
  ],
  parts: [
    {
      origin: [12, 12],
      play: play({
        y: [...trace(7, [0, 0.08, 0.16, 0.31, 0.65, 2.83, 3.22, 3.34, 3.47]), ...trace(64, [3.47, 3.43, 3.36, 3.31, 3.07, 1.77, 0])],
        scaleX: [...trace(36, [1, 0.95, 0.85, 0.64, -0.64, -0.85, -0.92, -0.97, -0.99, -1]), ...trace(53, [-1, -0.95, -0.94, -0.84, -0.64, 0.64, 0.85, 0.95, 1])],
      }),
      parts: [
        { node: [0, 1] },
        { node: 2, origin: [8.5, 16], play: play({ scaleY: [...trace(7, [1, 1, 0.98, 0.95, 0.84, 0.19, 0.07, 0.04, 0]), ...trace(64, [0, 0.01, 0.03, 0.04, 0.12, 0.5, 1])] }) },
      ],
    },
  ],
}

/** framer */
export function FramerIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="framer" spec={FRAMER} />
}

// 선물 — 상자는 (12,12) 기준 0.8배로, 뚜껑·리본은 가로 0.78·세로 0.87배로 움츠러들며(f7~11) 그사이 띠(세로줄)가 상자를
// 감고 도는 것처럼 왼쪽으로 반 폭만큼 밀려 나가고 다음 띠가 오른쪽 모서리에서 가운데로 들어온다(f7~17). 버티다
// f18~24에 제 크기로. 배율과 띠 위치(반 폭 비율)는 영상에서 프레임마다 맞춘 값.
const GIFT_BOX = trace(7, [1, 0.955, 0.895, 0.84, 0.8, 0.8, 0.795, 0.8, 0.8, 0.8, 0.8, 0.8, 0.825, 0.87, 0.93, 0.97, 0.995, 1]) // f7~24
const GIFT_TOP_X = trace(7, [0.98, 0.95, 0.88, 0.82, 0.78, 0.78, 0.77, 0.78, 0.77, 0.78, 0.78, 0.78, 0.81, 0.85, 0.92, 0.97, 0.99, 1])
const GIFT_TOP_Y = trace(7, [1, 0.98, 0.95, 0.91, 0.89, 0.88, 0.88, 0.87, 0.88, 0.87, 0.87, 0.87, 0.9, 0.93, 0.97, 0.99, 0.99, 1])
const GIFT_SLIDE = [0, 0.05, 0.13, 0.27, 0.4, 0.57, 0.74, 0.89, 0.95, 0.98, 1] // f7~17, 반 폭 단위
// 띠 한 토막 — 반 폭 half만큼 떨어진 자리(next면 오른쪽 모서리)에서 GIFT_SLIDE만큼 왼쪽으로
const giftBand = (y1: number, y2: number, half: number, next: boolean) => ({
  shape: ['line', { x1: 12, y1, x2: 12, y2 }] as const,
  play: play({
    x: trace(7, GIFT_SLIDE.map((v) => half * ((next ? 1 : 0) - v))),
    opacity: next ? [[0, 0, 'linear'], [fr(7), 0, 'linear'], [fr(7.1), 1, 'linear']] as Key[] : hiddenBetween(15.9, 69.9),
  }),
})
const GIFT: IconSpec = {
  nodes: [
    ['polyline', { points: '20 12 20 22 4 22 4 12' }],
    ['rect', { x: 2, y: 7, width: 20, height: 5 }],
    ['path', { d: 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z' }],
    ['path', { d: 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' }],
  ],
  parts: [
    { origin: [12, 12], play: play({ scale: GIFT_BOX }), parts: [{ node: 0 }, giftBand(12, 22, 8, false), giftBand(12, 22, 8, true)] },
    { origin: [12, 12], play: play({ scaleX: GIFT_TOP_X, scaleY: GIFT_TOP_Y }), parts: [{ node: [1, 2, 3] }, giftBand(7, 12, 10, false), giftBand(7, 12, 10, true)] },
  ],
}

/** gift */
export function GiftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="gift" spec={GIFT} />
}

// 깃허브 — 몸통이 (12,12)를 중심으로 0.9배까지 살짝 움츠러들고(f7~13, f34~40에 제 크기로) 그동안 꼬리가 다리 끝
// (9,19)을 축으로 위로 말려 올라간다(f8~24: 최대 -16.6°, 길이 0.8배, 끝쪽 굽이가 4.4만큼 더 휨 → f31~40 제자리).
// 영상에서 프레임마다 잰 값(몸통 배율, 꼬리 [회전°, 길이 배율, 굽이]).
const GITHUB_BODY = 'M16 22v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22'
const GITHUB_SCALE = [1, 0.99, 0.97, 0.95, 0.93, 0.91, ...Array<number>(22).fill(0.9), 0.91, 0.93, 0.95, 0.97, 0.99, 1] // f7~40
const GITHUB_TAIL: readonly (readonly [number, number, number])[] = [
  [0, 1, 0], [-0.8, 0.98, -0.1], [-1, 0.95, -0.1], [-2.05, 0.93, -0.12], [-3, 0.91, -0.15], [-5, 0.91, -0.22],
  [-6, 0.9, -0.45], [-7.7, 0.89, -0.63], [-9.55, 0.89, -1.03], [-10.4, 0.89, -1.29], [-10.4, 0.89, -1.29],
  [-10.4, 0.89, -1.29], [-10.4, 0.89, -1.29], [-10.8, 0.89, -1.43], [-11.45, 0.88, -1.59], [-14.84, 0.86, -2.53],
  [-15.5, 0.84, -3.13], [-16.6, 0.82, -4.03], [-16.6, 0.81, -4.14], [-16.06, 0.81, -4.48], [-15.7, 0.8, -4.44],
  [-15.74, 0.8, -4.44], [-15.74, 0.8, -4.44], [-15.74, 0.8, -4.44], [-15.74, 0.8, -4.5], [-14.66, 0.8, -4.26],
  [-14.6, 0.81, -4.26], [-12.97, 0.81, -3.94], [-9.82, 0.88, -2.84], [-7, 0.9, -1.87], [-4.68, 0.91, -1.33],
  [-1.9, 0.95, -0.38], [-0.53, 0.97, -0.16], [0, 1, 0],
] // f7~40
// 꼬리 'M9 19C4 20.5 4 16.5 2 16'을 (9,19) 기준으로 돌리고 늘인 모양. 몸통 묶음이 함께 줄어드니 길이는 그만큼 나눠 준다.
const githubTail = ([deg, len, bend]: readonly [number, number, number], bodyScale: number) => {
  const a = (deg * Math.PI) / 180, k = len / bodyScale
  const r = (v: number) => Math.round(v * 1000) / 1000
  const at = (x: number, y: number) => {
    const dx = (x - 9) * k, dy = (y - 19) * k
    return `${r(9 + dx * Math.cos(a) - dy * Math.sin(a))} ${r(19 + dx * Math.sin(a) + dy * Math.cos(a))}`
  }
  return `M9 19C${at(4, 20.5)} ${at(4, 16.5 + bend)} ${at(2, 16)}`
}
const GITHUB: IconSpec = {
  nodes: [['path', { d: githubTail([0, 1, 0], 1) }], ['path', { d: GITHUB_BODY }]],
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: trace(7, GITHUB_SCALE) }),
      parts: [{ node: 0, play: play({ d: trace(7, GITHUB_TAIL.map((t, i) => githubTail(t, GITHUB_SCALE[i]))) }) }, { node: 1 }],
    },
  ],
}

/** github */
export function GithubIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="github" spec={GITHUB} />
}

// 지구본 — (12,12)를 중심으로 0.8배로 작아지고(f1~9) 공이 경선 다섯 칸(60° 간격, 300°)만큼 왼쪽으로 돈 뒤(f10~52)
// 제 크기로 돌아온다(f53~61). 영상의 쉬는 모양은 Feather의 렌즈 대신 ±30° 경선 두 개(가로 반지름 5인 반타원)라 그
// 모양으로 그린다. 경선 하나는 경도 φ일 때 가로로 10·sin φ만큼 부푼 반타원(3차 곡선 둘)이고, 앞쪽 반구(-90°~90°)에
// 있을 때만 보인다 — 테두리(±90°)에서 켜고 끄니 이음매가 없다. 배율·회전각은 영상에서 프레임마다 맞춘 값.
const GLOBE_SCALE: Key[] = [[fr(1), 1], ...trace(2, [0.98, 0.95, 0.93, 0.89, 0.86, 0.83, 0.81, 0.795]), [fr(53), 0.795, 'linear'], ...trace(54, [0.81, 0.83, 0.86, 0.9, 0.93, 0.96, 0.98, 1])]
const GLOBE_TURN = [0, -6, -14.5, -24.1, -32.4, -41.7, -49.7, -60, -73.3, -81.1, -88.6, -95, -101.5, -107.4, -112.7, -116.7, -121.5, -123.5, -130.7, -138.8, -146.6, -153.7, -161.9, -170.2, -177.1, -183.6, -190.7, -198.1, -206.6, -213.9, -221.9, -229.6, -236.8, -241.8, -244.4, -252.1, -258.2, -264.1, -271.1, -278.5, -286.1, -293.8, -300] // f10~52
const meridianD = (deg: number) => {
  const b = 10 * Math.sin((Math.max(-90, Math.min(90, deg)) * Math.PI) / 180), k = 0.5523
  const r = (v: number) => Math.round(v * 1000) / 1000
  return `M12 2C${r(12 + k * b)} 2 ${r(12 + b)} ${r(12 - 10 * k)} ${r(12 + b)} 12S${r(12 + k * b)} 22 12 22`
}
// 쉴 때 경도 rest(°)인 경선 — 앞쪽 반구를 드나드는 순간(프레임 사이는 선형으로 셈)에 켜고 끈다
const meridian = (rest: number) => {
  const deg = GLOBE_TURN.map((t) => rest + t)
  const seen = (d: number) => d > -90 && d < 90
  const opacity: Key[] = [[0, seen(rest) ? 1 : 0, 'linear']]
  deg.forEach((d, i) => {
    if (i === 0 || seen(d) === seen(deg[i - 1])) return
    const edge = d < deg[i - 1] ? (seen(d) ? 90 : -90) : seen(d) ? -90 : 90
    const at = 10 + i - 1 + (edge - deg[i - 1]) / (d - deg[i - 1])
    opacity.push([fr(at - 0.05), seen(d) ? 0 : 1, 'linear'], [fr(at + 0.05), seen(d) ? 1 : 0, 'linear'])
  })
  return { shape: ['path', { d: meridianD(rest) }] as const, play: play({ d: trace(10, deg.map(meridianD)), opacity }) }
}
const GLOBE: IconSpec = {
  nodes: [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 2, y1: 12, x2: 22, y2: 12 }]],
  parts: [{ origin: [12, 12], play: play({ scale: GLOBE_SCALE }), parts: [{ node: [0, 1] }, ...[-30, 30, 90, 150, 210, 270, 330].map(meridian)] }],
}

/** globe */
export function GlobeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="globe" spec={GLOBE} />
}
