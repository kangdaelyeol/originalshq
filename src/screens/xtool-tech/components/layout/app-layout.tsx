import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useUsageTracking } from '@/hooks/use-usage-tracking'
import { ScrollRestoration, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { DENIED_MESSAGE } from '@/xtool-auth/access'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import { useXtoolSession, type XtoolSession } from '@/xtool-auth/use-xtool-session'
import { MemberContext } from '../../context/member-context'
import { cx } from '@/ohq-ui/lib/cx'
import { pageStagger } from '@/ohq-ui/lib/motion'
import { useLayoutKind } from '../../lib/layout-kind'
import { useSidebarCollapsed } from '../../lib/use-sidebar-collapsed'
import type { LoginLocationState } from '../../pages/login-page'
import { MY_WORK_PATH, XT_BASE, xtPath } from '../../paths'
import { WaterBackdrop, WaterShellGate } from '../../water-layout/water-gate'
import { AppBackground } from './app-background'
import { Sidebar } from './sidebar'
import { Toaster } from './toaster'
import { Topbar } from './topbar'

/** 사용 분석(/log)에 남길 탭 이름 — 주소에서 /xtool-tech를 뗀 것(개요는 overview, 보드는 boards/{slug}). */
const usageView = (pathname: string) => pathname.slice(XT_BASE.length).replace(/^\/+|\/+$/g, '') || 'overview'

/** 지금 보는 화면을 사용 분석으로 보낸다 — 로그인 확인이 끝난(권한 있는) 화면 안에서만 그려서,
 * 로그인 확인 중·권한 없음 화면은 세지 않는다. */
function UsageTracking({ pathname }: { pathname: string }) {
  useUsageTracking('tech', usageView(pathname))
  return null
}

/**
 * 사이드바는 화면에 붙어 있고(sticky) 오른쪽 본문만 스크롤된다 — 샘플 영상과 같은 구조.
 * 기술팀 권한이 있는 사람만 들어온다 — 로그인 전이면 로그인 화면으로, 권한이 빠졌으면(정지·삭제)
 * 로그아웃시키고 이유를 들고 로그인 화면으로 보낸다.
 */
export function AppLayout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const session = useXtoolSession('tech')
  const previousRef = useRef<XtoolSession['status']>('loading')
  const [collapsed, toggleSidebar] = useSidebarCollapsed()
  const { structure, design } = useLayoutKind()

  // 로그인 화면은 lazy라 받는 동안 이 화면이 남아 있다 — 그 사이 상태가 한 번 더 바뀌어도
  // (권한 없음 → 로그아웃) 처음 보낸 안내가 덮이지 않게, 이동은 여기 한 곳에서 이전 상태를 보고 한다.
  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = session.status
    const toLogin = (notice?: string) =>
      navigate(xtPath('/login'), { replace: true, state: (notice ? { notice } : null) satisfies LoginLocationState | null })
    if (session.status === 'denied' && session.reason === 'password-setup') {
      // 임시 비밀번호로 들어온 사람 — 로그인은 둔 채 로그인 화면에서 비밀번호부터 정하게.
      toLogin()
    } else if (session.status === 'denied') {
      void signOutXtool()
      toLogin(DENIED_MESSAGE[session.reason])
    } else if (session.status === 'signedOut' || session.status === 'unconfigured') {
      if (previous === 'denied') return
      toLogin(previous === 'ready' ? '로그아웃했어요.' : undefined)
    }
  }, [session, navigate])

  // 로그인 확인 중·로그인 화면으로 넘어가는 중 — 배경만 깔아 두어 깜빡임 없이.
  if (session.status !== 'ready') return design === 'water' ? <WaterBackdrop /> : <AppBackground />

  // 설정 > 레이아웃 "물" — 화면 틀(무대·사이드바·상단바)을 물 묶음으로 그린다(물을 고른 사람만 받는다).
  if (design === 'water') {
    return (
      <MemberContext.Provider value={session.member}>
        <UsageTracking pathname={pathname} />
        <WaterShellGate member={session.member} collapsed={collapsed} onToggle={toggleSidebar}>
          {outlet}
        </WaterShellGate>
        <ScrollRestoration />
      </MemberContext.Provider>
    )
  }

  return (
    <MemberContext.Provider value={session.member}>
      <UsageTracking pathname={pathname} />
      <AppBackground />
      <div className={cx('shell', collapsed && 'is-collapsed')}>
        <Sidebar member={session.member} collapsed={collapsed} onToggle={toggleSidebar} />
        <main className="shell__main">
          {/* Monday 표의 보드·내 업무는 상단바가 표 판 안에 들어간다(MondayBoard·MondayMyWork). */}
          {!(structure === 'table' && (pathname.startsWith(xtPath('/boards/')) || pathname.startsWith(MY_WORK_PATH))) && <Topbar />}
          {/* 경로가 바뀌면 새로 그려서 카드들이 차례로 떠오르게 한다(motion.ts 주석 참고). */}
          <motion.div key={pathname} className="page" variants={pageStagger} initial="hidden" animate="show">
            {outlet}
          </motion.div>
        </main>
      </div>
      <Toaster />
      <ScrollRestoration />
    </MemberContext.Provider>
  )
}
