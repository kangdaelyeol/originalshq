import '@/screens/xtool-lead-manager/styles/header.scss'

export const Header = () => {
  return (
    <div className="xtool-header">
      <div className="wrapper">
        <div className="title-box">
          <img
            src="https://www.xtool.co.kr/web/upload/goodymall/kr/main/LOGO_1.png"
            alt="xtool logo"
            className="xtool-logo"
          />
          <span className="title">Lead manager</span>
        </div>
        <img
          src="https://framerusercontent.com/images/tuTnWS8IWm4eabExSlzNTTtkeQk.png"
          alt="enterprise logo"
          className="enterprise-logo"
        />
      </div>
    </div>
  )
}
