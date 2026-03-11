import './styles.scss'

export const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <h3>ORIGINALS</h3>
            <p>세상에 없던 혁신을 만듭니다</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Company</h4>
              <ul>
                <li>
                  <a href="#about">About Us</a>
                </li>
                <li>
                  <a href="#products">Products</a>
                </li>
                <li>
                  <a href="#contact">Contact</a>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Legal</h4>
              <ul>
                <li>주식회사 오리지널스</li>
                <li>대표자: 황정현</li>
                <li>사업자: 283-86-03872</li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Location</h4>
              <ul>
                <li>제주특별자치도 서귀포시</li>
                <li>서호중앙로 55</li>
                <li>유포리아 지식산업센터 비동 721호</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2024 Originals Inc. All rights reserved.</p>
          <p>
            Inspired by Adam Grant's "Originals" - Creating unprecedented
            innovations
          </p>
        </div>
      </div>
    </footer>
  )
}
