import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export const useScrollToTop = () => {
  const navType = useNavigationType()
  const { pathname } = useLocation()
  
  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
    }
  }, [navType, pathname])
}
