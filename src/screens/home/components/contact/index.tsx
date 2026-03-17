import { useEffect, useRef } from 'react'
import './styles.scss'
import { useRevealContext } from '@/context/reveal-context'

export const Contact = () => {
  const card1Ref = useRef<HTMLDivElement>(null)
  const card2Ref = useRef<HTMLDivElement>(null)
  const { pushRevealRef } = useRevealContext()
  useEffect(() => {
    if (card1Ref.current !== null && card2Ref.current !== null) {
      pushRevealRef(card1Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(card2Ref as React.RefObject<HTMLDivElement>)
    }
  }, [pushRevealRef])
  return (
    <section className="contact" id="contact">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">CONTACT US</span>
          <h2 className="section-title">
            함께 <span className="gradient-text">혁신</span>을<br />
            만들어가실 준비가 되셨나요?
          </h2>
        </div>

        <div className="contact-grid">
          <div className="contact-info reveal" ref={card1Ref}>
            <div className="contact-item">
              <div className="contact-icon">
                <i className="fas fa-building"></i>
              </div>
              <div className="contact-details">
                <h4>회사명</h4>
                <p>
                  주식회사 오리지널스
                  <br />
                  Originals Inc.
                </p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <i className="fas fa-user-tie"></i>
              </div>
              <div className="contact-details">
                <h4>대표자</h4>
                <p>황정현</p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <i className="fas fa-map-marker-alt"></i>
              </div>
              <div className="contact-details">
                <h4>주소</h4>
                <p>
                  제주특별자치도 서귀포시 서호중앙로 55
                  <br />
                  유포리아 지식산업센터 비동 721호
                </p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <i className="fas fa-id-card"></i>
              </div>
              <div className="contact-details">
                <h4>사업자등록번호</h4>
                <p>283-86-03872</p>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-icon">
                <i className="fas fa-globe"></i>
              </div>
              <div className="contact-details">
                <h4>Website</h4>
                <p>
                  <a href="https://www.originalshq.com" target="_blank">
                    www.originalshq.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="contact-map reveal delay-1" ref={card2Ref}>
            <div className="map-placeholder">
              <i className="fas fa-map-marked-alt"></i>
              <p>제주특별자치도 서귀포시</p>
              <span>유포리아 지식산업센터</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
