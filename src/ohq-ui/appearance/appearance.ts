import { createContext, useContext } from 'react'
import { DEFAULT_ACCENT, isHexColor } from '../theme/accent'
import { GLASS_DEFAULT, normalizeGlass, type GlassSettings } from '../theme/glass'
import { MONDAY_PALETTES, type MondayPalette } from '../theme/monday'
import type { ThemeName } from '../theme/theme-root'
import { normalizeWater, WATER_DEFAULT, type WaterSettings } from '../theme/water'

// 외관 설정 — 판 모양(유리·Monday·물)과 그 색, 강조색, 유리 효과, 배경. 이 브라우저에 저장해 두고 originalshq의
// 화면들(기술팀 보드·관리 화면 등)이 같은 모양으로 그린다(AppearanceProvider). 고르는 화면(설정)은 각 앱이 그린다.

/** 기본으로 들어 있는 배경 */
export type BuiltInBackground = 'shards' | 'silk' | 'grunge' | 'photo'
/** shared — 직원이 올려 팀이 함께 쓰는 사진(sharedBackgroundId — 주소는 앱이 찾는다) */
export type BackgroundKind = BuiltInBackground | 'shared'

export interface BackgroundOption {
  value: BuiltInBackground
  label: string
  description: string
  /** 사진은 강조색을 바꾸지 않는다(사진 색을 해치지 않게). */
  kind: 'default' | 'texture' | 'photo'
}

export const BACKGROUND_OPTIONS: readonly BackgroundOption[] = [
  { value: 'shards', label: '블랙 파편', description: '처음부터 쓰던 기본 배경', kind: 'default' },
  { value: 'silk', label: '실크 웨이브', description: '강조색으로 빛나는 비단 물결', kind: 'texture' },
  { value: 'grunge', label: '그런지', description: '긁힌 캔버스 결 — 긁힘에 강조색이 배어요', kind: 'texture' },
  { value: 'photo', label: '작업장 사진', description: 'xTool 장비가 있는 작업장', kind: 'photo' },
]

export interface Appearance {
  /**
   * 판 모양 — glass: 유리 판(기본) · monday: Monday 판·선·버튼(화면도 Monday식 배치를 고를 수 있다) · water: D7 물
   * (화면 틀·부품을 물 부품으로)
   */
  theme: ThemeName
  /** Monday 테마의 색 */
  mondayPalette: MondayPalette
  /** Monday 테마의 배경 사진 — 팀이 공유한 사진 id(없으면 Monday 바탕색). 유리 배경과 따로 고른다. */
  mondayPhotoId: string | null
  background: BackgroundKind
  /** background가 shared일 때 고른 사진(앱이 주소를 찾아 ScreenBackground에 넘긴다) */
  sharedBackgroundId: string | null
  /** 사용자가 고른 강조색 — 사진 배경·Monday 테마에서는 쓰지 않는다(effectiveAccent). */
  accent: string
  /** 유리 판의 흐림·농도·채도·테두리 빛 */
  glass: GlassSettings
  /** 물 디자인의 벽 색조·강조색·깊이·테두리(유리의 배경·강조색·유리 효과에 해당) */
  water: WaterSettings
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'glass',
  mondayPalette: 'navy',
  mondayPhotoId: null,
  background: 'shards',
  sharedBackgroundId: null,
  accent: DEFAULT_ACCENT,
  glass: GLASS_DEFAULT,
  water: WATER_DEFAULT,
}

// 저장 위치·모양 — 처음 기술팀 보드(xtool-tech)에서 쓰던 그대로 둔다(이미 저장된 값을 계속 읽게). 판 모양은
// 그때의 필드(layout: 'dashboard' | 'monday')로 저장한다 — 물은 'water'를 더했다.
const STORAGE_KEY = 'xtool-tech:settings'

interface StoredAppearance extends Omit<Appearance, 'theme'> {
  layout: 'dashboard' | 'monday' | 'water'
}

/** 이 브라우저에 저장된 외관 — 없거나 깨졌거나 저장소를 못 쓰면 기본값. */
export function loadAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<StoredAppearance>
    const sharedId = typeof parsed.sharedBackgroundId === 'string' && parsed.sharedBackgroundId ? parsed.sharedBackgroundId : null
    const shared = parsed.background === 'shared' && sharedId !== null
    return {
      theme: parsed.layout === 'monday' || parsed.layout === 'water' ? parsed.layout : 'glass',
      mondayPalette: MONDAY_PALETTES.some((o) => o.value === parsed.mondayPalette)
        ? (parsed.mondayPalette as MondayPalette)
        : DEFAULT_APPEARANCE.mondayPalette,
      mondayPhotoId: typeof parsed.mondayPhotoId === 'string' && parsed.mondayPhotoId ? parsed.mondayPhotoId : null,
      background: shared
        ? 'shared'
        : BACKGROUND_OPTIONS.some((o) => o.value === parsed.background)
          ? (parsed.background as BuiltInBackground)
          : DEFAULT_APPEARANCE.background,
      sharedBackgroundId: shared ? sharedId : null,
      accent: isHexColor(parsed.accent) ? parsed.accent.toLowerCase() : DEFAULT_APPEARANCE.accent,
      glass: normalizeGlass(parsed.glass),
      water: normalizeWater(parsed.water),
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance({ theme, ...rest }: Appearance): void {
  const stored: StoredAppearance = { layout: theme === 'glass' ? 'dashboard' : theme, ...rest }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    /* 사생활 보호 모드 등 저장소를 못 쓰면 이번 방문 동안만 적용된다 */
  }
}

/** 사진 배경(작업장 사진·공유 사진)인지 — 강조색을 기본색으로 고정한다. */
export const isPhotoBackground = (background: BackgroundKind): boolean => background === 'photo' || background === 'shared'

/** Monday 테마의 강조색 — Monday 주 버튼·선택 표시의 파랑(캡처에서 잰 값). */
export const MONDAY_ACCENT = '#2364e3'

/** 실제로 화면에 쓰는 강조색 — Monday 테마면 Monday 파랑, 사진 배경이면 기본색. */
export const effectiveAccent = (a: Appearance): string =>
  a.theme === 'monday' ? MONDAY_ACCENT : isPhotoBackground(a.background) ? DEFAULT_ACCENT : a.accent

export interface AppearanceState extends Appearance {
  /** 지금 화면에 칠해진 강조색 */
  accentInUse: string
  setTheme: (theme: ThemeName) => void
  setMondayPalette: (palette: MondayPalette) => void
  /** Monday 배경 사진(팀이 공유한 사진 id, null이면 Monday 바탕색) */
  setMondayPhoto: (id: string | null) => void
  setBackground: (background: BuiltInBackground) => void
  /** 팀이 공유한 사진을 배경으로 */
  setSharedBackground: (id: string) => void
  setAccent: (accent: string) => void
  /** 일부 값만 넘기면 나머지는 그대로 둔다. */
  setGlass: (glass: Partial<GlassSettings>) => void
  /** 물 디자인 값 — 일부만 넘기면 나머지는 그대로 */
  setWater: (water: Partial<WaterSettings>) => void
  /** 배경 카드의 "기본값으로" — 유리 쪽(배경·강조색·유리 효과)만. 물 값은 resetWater */
  reset: () => void
  resetWater: () => void
}

export const AppearanceContext = createContext<AppearanceState | null>(null)

export function useAppearance(): AppearanceState {
  const state = useContext(AppearanceContext)
  if (!state) throw new Error('useAppearance는 AppearanceProvider 안에서만 쓸 수 있어요')
  return state
}
