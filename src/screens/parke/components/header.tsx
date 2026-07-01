import '@/screens/parke/parke.scss'

export const Header = () => {
  return (
    <div className="header-wrapper">
      <div className="eyebrow">Admin / QR generator</div>
      <h1>QR 코드 콘솔</h1>
      <p className="sub">
        URL을 입력하면 QR 코드와 고유 시리얼 번호를 생성합니다.
      </p>
    </div>
  )
}
