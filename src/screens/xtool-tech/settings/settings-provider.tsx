import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { PortalRootContext } from '../lib/portal-root'
import { accentVars } from './accent'
import { glassVars, type GlassSettings } from './glass'
import {
  DEFAULT_SETTINGS,
  effectiveAccent,
  loadSettings,
  saveSettings,
  SettingsContext,
  type BoardLayout,
  type BuiltInBackground,
  type Settings,
} from './settings'

/**
 * 설정 상태 + 이 화면의 루트 요소(.xtool-tech). 강조색·유리 값은 CSS 변수로 루트 요소 style에
 * 칠한다 — :root에 쓰면 originalshq의 다른 화면(같은 이름의 --glass-* 등)에 새어 나간다. 첫
 * 렌더부터 저장된 값으로 칠하니, 기본값이 잠깐 보였다 바뀌는 일도 없다.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  // 포털(알림 패널)이 띄워질 곳 — 루트 요소가 붙으면 채워진다.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  const accentInUse = effectiveAccent(settings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const value = useMemo(
    () => ({
      ...settings,
      accentInUse,
      setLayout: (layout: BoardLayout) => setSettings((s) => ({ ...s, layout })),
      setBackground: (background: BuiltInBackground) =>
        setSettings((s) => ({ ...s, background, sharedBackgroundId: null })),
      setSharedBackground: (id: string) =>
        setSettings((s) => ({ ...s, background: 'shared', sharedBackgroundId: id })),
      setAccent: (accent: string) => setSettings((s) => ({ ...s, accent: accent.toLowerCase() })),
      setGlass: (glass: Partial<GlassSettings>) => setSettings((s) => ({ ...s, glass: { ...s.glass, ...glass } })),
      // 배경 카드의 "기본값으로" — 보드 화면 모양(레이아웃)은 따로 고른 것이라 남긴다.
      reset: () => setSettings((s) => ({ ...DEFAULT_SETTINGS, layout: s.layout })),
    }),
    [settings, accentInUse],
  )

  const cssVars = useMemo(
    () => ({ ...accentVars(accentInUse), ...glassVars(settings.glass) }) as CSSProperties,
    [accentInUse, settings.glass],
  )

  return (
    <SettingsContext.Provider value={value}>
      <PortalRootContext.Provider value={rootEl}>
        <div ref={setRootEl} className="xtool-tech" style={cssVars}>
          {children}
        </div>
      </PortalRootContext.Provider>
    </SettingsContext.Provider>
  )
}
