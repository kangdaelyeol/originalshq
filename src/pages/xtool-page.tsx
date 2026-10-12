import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Footer, Header } from '@/screens/xtool-lead-manager/components'
import { usePageTabViewModel } from '@/screens/xtool-lead-manager/view-model'
import './xtool-global.scss'

export const XtoolPage = () => {
  useEffect(() => {
    document.body.style.backgroundColor = '#000000'
  }, [])
  const { state, actions } = usePageTabViewModel()

  return (
    <div className="xtool-lead-manager">
      <Header tab={state.tab} onSelectTab={actions.selectTab} />
      <Outlet />
      <Footer />
    </div>
  )
}
