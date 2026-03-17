import { useCallback, useEffect, useRef } from 'react'
import './styles.scss'
export const BackToTopButton = () => {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const handleScroll = useCallback(() => {
    if (!btnRef.current) return
    if (scrollY > 500) btnRef.current.classList.add('visible')
    else btnRef.current.classList.remove('visible')
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="back-to-top"
      id="backToTop"
      ref={btnRef}
    >
      <i className="fas fa-arrow-up"></i>
    </button>
  )
}
