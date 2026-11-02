import { AnimatedIcon } from './animated-icon'
import { fr, play, trace, type Key } from './icon-motion'
import type { AnimatedIconProps, IconSpec } from './icon-types'

// 영상 8~9줄. 시각은 그 줄 묶음의 주기 시작부터 잰 초(프레임 ÷ 30).

// a~b 프레임 동안만 보이기 / 그동안만 숨기기 — 바꿔 끼우는 도형용
const shownBetween = (a: number, b: number): Key[] => [[0, 0, 'linear'], [fr(a), 0, 'linear'], [fr(a + 0.1), 1, 'linear'], [fr(b), 1, 'linear'], [fr(b + 0.1), 0, 'linear']]
const hiddenBetween = (a: number, b: number): Key[] => [[0, 1, 'linear'], [fr(a), 1, 'linear'], [fr(a + 0.1), 0, 'linear'], [fr(b), 0, 'linear'], [fr(b + 0.1), 1, 'linear']]
// 종이 아이콘 공통 — 접힌 귀가 펴지며 각진 네모(가로 0.8·세로 0.66)로 오그라들었다(f8~13) 다시 펴진다(f22~27)
const PAGE_SHRINK = { x: [[0, 1], [fr(8), 1, 'linear'], [fr(13), 0.8], [fr(22), 0.8, 'linear'], [fr(27), 1]] as Key[], y: [[0, 1], [fr(8), 1, 'linear'], [fr(13), 0.66], [fr(22), 0.66, 'linear'], [fr(27), 1]] as Key[] }
const pageBody = (corner: number, end: number): Key[] => {
  const open = `M${corner} 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V${end}z`, shut = 'M20 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2z'
  return [[0, open], [fr(8), open, 'linear'], [fr(11.5), shut], [fr(23.5), shut, 'linear'], [fr(27), open]]
}
const pageFold = (corner: number, end: number): Key[] => {
  const open = `${corner} 2 ${corner} ${end} 20 ${end}`
  return [[0, open], [fr(8), open, 'linear'], [fr(11.5), '20 2 20 2 20 2'], [fr(23.5), '20 2 20 2 20 2', 'linear'], [fr(27), open]]
}
const pageWith = (extra: number[]): IconSpec => ({
  parts: [{ origin: [12, 12], play: play({ scaleX: PAGE_SHRINK.x, scaleY: PAGE_SHRINK.y }), parts: [{ node: 0, play: play({ d: pageBody(14, 8) }) }, { node: 1, play: play({ points: pageFold(14, 8) }) }, { node: extra }] }],
})

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

// 피그마 — 블록들이 위로 접혀 사라지며(f6~12) 알약(원 두 개 붙은 모양)이 되어 원 ↔ 알약으로 통통 튀다가(f13~52)
// 다시 피그마 블록으로 펼쳐진다(f53~58). 알약 폭을 프레임 장면마다 맞춘 근사.
const FIGMA_PILL: Key[] = [[0, 10], [fr(13), 10, 'linear'], [fr(17), 5.6], [fr(23), 10], [fr(29), 10], [fr(34), 5.6], [fr(38), 10], [fr(43), 5.6], [fr(46), 10], [fr(49), 5.6], [fr(52), 10]]
const FIGMA: IconSpec = {
  parts: [
    { node: [0, 1, 2, 3, 4], origin: [12, 5.5], play: play({ scaleY: [[0, 1], [fr(6), 1, 'linear'], [fr(12), 0.2], [fr(53), 0.2, 'linear'], [fr(58), 1]], opacity: hiddenBetween(12, 53) }) },
    {
      shape: ['rect', { x: 7, y: 9.2, width: 10, height: 5.6, rx: 2.8 }],
      play: play({ width: FIGMA_PILL, attrX: FIGMA_PILL.map(([t, w, e]) => [t, 12 - Number(w) / 2, e] as Key), opacity: shownBetween(12, 53) }),
    },
    { shape: ['line', { x1: 12, y1: 9.4, x2: 12, y2: 14.6 }], play: play({ opacity: [[0, 0], [fr(12.5), 0, 'linear'], [fr(13), 1], [fr(15), 0], [fr(27), 0, 'linear'], [fr(28), 1], [fr(31), 0], [fr(45), 0, 'linear'], [fr(46), 1], [fr(48), 0]] }) },
  ],
}

/** figma */
export function FigmaIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="figma" spec={FIGMA} />
}

// 종이 — 귀가 펴지며 작아지고(f8~13) 기울며 아래로 떨어져 창 밖으로 나갔다가(f13~19), 위에서 굴러 들어와(f19~27)
// 제자리에서 귀가 다시 접힌다(f24~28). 덩어리 위치·기울기 추적 근사.
const FILE: IconSpec = {
  overflow: true,
  parts: [
    {
      clip: [['rect', { x: -3, y: -3, width: 30, height: 30 }]],
      play: play({
        y: [[0, 0], [fr(12), 0, 'linear'], ...trace(13, [0.9, 2.85, 5.95, 9.5, 14, 19, 25]), [fr(19.1), -25, 'linear'], ...trace(20, [-18, -13.5, -9.5, -6.3, -4, -2.1, -0.7, -0.1, 0])],
        rotate: [[0, 0], [fr(13), 0, 'linear'], ...trace(14, [4, 30, 90, 95, 100, 100]), [fr(19.1), 95, 'linear'], ...trace(20, [95, 90, 85, 75, 12, 5, 2, -3, -2, 0])],
      }),
      origin: [12, 12],
      parts: [{ origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(8), 1, 'linear'], [fr(11), 0.8], [fr(25), 0.8, 'linear'], [fr(28), 1]], scaleY: [[0, 1], [fr(8), 1, 'linear'], [fr(11), 0.87], [fr(25), 0.87, 'linear'], [fr(28), 1]] }), parts: [{ node: 0, play: play({ d: [[0, 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'], [fr(8), 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'linear'], [fr(11), 'M20 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2z'], [fr(25), 'M20 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2z', 'linear'], [fr(28), 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z']] }) }, { node: 1, play: play({ points: [[0, '13 2 13 9 20 9'], [fr(8), '13 2 13 9 20 9', 'linear'], [fr(11), '20 2 20 2 20 2'], [fr(25), '20 2 20 2 20 2', 'linear'], [fr(28), '13 2 13 9 20 9']] }) }] }],
    },
  ],
}

/** file */
export function FileIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file" spec={FILE} />
}

// 빼기 종이 — 귀가 펴지며 네모로 오그라들었다(f8~13) 다시 펴진다(f22~27). 안쪽 빼기도 함께.
const FILE_MINUS: IconSpec = pageWith([2])

/** file-minus */
export function FileMinusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file-minus" spec={FILE_MINUS} />
}

// 더하기 종이 — 빼기 종이와 같은 접힘.
const FILE_PLUS: IconSpec = pageWith([2, 3])

/** file-plus */
export function FilePlusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="file-plus" spec={FILE_PLUS} />
}

// 글 종이 — 빼기 종이와 같은 접힘(안의 글줄도 함께).
const FILE_TEXT: IconSpec = pageWith([2, 3, 4])

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

// 거름망 — 깔때기가 접혀 들며 사라지고(f10~13) 길이가 줄어드는 가로줄 셋(목록 거름)이 그어졌다가(f12~15)
// 머물고, f42~46에 줄이 걷히며 깔때기가 다시 펴진다.
const FILTER: IconSpec = {
  parts: [
    { node: 0, origin: [12, 3], play: play({ scaleY: [[0, 1], [fr(10), 1, 'linear'], [fr(13), 0.05], [fr(43), 0.05, 'linear'], [fr(46.5), 1]], opacity: hiddenBetween(13, 43) }) },
    ...[[4, 20, 7], [7.5, 16.5, 12], [10.5, 13.5, 17]].map(([x1, x2, y], i) => ({
      shape: ['line', { x1, y1: y, x2, y2: y }] as const,
      origin: [12, y] as const,
      play: play({ scaleX: [[0, 0], [fr(11.5 + i), 0, 'linear'], [fr(14.5 + i), 1], [fr(42), 1, 'linear'], [fr(45), 0]], opacity: shownBetween(11.5 + i, 45) }),
    })),
  ],
}

/** filter */
export function FilterIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="filter" spec={FILTER} />
}

// 깃발 — 깃대 아래(4,22)를 축으로 오른쪽으로 13° 기울며 깃폭이 출렁이다(f8~45) 선다(f51). 근사.
const FLAG_WAVE = ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 15s1-2 4-2 5 3 8 3 4-2 4-2V3s-1 2-4 2-5-3-8-3-4 2-4 2z', 'M4 15s1 0 4 0 5 1 8 1 4 0 4 0V3s-1 0-4 0-5-1-8-1-4 0-4 0z']
const FLAG: IconSpec = {
  parts: [
    {
      origin: [4, 22],
      play: play({ rotate: [[0, 0], [fr(8), 0, 'linear'], [fr(14), 13], [fr(40), 13, 'linear'], [fr(48), -2], [fr(51), 0]] }),
      parts: [
        { node: 0, play: play({ d: [[0, FLAG_WAVE[0]], [fr(10), FLAG_WAVE[0], 'linear'], [fr(16), FLAG_WAVE[1]], [fr(22), FLAG_WAVE[2]], [fr(28), FLAG_WAVE[1]], [fr(34), FLAG_WAVE[2]], [fr(40), FLAG_WAVE[1]], [fr(46), FLAG_WAVE[0]]] }) },
        { node: 1 },
      ],
    },
  ],
}

/** flag */
export function FlagIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="flag" spec={FLAG} />
}

// 폴더 — 0.88로 작아지며(f8~12) 앞판이 비스듬히 열려 겹쳐 보였다가(f11~32) 닫히고 제 크기로(f33~38). 근사.
const folderOpen = (inner: number[]): IconSpec => ({
  parts: [
    {
      origin: [12, 21],
      play: play({ scale: [[0, 1], [fr(8), 1, 'linear'], [fr(12), 0.88], [fr(33), 0.88, 'linear'], [fr(38), 1]] }),
      parts: [
        { node: [0, ...inner] },
        { shape: ['path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' }], origin: [2, 21], play: play({ skewX: [[0, 0], [fr(11), 0, 'linear'], [fr(15), -14], [fr(30), -14, 'linear'], [fr(33), 0]], x: [[0, 0], [fr(11), 0, 'linear'], [fr(15), 1.6], [fr(30), 1.6, 'linear'], [fr(33), 0]], opacity: shownBetween(11, 33) }) },
      ],
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

// 프레이머 — 로고가 세로축으로 뒤집히며(f8~14) 작은(0.72) Z 모양(위·아래 가로획과 대각선, 양옆 반쪽 변)이 되고,
// 거울처럼 한 번 뒤집혔다 돌아온 뒤(f28~52) 다시 뒤집혀 로고로 돌아온다(f56~62). 근사.
const FRAMER: IconSpec = {
  parts: [
    { node: 0, origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(8), 1, 'linear'], [fr(11), 0.05], [fr(59), 0.05, 'linear'], [fr(62), 1]], opacity: hiddenBetween(11, 59) }) },
    { shape: ['path', { d: 'M5 4h14L5 20h14M5 4v6M19 14v6' }], origin: [12, 12], play: play({ scaleX: [[0, 0.05], [fr(11), 0.05, 'linear'], [fr(14), 0.72], [fr(28), 0.72, 'linear'], [fr(32), -0.72], [fr(48), -0.72, 'linear'], [fr(52), 0.72], [fr(56), 0.72, 'linear'], [fr(59), 0.05]], scaleY: [[0, 0.72], [fr(14), 0.72, 'linear']], opacity: shownBetween(11, 59) }) },
  ],
}

/** framer */
export function FramerIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="framer" spec={FRAMER} />
}

// 선물 — 0.75로 움츠렸다(f7~11) 1.05로 튀어 커졌다(f17~20) 제 크기(f24). 근사.
const GIFT: IconSpec = {
  parts: [{ node: [0, 1, 2, 3, 4], origin: [12, 22], play: play({ scale: [[0, 1], [fr(7), 1, 'linear'], [fr(11), 0.75], [fr(14), 0.75, 'linear'], [fr(19), 1.05], [fr(24), 1]] }) }],
}

/** gift */
export function GiftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="gift" spec={GIFT} />
}

// 깃허브 — 고양이가 왼쪽으로 기우뚱했다(f8~14) 돌아오고(f22), 한 번 더 살짝 흔든다(f34~40). 근사.
const GITHUB: IconSpec = {
  parts: [{ node: 0, origin: [12, 22], play: play({ rotate: [[0, 0], [fr(8), 0, 'linear'], [fr(12), -8], [fr(17), 4], [fr(22), 0], [fr(34), 0, 'linear'], [fr(37), -3], [fr(40), 0]] }) }],
}

/** github */
export function GithubIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="github" spec={GITHUB} />
}

// 지구본 — 0.82로 작아져(f2~6) 자오선 두 개가 엇갈려 좁아졌다 넓어지기를 되풀이하며(가로 배율 1 ↔ -1) 공이 도는
// 것처럼 보이다가(f6~58) 제 크기로 돌아온다(f58~62). 근사.
const GLOBE: IconSpec = {
  parts: [
    {
      origin: [12, 12],
      play: play({ scale: [[0, 1], [fr(2), 1, 'linear'], [fr(6), 0.82], [fr(58), 0.82, 'linear'], [fr(62), 1]] }),
      parts: [
        { node: [0, 1] },
        { node: 2, origin: [12, 12], play: play({ scaleX: [[0, 1], [fr(4), 1, 'linear'], [fr(16), -1], [fr(28), 1], [fr(40), -1], [fr(52), 1]] }) },
        { shape: ['path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }], origin: [12, 12], play: play({ scaleX: [[0, 0], [fr(4), 0, 'linear'], [fr(10), 1], [fr(22), -1], [fr(34), 1], [fr(46), -1], [fr(52), 0]], opacity: shownBetween(4, 52) }) },
      ],
    },
  ],
}

/** globe */
export function GlobeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon {...props} icon="globe" spec={GLOBE} />
}
