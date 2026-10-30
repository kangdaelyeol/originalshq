import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyAccent } from './accent'
import { applyGlass, type GlassSettings } from './glass'
import {
  DEFAULT_SETTINGS,
  effectiveAccent,
  loadSettings,
  saveSettings,
  SettingsContext,
  type BackgroundKind,
  type Settings,
} from './settings'

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const accentInUse = effectiveAccent(settings)

  // 강조색 변수는 :root에(첫 화면 전에는 main.tsx가 한 번 칠한다), 설정은 이 브라우저에 저장.
  useEffect(() => {
    applyAccent(accentInUse)
  }, [accentInUse])

  useEffect(() => {
    applyGlass(settings.glass)
  }, [settings.glass])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const value = useMemo(
    () => ({
      ...settings,
      accentInUse,
      setBackground: (background: BackgroundKind) => setSettings((s) => ({ ...s, background })),
      setAccent: (accent: string) => setSettings((s) => ({ ...s, accent: accent.toLowerCase() })),
      setGlass: (glass: Partial<GlassSettings>) => setSettings((s) => ({ ...s, glass: { ...s.glass, ...glass } })),
      reset: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings, accentInUse],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
