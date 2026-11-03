import { MotionConfig } from 'motion/react'
import { Outlet } from 'react-router-dom'
import faviconUrl from './assets/symbols/favicon-64.png'
import { PeriodProvider } from './context/period-provider'
import { useDocumentHead } from './lib/use-document-head'
import { SettingsProvider } from './settings/settings-provider'
import './styles/index.scss'

/** /xtool-tech 아래 모든 화면(로그인 포함)의 바깥 — 설정·기간 상태와 루트 요소(.xtool-tech). */
export function XtoolTechRoot() {
  // 탭 제목·아이콘(앱 아이콘의 X) — 이 화면에 있는 동안만
  useDocumentHead('엑스툴 기술팀 | xtool-tech', faviconUrl)
  return (
    // 운영체제에서 "동작 줄이기"를 켠 사람에게는 등장·hover 애니메이션을 끈다.
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <PeriodProvider>
          <Outlet />
        </PeriodProvider>
      </SettingsProvider>
    </MotionConfig>
  )
}
