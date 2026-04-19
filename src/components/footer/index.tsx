import { Link } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
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

          <div className="footer-right">
            <div className="right-top">
              <Link to={'/privacy'}>개인정보처리방침</Link>
              <div className="divider" />
              <Link to={'/privacy'}>이용약관</Link>
            </div>

            <div className="footer-links">
              <div className="footer-column">
                <h4>Company</h4>
                <ul>
                  <li>
                    <HashLink to="/#about">About Us</HashLink>
                  </li>
                  <li>
                    <HashLink to="/#products">Products</HashLink>
                  </li>
                  <li>
                    <HashLink to="/#contact">Contact</HashLink>
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
