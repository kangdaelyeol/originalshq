import '@/screens/parke/styles/header.scss'
import AppIcon from '@/assets/parke-icon.png'
import { LogoText } from './logo-text'

export const Header = () => {
  return (
    <div className="header-wrapper">
      <div className="title-box">
        <LogoText /> -
        <div className="app-icon">
          <img src={AppIcon} alt="app icon" />
        </div>
      </div>
      <div className="caption-box">
        <div className="caption"> Admin / QR Generator</div>
      </div>
    </div>
  )
}
