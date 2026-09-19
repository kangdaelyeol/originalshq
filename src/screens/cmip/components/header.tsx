import '../styles/header.scss'

export const Header = () => {
  return (
    <div className="cmip-header">
      <div className="cmip-header__brand">
        <div className="cmip-header__logo-badge">
          <img
            src="https://framerusercontent.com/images/tuTnWS8IWm4eabExSlzNTTtkeQk.png"
            alt="CYANINT"
            className="cmip-header__logo"
          />
        </div>
        <div className="cmip-header__titles">
          <span className="cmip-header__title">CMIP</span>
          <span className="cmip-header__subtitle">
            Cyan International Marketing Intelligence &amp; Platform
          </span>
        </div>
      </div>
    </div>
  )
}
