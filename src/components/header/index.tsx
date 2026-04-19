import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import { useScroll } from '@/hooks/use-scroll'
import './styles.scss'

const navMenuList = [
  { to: '/#home', label: 'Home' },
  { to: '/#about', label: 'About' },
  { to: '/#products', label: 'Products' },
  { to: '/#contact', label: 'Contact' },
]

export const Header = () => {
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

  return (
    <nav className={['navbar', scrolled && 'scrolled'].join(' ')} id="navbar">
      <div className="container">
        <div className="nav-wrapper">
          <div className="logo">
            <a href="/#home">
              <span className="logo-text">ORIGINALS</span>
            </a>
          </div>

          <div
            ref={menuRef}
            className={['nav-menu', isMenuOpen && 'active'].join(' ')}
            id="navMenu"
          >
            {navMenuList.map((config) => (
              <HashLink
                key={config.label}
                className="nav-link"
                to={config.to as string}
              >
                {config.label}
              </HashLink>
            ))}
            <Link className="nav-link" to="/privacy">
              Privacy
            </Link>
          </div>

          <div
            className={['hamburger', isMenuOpen && 'active'].join(' ')}
            id="hamburger"
            ref={hamburgerRef}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </nav>
  )
}
