import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { PortalRootContext } from '../lib/portal-root'
import { accentVars } from './accent'
import { glassVars, type GlassSettings } from './glass'

interface ThemeRootProps {
  /** 강조색(#rrggbb) — 밝은·어두운 단계와 그 위 글자색은 여기서 만든다(theme/accent.ts). */
  accent: string
  /** 유리 판의 흐림·농도·채도·테두리 빛 */
  glass: GlassSettings
  /** 화면 범위 클래스(.xtool-tech 등)와 테마 클래스 — .ohq-ui 옆에 붙는다. */
  className?: string
  children: ReactNode
}

/**
 * originalshq 공용 디자인(ohq-ui)의 루트 — 이 요소(.ohq-ui) 아래에만 토큰·기본 스타일이 걸린다
 * (styles/_base.scss). 강조색·유리 값은 CSS 변수로 이 요소 style에 칠한다 — :root에 쓰면 다른 화면(같은
 * 이름의 --glass-* 등)에 새어 나간다. 포털(팝오버·모달·토스트)도 body 대신 여기에 띄워야 토큰이 그대로
 * 적용된다(usePortalRoot).
 */
export function ThemeRoot({ accent, glass, className, children }: ThemeRootProps) {
  // 포털이 띄워질 곳 — 루트 요소가 붙으면 채워진다.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  const style = useMemo(() => ({ ...accentVars(accent), ...glassVars(glass) }) as CSSProperties, [accent, glass])
  return (
    <PortalRootContext.Provider value={rootEl}>
      <div ref={setRootEl} className={cx('ohq-ui', className)} style={style}>
        {children}
      </div>
    </PortalRootContext.Provider>
  )
}
