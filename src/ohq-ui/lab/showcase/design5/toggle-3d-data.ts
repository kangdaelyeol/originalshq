import type { CSSProperties } from 'react'

// Design 5(sample/design5.mp4) — 3D 다크/라이트 토글의 측정값.
// 길이는 전부 em — 1em = 영상 10px(장면 720×540 = 72×54em, 슬롯 가운데 평면 깊이 기준).
// 같은 값을 _design5.scss도 쓴다(CSS가 그리고 여기서는 면 자리·색만 만든다). 한쪽을 바꾸면 다른 쪽도 맞출 것.

/** 슬롯(바닥판에 판 홈) — 두 반원 중심 사이 반 길이·반지름(테두리 141점 맞춤)·깊이(먼 벽 아래 골 24점 맞춤, F120) */
export const D5_SLOT = {
  half: 16.661,
  radius: 8.656,
  depth: 4.43,
} as const

/** 손잡이(원기둥) — 슬롯 바닥에 서서 판 위로 솟는다(F120·F45 윗면 둘레 37점 + 세로 단면) */
export const D5_KNOB = {
  radius: 7.25,
  /** 판 위로 솟은 높이 */
  height: 3.95,
} as const

/** 진열판에 적어 둘 측정값 — 카메라·시간(30fps 프레임을 하나씩 재서 맞춘 곡선) */
export const D5_MEASURED: readonly { label: string; value: string }[] = [
  { label: '카메라', value: 'perspective 97.94em · rotateX(33.15°) rotateZ(-29.5°) — 슬롯 테두리 141점, 오차 0.72px' },
  { label: '손잡이 → 어두움', value: '1.054s cubic-bezier(0.156, 0.658, 0.46, 1.031) — F1→F29' },
  { label: '손잡이 → 밝음', value: '1.077s cubic-bezier(0.062, 0.6, 0.525, 1) — F60→F93' },
  { label: '장면 빛', value: '0.94~0.98s, 선형광 ease-in-out — 바탕 8점 진행도가 프레임마다 영상과 같음' },
  { label: '글자 불', value: '0.47s(→어두움)·0.5s(→밝음)에 한 번에 — F16·F76' },
  { label: '비치는 빛', value: '주황은 1.5배까지 번쩍였다 0.5s에 제 세기, 파랑은 0.55s에 걸쳐 차오름' },
]

// ── 면 만들기 ─────────────────────────────────────────────────────────────────

/** 3D 면 하나 — 위치(transform)와 색 변수 */
export interface D5Face {
  key: string
  style: CSSProperties
}

const deg = (rad: number) => (rad * 180) / Math.PI
const em = (n: number) => `${+n.toFixed(4)}em`

/**
 * 슬롯 양 끝 반원 벽 — 반원 하나를 count 조각으로 나눈 세로 면(안쪽을 본다).
 * 뒷면은 backface-visibility로 숨겨서 카메라 쪽(먼 쪽 절반)만 보인다.
 * --su: 조각 가운데의 u(em) — 글자 빛이 어느 조각을 비출지 계산한다.
 */
export function slotEndWalls(count = 24): D5Face[] {
  const { half, radius, depth } = D5_SLOT
  const step = Math.PI / count
  const chord = 2 * radius * Math.sin(step / 2) + 0.06 // 이음매 틈이 비치지 않게 살짝 겹친다
  const faces: D5Face[] = []
  for (const side of [1, -1] as const) {
    for (let i = 0; i < count; i++) {
      // 오른쪽 반원: -90°(먼 쪽) → 90°(가까운 쪽), 왼쪽 반원: 90° → 270°
      const phi = side === 1 ? -Math.PI / 2 + step * (i + 0.5) : Math.PI / 2 + step * (i + 0.5)
      const cu = side * half
      const su = cu + radius * Math.cos(phi)
      // 바깥을 향한 벽의 법선이 카메라 반대쪽이면 그리지 않는다(가까운 쪽 절반)
      if (Math.sin(phi) > 0.55) continue
      faces.push({
        key: `${side}-${i}`,
        style: {
          width: em(depth),
          height: em(chord),
          transform: `translate3d(${em(cu)}, 0, 0) rotateZ(${deg(phi).toFixed(3)}deg) translate3d(${em(radius)}, 0, ${em(-depth)}) rotateY(-90deg) translateY(-50%)`,
          '--su': su.toFixed(3),
          // 슬롯 가운데(글자 쪽)를 마주 보는 정도 — 끝벽은 글자 빛을 정면으로 받는다
          '--sf': Math.abs(Math.cos(phi)).toFixed(3),
        } as CSSProperties,
      })
    }
  }
  return faces
}

/** 각도(도)별 색 표에서 보간 — 손잡이 옆면 색을 영상에서 각도마다 뽑았다 */
type AngleStops = readonly (readonly [number, string])[]

const hexChannels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

function mixHex(a: string, b: string, k: number) {
  const pb = hexChannels(b)
  return `#${hexChannels(a)
    .map((v, i) => toHex(v + (pb[i] - v) * k))
    .join('')}`
}

function sampleStops(stops: AngleStops, angle: number) {
  if (angle <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (angle <= stops[i][0]) {
      const [a0, c0] = stops[i - 1]
      const [a1, c1] = stops[i]
      return mixHex(c0, c1, (angle - a0) / (a1 - a0))
    }
  }
  return stops[stops.length - 1][1]
}

// 손잡이 옆면(높이 가운데) 색 — 0°=오른쪽(+u), 90°=카메라 쪽, 180°=왼쪽. F120·F45에서 뽑음.
// 글자 빛(밝음: 왼쪽 파랑, 어두움: 오른쪽 주황)은 따로 덧칠하므로 여기 색은 주변광만 둔다.
const KNOB_SIDE_LIGHT: AngleStops = [
  [-40, '#b4b2c0'],
  [0, '#b0afbf'],
  [30, '#a6a5b6'],
  [45, '#9a99aa'],
  [60, '#8f8fa3'],
  [75, '#888a9f'],
  [90, '#86899f'],
  [110, '#8489a1'],
  [135, '#8a95ad'],
  [160, '#9aa3b8'],
  [200, '#a8acbe'],
  [220, '#b0b0c0'],
]
// 어두움: 오른쪽(0°)에 뒤쪽 빛이 비친 회색 하이라이트(F45 6f6a70), 15~30°는 붉은 기, 앞은 거의 검정
const KNOB_SIDE_DARK: AngleStops = [
  [-40, '#3a373f'],
  [-15, '#5a5662'],
  [0, '#7e7a86'],
  [12, '#5a4c52'],
  [25, '#3a292f'],
  [40, '#2a1b22'],
  [55, '#1a1118'],
  [70, '#0d0a11'],
  [90, '#060309'],
  [180, '#040207'],
  [220, '#0b0910'],
]

// 글자 빛을 받는 정도(0~1) — 파랑은 왼쪽(180°, LIGHT 쪽), 주황은 오른쪽 조금 앞(15°, DARK 쪽)에서 가장 세다
const blueGlow = (phi: number) => Math.max(0, Math.cos(phi - Math.PI)) ** 3
const orangeGlow = (phi: number) => Math.max(0, Math.cos(phi - 0.26)) ** 8

/**
 * 손잡이 옆면 — count 조각 기둥. 카메라 쪽(대략 -45°~225°)만 만든다.
 * 조각 하나 안에서 양 끝 각도의 색을 이어 칠해(고러드 음영) 조각 경계 줄무늬가 안 보이게 한다.
 * --kl0/--kl1·--kd0/--kd1: 밝음·어두움 주변광 색(조각 앞끝·뒤끝), --gb0/1·--go0/1: 파랑·주황 글자 빛 세기
 */
export function knobSideFaces(count = 56): D5Face[] {
  const { radius, height } = D5_KNOB
  const total = height + D5_SLOT.depth
  const step = (Math.PI * 2) / count
  const chord = 2 * radius * Math.sin(step / 2) + 0.05
  const faces: D5Face[] = []
  for (let i = 0; i < count; i++) {
    const phi = step * i
    let a = deg(phi)
    if (a > 225) a -= 360
    if (a < -45 || a > 225) continue
    const a0 = a - deg(step) / 2
    const a1 = a + deg(step) / 2
    faces.push({
      key: String(i),
      style: {
        width: em(total),
        height: em(chord),
        transform: `rotateZ(${a.toFixed(3)}deg) translate3d(${em(radius)}, 0, ${em(height)}) rotateY(90deg) translateY(-50%)`,
        '--kl0': sampleStops(KNOB_SIDE_LIGHT, a0),
        '--kl1': sampleStops(KNOB_SIDE_LIGHT, a1),
        '--kd0': sampleStops(KNOB_SIDE_DARK, a0),
        '--kd1': sampleStops(KNOB_SIDE_DARK, a1),
        '--gb0': blueGlow((a0 * Math.PI) / 180).toFixed(3),
        '--gb1': blueGlow((a1 * Math.PI) / 180).toFixed(3),
        '--go0': orangeGlow((a0 * Math.PI) / 180).toFixed(3),
        '--go1': orangeGlow((a1 * Math.PI) / 180).toFixed(3),
      } as CSSProperties,
    })
  }
  return faces
}
