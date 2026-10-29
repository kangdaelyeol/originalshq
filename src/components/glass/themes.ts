import { useLayoutEffect } from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'

/**
 * 유리 테마 목록 — 실제 색은 styles/base.scss의 [data-glass-theme] 블록이고,
 * 여기 색은 테마 고르기의 견본(바탕·데이터색·누르는 색)용이다. scheme은
 * 밝은/어두운 공통 값(base.scss의 [data-glass-scheme])을 고른다. 테마를 더할
 * 때는 두 곳을 같이 고친다.
 */
export const GLASS_THEMES = [
  // 다크
  {
    id: 'lime',
    label: 'Lime',
    scheme: 'dark',
    base: '#050606',
    accent: '#d4f25c',
    link: '#6ee7e0',
  },
  {
    id: 'ember',
    label: 'Ember',
    scheme: 'dark',
    base: '#0d0907',
    accent: '#f5a37c',
    link: '#f3e3c8',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    scheme: 'dark',
    base: '#070a14',
    accent: '#5eead4',
    link: '#a78bfa',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    scheme: 'dark',
    base: '#04100f',
    accent: '#7dd3fc',
    link: '#86efac',
  },
  {
    id: 'orchid',
    label: 'Orchid',
    scheme: 'dark',
    base: '#0c0710',
    accent: '#f0abfc',
    link: '#93c5fd',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    scheme: 'dark',
    base: '#09090b',
    accent: '#e4e4e7',
    link: '#93c5fd',
  },
  {
    id: 'nebula',
    label: 'Nebula',
    scheme: 'dark',
    base: '#0b0714',
    accent: '#c4b5fd',
    link: '#f9a8d4',
  },
  {
    id: 'forest',
    label: 'Forest',
    scheme: 'dark',
    base: '#050d08',
    accent: '#8fe3b0',
    link: '#bae6fd',
  },
  // 라이트
  {
    id: 'daylight',
    label: 'Daylight',
    scheme: 'light',
    base: '#e8ecf2',
    accent: '#7c3aed',
    link: '#0f766e',
  },
  {
    id: 'paper',
    label: 'Paper',
    scheme: 'light',
    base: '#f1f2f4',
    accent: '#2563eb',
    link: '#c026d3',
  },
  {
    id: 'mint',
    label: 'Mint',
    scheme: 'light',
    base: '#e7f3ee',
    accent: '#059669',
    link: '#4f46e5',
  },
  {
    id: 'blush',
    label: 'Blush',
    scheme: 'light',
    base: '#f5eaee',
    accent: '#0e7490',
    link: '#be185d',
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
    // 밝은/어두운 공통 값(base.scss의 [data-glass-scheme='light'])을 고른다.
    root.dataset.glassScheme =
      GLASS_THEMES.find((each) => each.id === theme)?.scheme ?? 'dark'
    return () => {
      delete root.dataset.glassTheme
      delete root.dataset.glassScheme
    }
  }, [theme])

  return [theme, setTheme] as const
}
