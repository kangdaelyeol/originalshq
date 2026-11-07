import { Outlet } from 'react-router-dom'
import { useGlassTheme } from '@/components/glass'
import {
  Footer,
  focusSegment,
  Header,
  LoginPage,
  moveSegmentSideways,
} from '@/screens/xtool-lead-manager/components'
import { usePageTabViewModel } from '@/screens/xtool-lead-manager/view-model'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import { useXtoolSession } from '@/xtool-auth/use-xtool-session'
import './xtool-global.scss'

/** /xtool-lead-manager — 가입한 사람(xtool 구성원, 관리자가 아니어도)만 본다.
 * 로그인 전에는 같은 테마의 로그인 화면. functions-xtool도 요청마다 같은 기준으로
 * 다시 확인한다(admin-auth.ts checkMember). */
export const XtoolPage = () => {
  const { state, actions } = usePageTabViewModel()
  // 테마 — 이 브라우저에 남긴다(<html data-glass-theme>, 바탕색은 그 테마).
  const [theme, setTheme] = useGlassTheme('xtool.theme')
  const session = useXtoolSession('member')

  if (session.status !== 'ready') {
    return (
      <div className="xtool-lead-manager glass_root">
        <LoginPage session={session} theme={theme} onSelectTheme={setTheme} />
      </div>
    )
  }

  // 버튼 묶음(맨 위 탭·각 탭의 메뉴·카드 머리·모달)은 누르면 초점이 가고 좌/우
  // 방향키로 옆 버튼을 고른다 — 화면 전체에 한 번만 붙인다.
  return (
    <div
      className="xtool-lead-manager glass_root"
      onClick={focusSegment}
      onKeyDown={moveSegmentSideways}
    >
      <Header
        tab={state.tab}
        onSelectTab={actions.selectTab}
        theme={theme}
        onSelectTheme={setTheme}
        account={session.member}
        onSignOut={() => void signOutXtool()}
      />
      <Outlet />
      <Footer />
    </div>
  )
}
