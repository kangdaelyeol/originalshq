import { useLocation } from 'react-router-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterToaster } from '../components/water/board'
import { xtPath } from '../paths'
import type { WaterShellProps } from './water-gate'
import { WaterSidebar } from './water-sidebar'
import { WaterTopbar } from './water-topbar'

/**
 * 물 레이아웃의 화면 틀 — 화면 전체에 물 무대(D7 연회색 유리 타일 벽, 붙박이)를 깔고 왼쪽에 유리 사이드바,
 * 오른쪽에 상단바와 본문. 사이드바는 화면에 붙어 있고(sticky) 본문만 스크롤된다(지금 레이아웃과 같은 구조).
 * 본문 부품은 레이아웃 부품(components/layout-parts)이 물 부품으로 바꿔 그린다.
 */
export function WaterShell({ member, collapsed, onToggle, children }: WaterShellProps) {
  const { pathname } = useLocation()
  // 디자인(부품 카탈로그)은 견본마다 바탕이 있어 어두운 판 위에 그대로 그린다(styles/_pages.scss)
  const native = pathname.startsWith(xtPath('/design'))
  return (
    <div className={cx('wl-shell', collapsed && 'is-collapsed')}>
      <div className="water-stage wl-stage" aria-hidden />
      <WaterSidebar member={member} collapsed={collapsed} onToggle={onToggle} />
      <main className="wl-main">
        <WaterTopbar />
        {/* 경로가 바뀌면 새로 그려서 본문이 물처럼 떠오른다(D7 move 스프링 — 합성 단계에서만) */}
        <div key={pathname} className={cx('wl-page', native && 'wl-page--native')}>
          {children}
        </div>
      </main>
      <WaterToaster />
    </div>
  )
}
