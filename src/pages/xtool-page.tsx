import { Outlet } from 'react-router-dom'
import { useGlassTheme } from '@/components/glass'
import { Footer, Header } from '@/screens/xtool-lead-manager/components'
import { usePageTabViewModel } from '@/screens/xtool-lead-manager/view-model'
import './xtool-global.scss'

export const XtoolPage = () => {
  const { state, actions } = usePageTabViewModel()
  // 테마 — 이 브라우저에 남긴다(<html data-glass-theme>, 바탕색은 그 테마).
  const [theme, setTheme] = useGlassTheme('xtool.theme')

  return (
    <div className="xtool-lead-manager">
      <Header
        tab={state.tab}
        onSelectTab={actions.selectTab}
        theme={theme}
        onSelectTheme={setTheme}
      />
      <Outlet />
      <Footer />
    </div>
  )
}
