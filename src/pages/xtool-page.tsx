import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Footer, Header } from '@/screens/xtool-lead-manager/components'
import './xtool-global.scss'

export const XtoolPage = () => {
  useEffect(() => {
    document.body.style.backgroundColor = '#292f4c'
  }, [])
  return (
    <div className="xtool-lead-manager">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
