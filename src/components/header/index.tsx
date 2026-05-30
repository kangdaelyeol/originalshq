import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import { useScroll } from '@/hooks/use-scroll'
import LogoIcon from '@/assets/originals_logo.svg'
import './styles.scss'
import { ArrowRight } from '@/illustrations'

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
    <section className={['header', 'navbar', scrolled && 'scrolled'].join(' ')}>
      <div className="container">
        <div className="wrapper">
          <a href="/#home">
            <img src={LogoIcon} alt="logo icon" />
          </a>

          <div
            ref={menuRef}
            className={['nav', isMenuOpen && 'active'].join(' ')}
          >
            {navMenuList.map((config) => (
              <HashLink
                key={config.label}
                className="link"
                to={config.to as string}
              >
                {config.label}
              </HashLink>
            ))}
            <Link className="link" to="/privacy">
              Privacy
            </Link>
          </div>

          <div
            className={['hamburger', isMenuOpen && 'active'].join(' ')}
            ref={hamburgerRef}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className={['hamburger__nav', isMenuOpen && 'active'].join(' ')}>
            {navMenuList.map((config) => (
              <HashLink
                key={config.label}
                to={config.to}
                className="hamburger__link"
              >
                {config.label}
                <ArrowRight size={25} color={'#555'} className="icon" />
              </HashLink>
            ))}
            <Link className="hamburger__link" to="/privacy">
              Privacy
              <ArrowRight size={25} color={'#555'} className="icon" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
