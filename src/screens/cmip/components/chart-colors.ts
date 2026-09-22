/**
 * channel-insight-chart-modal 전용 — 지표 기본색(METRIC_FIELDS의 color)을 채널×그룹
 * 조합별로 살짝 다른 색조/명도의 같은 색 계열로 바꾸는 색상 계산. React 상태와 무관한
 * 순수 함수/데이터라 view-model이 아니라 이 파일로 분리해둔다.
 */

export type ChannelKey = 'combined' | 'meta' | 'google' | 'naver'

// 지금은 Meta/Google/Naver — 당근이 붙으면 이 목록만 늘리면 된다
// (CombinedInsight.series가 그 채널 키를 갖게 되는 시점에 맞춰).
export const CHANNEL_STYLE: Record<ChannelKey, { label: string }> = {
  combined: { label: '전체' },
  meta: { label: 'Meta' },
  google: { label: 'Google' },
  naver: { label: 'Naver' },
}
export const CHANNEL_ORDER: readonly ChannelKey[] = [
  'combined',
  'meta',
  'google',
  'naver',
]

// 지표 10개 × 채널 최대 4개 = 최대 40색. dash·투명도로 채널을 구분해봤더니 오히려
// 헷갈려서, 지표 고유 색상(hue)은 유지한 채 채널마다 명도/채도만 다르게 바꿔서
// "같은 지표 계열, 다른 채널"이 색으로 바로 구별되게 한다(전체=원색, Meta=밝게,
// Google=어둡고 살짝 다른 색조, Naver=그와 또 다른 색조). 채널이 늘어나면
// CHANNEL_SHIFT에 한 줄만 추가하면 됨.
const CHANNEL_SHIFT: Record<
  ChannelKey,
  { hue: number; saturation: number; lightness: number }
> = {
  combined: { hue: 0, saturation: 0, lightness: 0 },
  meta: { hue: 0, saturation: 4, lightness: 16 },
  google: { hue: 10, saturation: -6, lightness: -15 },
  naver: { hue: -20, saturation: 8, lightness: -5 },
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = (((g - b) / d) % 6) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  const [r0, g0, b0] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r0)}${toHex(g0)}${toHex(b0)}`
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

// 캠페인/adset처럼 "그룹"을 여러 개 동시에 켰을 때도 채널과 같은 방식으로
// 구분한다 — 그룹 인덱스(선택 여부와 무관하게 항상 같은 그룹은 같은 인덱스라
// 색이 고정됨)에 따라 색조/명도를 추가로 틀고, 채널 시프트와 더한다. 그룹×채널
// 조합이 늘어날수록 색이 촘촘해지지만, 채널 30색 팔레트와 같은 트레이드오프로
// 받아들인다(둘 다 동시에 여러 개 켜는 일은 실제로 드물다).
const GROUP_HUE_STEP = 47 // 360과 서로소에 가까워, 그룹을 몇 개 켜도 색상이 금방 반복되지 않는다.
const GROUP_LIGHTNESS_CYCLE = [0, -14, 12, -26, 22]

function groupShift(index: number): {
  hue: number
  saturation: number
  lightness: number
} {
  return {
    hue: (index * GROUP_HUE_STEP) % 360,
    saturation: 0,
    lightness: GROUP_LIGHTNESS_CYCLE[index % GROUP_LIGHTNESS_CYCLE.length],
  }
}

/** 지표 기본색을 채널×그룹 조합별로 살짝 다른 색조/명도의 같은 색 계열로 바꾼다. */
export function seriesColor(
  baseColor: string,
  groupIndex: number,
  channelKey: ChannelKey,
): string {
  const c = CHANNEL_SHIFT[channelKey]
  const g = groupShift(groupIndex)
  const hue = c.hue + g.hue
  const saturation = c.saturation + g.saturation
  const lightness = c.lightness + g.lightness
  if (hue === 0 && saturation === 0 && lightness === 0) return baseColor
  const [h, s, l] = hexToHsl(baseColor)
  return hslToHex(
    (h + hue + 360) % 360,
    clamp(s + saturation, 15, 100),
    clamp(l + lightness, 15, 85),
  )
}
