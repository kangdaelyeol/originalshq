import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { PortalRootContext } from '../lib/portal-root'
import { accentVars } from './accent'
import { glassVars, type GlassSettings } from './glass'
import { FIGTREE_HREF, type MondayPalette } from './monday'
import { waterVars, type WaterSettings } from './water'

/**
 * 판 모양 — glass: 유리 판(기본) · monday: Monday 판·선·버튼(styles/themes) · water: D7 물(연회색 유리 벽 위 물
 * 부품 — 화면 틀과 부품은 앱이 물 부품으로 바꿔 그린다)
 */
export type ThemeName = 'glass' | 'monday' | 'water'

interface ThemeRootProps {
  /** 강조색(#rrggbb) — 밝은·어두운 단계와 그 위 글자색은 여기서 만든다(theme/accent.ts). */
  accent: string
  /** 유리 판의 흐림·농도·채도·테두리 빛 */
  glass: GlassSettings
  /** 물 디자인의 벽·강조색·깊이·테두리 — 물일 때만 칠한다(theme/water.ts) */
  water?: WaterSettings
  /** 판 모양 — 기본은 유리 */
  theme?: ThemeName
  /** Monday 테마의 색 — 기본은 남색 */
  palette?: MondayPalette
  /** 화면 범위 클래스(.xtool-tech 등) — .ohq-ui 옆에 붙는다. */
  className?: string
  children: ReactNode
}

/**
 * originalshq 공용 디자인(ohq-ui)의 루트 — 이 요소(.ohq-ui) 아래에만 토큰·기본 스타일이 걸린다
 * (styles/_base.scss). theme="monday"면 Monday 판 모양과 색(palette)으로 덮는다(styles/themes). 강조색·유리 값은 CSS 변수로 이 요소 style에 칠한다 — :root에 쓰면 다른 화면(같은
 * 이름의 --glass-* 등)에 새어 나간다. 포털(팝오버·모달·토스트)도 body 대신 여기에 띄워야 토큰이 그대로
 * 적용된다(usePortalRoot).
 */
export function ThemeRoot({ accent, glass, water, theme = 'glass', palette = 'navy', className, children }: ThemeRootProps) {
  // 포털이 띄워질 곳 — 루트 요소가 붙으면 채워진다.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  const style = useMemo(
    () =>
      ({ ...accentVars(accent), ...glassVars(glass), ...(theme === 'water' && water ? waterVars(water) : {}) }) as CSSProperties,
    [accent, glass, water, theme],
  )
  const monday = theme === 'monday'

  // Monday 글꼴 — Monday 테마를 고를 때 한 번만 불러온다.
  useEffect(() => {
    if (!monday || document.head.querySelector(`link[href="${FIGTREE_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FIGTREE_HREF
    document.head.append(link)
  }, [monday])

  // Monday 테마는 theme-monday + 색(남색은 기본이라 클래스 없음 · mon-light · mon-black), 물은 theme-water
  const themeClass = monday ? cx('theme-monday', palette !== 'navy' && `mon-${palette}`) : theme === 'water' && 'theme-water'
  return (
    <PortalRootContext.Provider value={rootEl}>
      <div ref={setRootEl} className={cx('ohq-ui', themeClass, className)} style={style}>
        {children}
      </div>
    </PortalRootContext.Provider>
  )
}
