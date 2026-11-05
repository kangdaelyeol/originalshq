import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GlassSettings } from '../theme/glass'
import type { MondayPalette } from '../theme/monday'
import { WATER_DEFAULT, type WaterSettings } from '../theme/water'
import { ThemeRoot, type ThemeName } from '../theme/theme-root'
import {
  AppearanceContext,
  DEFAULT_APPEARANCE,
  effectiveAccent,
  loadAppearance,
  saveAppearance,
  type Appearance,
  type BuiltInBackground,
} from './appearance'

/**
 * 외관 설정 상태 + 디자인 루트 — 저장된 외관(appearance.ts)으로 ThemeRoot(.ohq-ui)를 그리고, 바꾸면 저장한다.
 * className은 화면 범위 클래스(.xtool-tech 등). 첫 렌더부터 저장된 값으로 칠하니, 기본값이 잠깐 보였다 바뀌는
 * 일도 없다.
 */
export function AppearanceProvider({ className, children }: { className?: string; children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)
  const accentInUse = effectiveAccent(appearance)

  useEffect(() => {
    saveAppearance(appearance)
  }, [appearance])

  const value = useMemo(
    () => ({
      ...appearance,
      accentInUse,
      setTheme: (theme: ThemeName) => setAppearance((a) => ({ ...a, theme })),
      setMondayPalette: (mondayPalette: MondayPalette) => setAppearance((a) => ({ ...a, mondayPalette })),
      setMondayPhoto: (mondayPhotoId: string | null) => setAppearance((a) => ({ ...a, mondayPhotoId })),
      setBackground: (background: BuiltInBackground) =>
        setAppearance((a) => ({ ...a, background, sharedBackgroundId: null })),
      setSharedBackground: (id: string) =>
        setAppearance((a) => ({ ...a, background: 'shared', sharedBackgroundId: id })),
      setAccent: (accent: string) => setAppearance((a) => ({ ...a, accent: accent.toLowerCase() })),
      setGlass: (glass: Partial<GlassSettings>) => setAppearance((a) => ({ ...a, glass: { ...a.glass, ...glass } })),
      setWater: (water: Partial<WaterSettings>) => setAppearance((a) => ({ ...a, water: { ...a.water, ...water } })),
      // 배경 카드의 "기본값으로" — 판 모양(테마)과 그 색·사진, 물 디자인 값은 따로 고른 것이라 남긴다.
      reset: () =>
        setAppearance((a) => ({
          ...DEFAULT_APPEARANCE,
          theme: a.theme,
          mondayPalette: a.mondayPalette,
          mondayPhotoId: a.mondayPhotoId,
          water: a.water,
        })),
      resetWater: () => setAppearance((a) => ({ ...a, water: WATER_DEFAULT })),
    }),
    [appearance, accentInUse],
  )

  return (
    <AppearanceContext.Provider value={value}>
      <ThemeRoot
        accent={accentInUse}
        glass={appearance.glass}
        water={appearance.water}
        theme={appearance.theme}
        palette={appearance.mondayPalette}
        className={className}
      >
        {children}
      </ThemeRoot>
    </AppearanceContext.Provider>
  )
}
