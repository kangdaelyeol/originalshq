import '@/screens/parke/styles/footer.scss'
import LogoSymbol from '@/assets/logo_symbol.svg'

export const Footer = () => {
  return (
    <div className="footer-wrapper">
      <div className="symbol">
        <img src={LogoSymbol} alt="originals logo" />
      </div>
      <div className="copyright">© 2025 Orginals. All rights reserved.</div>
    </div>
  )
}
