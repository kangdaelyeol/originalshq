import { createContext, useContext } from 'react'
import { DEFAULT_ACCENT, isHexColor } from '@/ohq-ui/theme/accent'
import { GLASS_DEFAULT, normalizeGlass, type GlassSettings } from '@/ohq-ui/theme/glass'

/** 기본으로 들어 있는 배경 */
export type BuiltInBackground = 'shards' | 'silk' | 'grunge' | 'photo'
/** shared — 직원이 올려 팀이 함께 쓰는 사진(sharedBackgroundId) */
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

/** 보드 화면 모양 — dashboard: 카드·차트(기본) · monday: Monday처럼 그룹별 표, 칸을 눌러 바로 고친다. */
export type BoardLayout = 'dashboard' | 'monday'

export const LAYOUT_OPTIONS: readonly { value: BoardLayout; label: string; description: string }[] = [
  { value: 'dashboard', label: '대시보드', description: '숫자 카드·차트와 목록 — 처음부터 쓰던 화면' },
  { value: 'monday', label: 'Monday 표', description: 'Monday처럼 그룹별 표 — 칸을 눌러 바로 고쳐요' },
]

/** Monday 표 레이아웃의 색 — 남색(Monday 다크) · 라이트 · 블랙(Monday 나이트) */
export type MondayPalette = 'navy' | 'light' | 'black'

export const MONDAY_PALETTES: readonly { value: MondayPalette; label: string; swatch: [string, string, string] }[] = [
  // 견본: 바탕 · 칸 · 선택
  { value: 'navy', label: '남색', swatch: ['#18192d', '#2b2c44', '#192f67'] },
  { value: 'light', label: '라이트', swatch: ['#ffffff', '#f5f6fa', '#cce5ff'] },
  { value: 'black', label: '블랙', swatch: ['#121212', '#272727', '#192f67'] },
]

export interface Settings {
  /** 보드 화면 모양 */
  layout: BoardLayout
  /** Monday 표 레이아웃의 색 */
  mondayPalette: MondayPalette
  background: BackgroundKind
  /** background가 shared일 때 고른 사진(techBackgrounds 문서 id) */
  sharedBackgroundId: string | null
  /** 사용자가 고른 강조색 — 사진 배경일 땐 쓰지 않고 기본색을 쓴다(effectiveAccent). */
  accent: string
  /** 유리 판의 흐림·농도·채도·테두리 빛 */
  glass: GlassSettings
}

export const DEFAULT_SETTINGS: Settings = {
  layout: 'dashboard',
  mondayPalette: 'navy',
  background: 'shards',
  sharedBackgroundId: null,
  accent: DEFAULT_ACCENT,
  glass: GLASS_DEFAULT,
}

const STORAGE_KEY = 'xtool-tech:settings'

/** 이 브라우저에 저장된 설정 — 없거나 깨졌거나 저장소를 못 쓰면 기본값. */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const sharedId = typeof parsed.sharedBackgroundId === 'string' && parsed.sharedBackgroundId ? parsed.sharedBackgroundId : null
    const shared = parsed.background === 'shared' && sharedId !== null
    return {
      layout: LAYOUT_OPTIONS.some((o) => o.value === parsed.layout) ? (parsed.layout as BoardLayout) : DEFAULT_SETTINGS.layout,
      mondayPalette: MONDAY_PALETTES.some((o) => o.value === parsed.mondayPalette)
        ? (parsed.mondayPalette as MondayPalette)
        : DEFAULT_SETTINGS.mondayPalette,
      background: shared
        ? 'shared'
        : BACKGROUND_OPTIONS.some((o) => o.value === parsed.background)
          ? (parsed.background as BuiltInBackground)
          : DEFAULT_SETTINGS.background,
      sharedBackgroundId: shared ? sharedId : null,
      accent: isHexColor(parsed.accent) ? parsed.accent.toLowerCase() : DEFAULT_SETTINGS.accent,
      glass: normalizeGlass(parsed.glass),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 사생활 보호 모드 등 저장소를 못 쓰면 이번 방문 동안만 적용된다 */
  }
}

/** 사진 배경(작업장 사진·공유 사진)인지 — 강조색을 기본색으로 고정한다. */
export const isPhotoBackground = (background: BackgroundKind): boolean => background === 'photo' || background === 'shared'

/** Monday 표 레이아웃의 강조색 — Monday 주 버튼·선택 표시의 파랑(캡처에서 잰 값). */
export const MONDAY_ACCENT = '#2364e3'

/** 실제로 화면에 쓰는 강조색 — Monday 표면 Monday 파랑, 사진 배경이면 기본색. */
export const effectiveAccent = (s: Settings): string =>
  s.layout === 'monday' ? MONDAY_ACCENT : isPhotoBackground(s.background) ? DEFAULT_ACCENT : s.accent

export interface SettingsState extends Settings {
  /** 지금 화면에 칠해진 강조색 */
  accentInUse: string
  setLayout: (layout: BoardLayout) => void
  setMondayPalette: (palette: MondayPalette) => void
  setBackground: (background: BuiltInBackground) => void
  /** 팀이 공유한 사진을 배경으로 */
  setSharedBackground: (id: string) => void
  setAccent: (accent: string) => void
  /** 일부 값만 넘기면 나머지는 그대로 둔다. */
  setGlass: (glass: Partial<GlassSettings>) => void
  reset: () => void
}

export const SettingsContext = createContext<SettingsState | null>(null)

export function useSettings(): SettingsState {
  const state = useContext(SettingsContext)
  if (!state) throw new Error('useSettings는 SettingsProvider 안에서만 쓸 수 있어요')
  return state
}
