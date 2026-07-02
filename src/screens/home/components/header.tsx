import { Link } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import LogoSymbol from '@/assets/logo_symbol.svg'
import LogoCaption from '@/assets/logo_caption.svg'
import LogoText from '@/assets/logo_text.svg'
import { ArrowRight } from '@/illustrations'
import { useHeader } from '@/screens/home/controller'
import '@/screens/home/styles/header.scss'

const navMenuList = [
  { to: '/#home', label: 'Home' },
  { to: '/#about', label: 'About' },
  { to: '/#products', label: 'Products' },
  { to: '/#contact', label: 'Contact' },
]

export const Header = () => {
  const { menuRef, isMenuOpen, scrolled, setIsMenuOpen, hamburgerRef } =
    useHeader()

  return (
    <section className={['header', 'navbar', scrolled && 'scrolled'].join(' ')}>
      <div className="container">
        <div className="wrapper">
          <a className="logo__container" href="/#home">
            <img src={LogoSymbol} className="logo-symbol" alt="logo icon" />
            <div className="text__container">
              <img src={LogoCaption} className="logo-caption" alt="logotext" />
              <img src={LogoText} className="logo-text" alt="logotext" />
            </div>
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
