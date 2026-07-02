import { useScroll } from '@/hooks'
import { useEffect, useRef, useState } from 'react'

export const useHeader = () => {
  const [scrolled, setScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMenuOpen &&
        !menuRef.current?.contains(e.target as Node) &&
        !hamburgerRef.current?.contains(e.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isMenuOpen])

  useScroll({
    listener: () => {
      if (scrollY > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    },
    wait: 100,
  })
  return {menuRef, isMenuOpen, scrolled, setIsMenuOpen, hamburgerRef}
}
