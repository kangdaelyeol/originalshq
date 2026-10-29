import { useLayoutEffect } from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'

/**
 * 유리 테마 목록 — 실제 색은 styles/base.scss의 [data-glass-theme] 블록이고,
 * 여기 색은 테마 고르기의 견본(바탕·데이터색·누르는 색)용이다. 테마를 더할
 * 때는 두 곳을 같이 고친다.
 */
export const GLASS_THEMES = [
  {
    id: 'lime',
    label: 'Lime',
    base: '#050606',
    accent: '#d4f25c',
    link: '#6ee7e0',
  },
  {
    id: 'ember',
    label: 'Ember',
    base: '#0d0907',
    accent: '#f5a37c',
    link: '#f3e3c8',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    base: '#070a14',
    accent: '#5eead4',
    link: '#a78bfa',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    base: '#04100f',
    accent: '#7dd3fc',
    link: '#86efac',
  },
  {
    id: 'orchid',
    label: 'Orchid',
    base: '#0c0710',
    accent: '#f0abfc',
    link: '#93c5fd',
  },
  {
    id: 'daylight',
    label: 'Daylight',
    base: '#e8ecf2',
    accent: '#7c3aed',
    link: '#0f766e',
  },
] as const

export type GlassThemeId = (typeof GLASS_THEMES)[number]['id']

const THEME_IDS = GLASS_THEMES.map((each) => each.id)

/**
 * 고른 테마 — 이 브라우저에 남기고, 쓰는 동안 <html data-glass-theme>에
 * 걸어 둔다(테마 변수가 화면 전체에 닿도록). 화면을 떠나면 뗀다.
 */
export const useGlassTheme = (storageKey: string) => {
  const [theme, setTheme] = usePersistentState<GlassThemeId>(
    storageKey,
    'lime',
    oneOf(THEME_IDS),
  )

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.glassTheme = theme
    return () => {
      delete root.dataset.glassTheme
    }
  }, [theme])

  return [theme, setTheme] as const
}
