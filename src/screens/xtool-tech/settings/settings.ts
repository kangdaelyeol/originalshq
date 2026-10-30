import { createContext, useContext } from 'react'
import { DEFAULT_ACCENT, isHexColor } from './accent'
import { GLASS_DEFAULT, normalizeGlass, type GlassSettings } from './glass'

export type BackgroundKind = 'shards' | 'silk' | 'grunge' | 'photo'

export interface BackgroundOption {
  value: BackgroundKind
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

export interface Settings {
  background: BackgroundKind
  /** 사용자가 고른 강조색 — 사진 배경일 땐 쓰지 않고 기본색을 쓴다(effectiveAccent). */
  accent: string
  /** 유리 판의 흐림·농도·채도·테두리 빛 */
  glass: GlassSettings
}

export const DEFAULT_SETTINGS: Settings = { background: 'shards', accent: DEFAULT_ACCENT, glass: GLASS_DEFAULT }

const STORAGE_KEY = 'xtool-tech:settings'

/** 이 브라우저에 저장된 설정 — 없거나 깨졌거나 저장소를 못 쓰면 기본값. */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      background: BACKGROUND_OPTIONS.some((o) => o.value === parsed.background)
        ? (parsed.background as BackgroundKind)
        : DEFAULT_SETTINGS.background,
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

/** 실제로 화면에 쓰는 강조색 — 사진 배경이면 기본색. */
export const effectiveAccent = (s: Settings): string => (s.background === 'photo' ? DEFAULT_ACCENT : s.accent)

export interface SettingsState extends Settings {
  /** 지금 화면에 칠해진 강조색 */
  accentInUse: string
  setBackground: (background: BackgroundKind) => void
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
