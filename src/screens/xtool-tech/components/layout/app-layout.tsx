import { motion } from 'motion/react'
import { ScrollRestoration, useLocation, useOutlet } from 'react-router-dom'
import { pageStagger } from '../../lib/motion'
import { AppBackground } from './app-background'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

/** 사이드바는 화면에 붙어 있고(sticky) 오른쪽 본문만 스크롤된다 — 샘플 영상과 같은 구조. */
export function AppLayout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  return (
    <>
      <AppBackground />
      <div className="shell">
        <Sidebar />
        <main className="shell__main">
          <Topbar />
          {/* 경로가 바뀌면 새로 그려서 카드들이 차례로 떠오르게 한다(motion.ts 주석 참고). */}
          <motion.div key={pathname} className="page" variants={pageStagger} initial="hidden" animate="show">
            {outlet}
          </motion.div>
        </main>
      </div>
      <ScrollRestoration />
    </>
  )
}
