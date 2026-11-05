import { isHexColor, mixHex } from './accent'

// 물 디자인(D7) 사용자 설정 — 벽 색조, 강조색(고른 것 뒤 어두운 알약·주 버튼·막대), 유리 깊이·테두리·판 색·농도. 유리 디자인의
// 배경·강조색·유리 효과에 해당한다. CSS 변수(--w-*)로 디자인 루트(.ohq-ui, ThemeRoot)에 칠하고 물 스타일
// (water/styles — _tokens.scss의 $w-dark·w-glass, _stage.scss)이 읽는다. 변수가 없으면 D7 값 그대로다.

/** 벽(무대) 색조 — 밝은 쪽만(벽 위 글자가 잉크색이라 너무 어두우면 읽히지 않는다) */
export type WaterWall = 'grey' | 'bright' | 'warm' | 'cool' | 'deep'

export const WATER_WALLS: readonly { value: WaterWall; label: string; description: string; hi: string; lo: string }[] = [
  // 기본 — _tokens.scss $w-stage-hi·lo
  { value: 'grey', label: '기본', description: '처음 설정 — 연회색 타일', hi: '#e3e1e6', lo: '#acaaaf' },
  { value: 'bright', label: '밝게', description: '하얗게 밝은 벽', hi: '#efeef2', lo: '#c2c0c6' },
  { value: 'warm', label: '따뜻하게', description: '베이지 빛이 도는 벽', hi: '#e8e2d9', lo: '#b2aa9f' },
  { value: 'cool', label: '차갑게', description: '푸른 빛이 도는 벽', hi: '#dfe4ea', lo: '#a7afb8' },
  { value: 'deep', label: '짙게', description: '조금 어두운 회색 벽', hi: '#d5d3d8', lo: '#a3a1a6' },
]

/** 강조색 견본 — null은 D7 잉크(기본). 흰 글자가 얹히니 어두운 단계로 칠한다(waterVars). */
export const WATER_ACCENTS: readonly { value: string | null; label: string }[] = [
  { value: null, label: '잉크(기본)' },
  { value: '#3b5b8c', label: '남색' },
  { value: '#2f7a6a', label: '청록' },
  { value: '#3f7a3a', label: '숲' },
  { value: '#7a4b8c', label: '자두' },
  { value: '#a14a3c', label: '벽돌' },
  { value: '#9a7228', label: '황토' },
]

/** 판 색 — 불투명 판(서랍·팝업·알림)의 바탕. grey: D7 회색 · wall: 벽 색조를 따라 물든다 · white: 흰빛 */
export type WaterPane = 'grey' | 'wall' | 'white'

export const WATER_PANES: readonly { value: WaterPane; label: string }[] = [
  { value: 'grey', label: '기본 회색' },
  { value: 'wall', label: '벽 색 따라' },
  { value: 'white', label: '흰빛' },
]

export interface WaterSettings {
  wall: WaterWall
  /** null — D7 잉크 */
  accent: string | null
  /** 떨어지는 그림자(띄움) 배수 — 1 = 기본 */
  depth: number
  /** 유리 가장자리(테두리·안쪽 그림자) 진하기 배수 — 1 = 기본 */
  rim: number
  /** 불투명 판의 바탕색 */
  pane: WaterPane
  /** 유리 농도 — 판에 덮는 흰빛(0 = D7 그대로 · 투명한 판은 이만큼 흰 막, 불투명한 판은 이만큼 밝아진다) */
  frost: number
}

export const WATER_DEFAULT: WaterSettings = { wall: 'grey', accent: null, depth: 1, rim: 1, pane: 'grey', frost: 0 }

export const WATER_LIMITS = {
  depth: { min: 0, max: 1.6, step: 0.1 },
  rim: { min: 0.4, max: 1.6, step: 0.1 },
  frost: { min: 0, max: 0.6, step: 0.05 },
} as const

export type WaterPreset = 'crisp' | 'default' | 'soft' | 'flat'

export const WATER_PRESETS: readonly { value: WaterPreset; label: string; description: string; depth: number; rim: number }[] = [
  { value: 'crisp', label: '또렷하게', description: '테두리가 진하고 높이 떠요', depth: 1.4, rim: 1.4 },
  { value: 'default', label: '기본', description: '처음 설정', depth: 1, rim: 1 },
  { value: 'soft', label: '은은하게', description: '테두리가 옅고 낮게 떠요', depth: 0.6, rim: 0.7 },
  { value: 'flat', label: '평평하게', description: '그림자 없이 벽에 붙어요', depth: 0, rim: 0.6 },
]

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v))

/** 저장소에서 읽은 값 다듬기 — 모르는 값이면 기본값·경계값으로. */
export function normalizeWater(raw: unknown): WaterSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof WaterSettings, unknown>>
  const num = (key: 'depth' | 'rim' | 'frost') => {
    const v = input[key]
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, WATER_LIMITS[key]) : WATER_DEFAULT[key]
  }
  return {
    wall: WATER_WALLS.some((w) => w.value === input.wall) ? (input.wall as WaterWall) : WATER_DEFAULT.wall,
    accent: isHexColor(input.accent) ? input.accent.toLowerCase() : null,
    depth: num('depth'),
    rim: num('rim'),
    pane: WATER_PANES.some((p) => p.value === input.pane) ? (input.pane as WaterPane) : WATER_DEFAULT.pane,
    frost: num('frost'),
  }
}

/** 지금 깊이·테두리가 어느 프리셋과 같은지 — 없으면 null(사용자 지정) */
export function matchWaterPreset(w: Pick<WaterSettings, 'depth' | 'rim'>): WaterPreset | null {
  return WATER_PRESETS.find((p) => Math.abs(p.depth - w.depth) < 0.05 && Math.abs(p.rim - w.rim) < 0.05)?.value ?? null
}

/** 고른 것 알약 단계 — 위가 밝고 아래가 어두운 그라데이션(D7 #555358 → #2b292e와 같은 결). 흰 글자가 읽히게 어둡게. */
export function waterAccentStops(accent: string) {
  return {
    dark1: mixHex(accent, '#000000', 0.18),
    dark2: mixHex(accent, '#000000', 0.55),
    chip1: mixHex(accent, '#000000', 0.08),
    chip2: mixHex(accent, '#000000', 0.38),
    chip3: mixHex(accent, '#000000', 0.48),
  }
}

// 불투명 판 D7 값 — board/_base.scss $wb-fill(150deg 203 → 189)
const SOLID_HI = '#cbc9ce'
const SOLID_LO = '#bdbbc0'

/**
 * 판 색 — 불투명 판의 그라데이션 두 단계(CSS $wb-fill·물 고르기 팝오버의 SVG 속이 같이 쓴다)와 투명한 판의 바탕.
 * 투명한 판은 D7 그대로 2.6% 어둡게, 유리 농도를 올리면 그만큼 흰 막.
 */
export function waterPaneColors(w: Pick<WaterSettings, 'wall' | 'pane' | 'frost'>) {
  const wall = WATER_WALLS.find((o) => o.value === w.wall) ?? WATER_WALLS[0]
  let hi = SOLID_HI
  let lo = SOLID_LO
  if (w.pane === 'wall') {
    hi = mixHex(SOLID_HI, wall.hi, 0.45)
    lo = mixHex(SOLID_LO, wall.lo, 0.45)
  } else if (w.pane === 'white') {
    hi = '#e7e6ea'
    lo = '#d8d7db'
  }
  if (w.frost > 0) {
    hi = mixHex(hi, '#ffffff', w.frost * 0.5)
    lo = mixHex(lo, '#ffffff', w.frost * 0.5)
  }
  return { solidHi: hi, solidLo: lo, glass: w.frost > 0 ? `rgba(255, 255, 255, ${w.frost})` : 'rgba(0, 0, 0, 0.026)' }
}

/** 물 CSS 변수 묶음 — ThemeRoot가 물일 때 루트 style에 칠한다. 기본값과 같은 것은 빼서 D7 값(스타일의 대체값)을 쓴다. */
export function waterVars(w: WaterSettings): Record<string, string> {
  const vars: Record<string, string> = {}
  const wall = WATER_WALLS.find((o) => o.value === w.wall) ?? WATER_WALLS[0]
  if (wall.value !== 'grey') {
    vars['--w-stage-hi'] = wall.hi
    vars['--w-stage-lo'] = wall.lo
    vars['--w-stage-mid'] = mixHex(wall.hi, wall.lo, 0.6)
  }
  if (w.accent) {
    const s = waterAccentStops(w.accent)
    vars['--w-dark-1'] = s.dark1
    vars['--w-dark-2'] = s.dark2
    vars['--w-dark-chip-1'] = s.chip1
    vars['--w-dark-chip-2'] = s.chip2
    vars['--w-dark-chip-3'] = s.chip3
  }
  if (w.depth !== 1) vars['--w-depth'] = String(w.depth)
  if (w.rim !== 1) vars['--w-rim'] = String(w.rim)
  if (w.pane !== 'grey' || w.frost > 0) {
    const pane = waterPaneColors(w)
    vars['--w-solid-hi'] = pane.solidHi
    vars['--w-solid-lo'] = pane.solidLo
    if (w.frost > 0) vars['--w-pane'] = pane.glass
  }
  return vars
}
