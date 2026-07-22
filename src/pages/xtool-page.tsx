import { Footer, Header } from '@/screens/xtool-lead-manager/components'
import { Outlet } from 'react-router-dom'
import './xtool-global.scss'
import { useEffect } from 'react'

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
