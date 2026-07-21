import { Footer, Header } from '@/screens/xtool-lead-manager/components'
import { Outlet } from 'react-router-dom'
import './xtool-global.scss'

export const XtoolPage = () => {
  return (
    <div className="xtool-lead-manager">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
