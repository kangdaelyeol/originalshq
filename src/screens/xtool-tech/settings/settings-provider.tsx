import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import type { GlassSettings } from '@/ohq-ui/theme/glass'
import { ThemeRoot } from '@/ohq-ui/theme/theme-root'
import {
  DEFAULT_SETTINGS,
  effectiveAccent,
  loadSettings,
  saveSettings,
  SettingsContext,
  type BoardLayout,
  type MondayPalette,
  type BuiltInBackground,
  type Settings,
} from './settings'

const FIGTREE_HREF = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap'

/**
 * 설정 상태 + 이 화면의 루트 요소 — 공용 디자인 루트(ThemeRoot, .ohq-ui)에 tech 범위(.xtool-tech)와
 * Monday 테마 클래스를 붙이고, 고른 강조색·유리 값을 넘긴다. 첫 렌더부터 저장된 값으로 칠하니, 기본값이
 * 잠깐 보였다 바뀌는 일도 없다.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const accentInUse = effectiveAccent(settings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Monday 표 글꼴(Figtree) — 고를 때 한 번만 불러온다. index.html은 다른 화면과 같이 써서 손대지 않는다.
  const monday = settings.layout === 'monday'
  useEffect(() => {
    if (!monday || document.head.querySelector(`link[href="${FIGTREE_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FIGTREE_HREF
    document.head.append(link)
  }, [monday])

  const value = useMemo(
    () => ({
      ...settings,
      accentInUse,
      setLayout: (layout: BoardLayout) => setSettings((s) => ({ ...s, layout })),
      setMondayPalette: (mondayPalette: MondayPalette) => setSettings((s) => ({ ...s, mondayPalette })),
      setBackground: (background: BuiltInBackground) =>
        setSettings((s) => ({ ...s, background, sharedBackgroundId: null })),
      setSharedBackground: (id: string) =>
        setSettings((s) => ({ ...s, background: 'shared', sharedBackgroundId: id })),
      setAccent: (accent: string) => setSettings((s) => ({ ...s, accent: accent.toLowerCase() })),
      setGlass: (glass: Partial<GlassSettings>) => setSettings((s) => ({ ...s, glass: { ...s.glass, ...glass } })),
      // 배경 카드의 "기본값으로" — 보드 화면 모양(레이아웃)은 따로 고른 것이라 남긴다.
      reset: () => setSettings((s) => ({ ...DEFAULT_SETTINGS, layout: s.layout, mondayPalette: s.mondayPalette })),
    }),
    [settings, accentInUse],
  )

  // Monday 표면 theme-monday + 색(남색은 기본이라 클래스 없음 · mon-light · mon-black)
  const rootClass = cx('xtool-tech', monday && 'theme-monday', monday && settings.mondayPalette !== 'navy' && `mon-${settings.mondayPalette}`)

  return (
    <SettingsContext.Provider value={value}>
      {/* Monday 표 레이아웃이면 화면 전체를 Monday 모양으로(theme-monday — styles/_theme-monday.scss). */}
      <ThemeRoot accent={accentInUse} glass={settings.glass} className={rootClass}>
        {children}
      </ThemeRoot>
    </SettingsContext.Provider>
  )
}
