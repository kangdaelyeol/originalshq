import { useEffect, useRef } from 'react'
import './styles.scss'
import { useRevealContext } from '../../context/reveal-context'

export const Products = () => {
  const card1Ref = useRef<HTMLDivElement>(null)
  const card2Ref = useRef<HTMLDivElement>(null)
  const card3Ref = useRef<HTMLDivElement>(null)
  const { pushRevealRef } = useRevealContext()
  useEffect(() => {
    if (
      card1Ref.current !== null &&
      card2Ref.current !== null &&
      card3Ref.current !== null
    ) {
      pushRevealRef(card1Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(card2Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(card3Ref as React.RefObject<HTMLDivElement>)
    }
  }, [pushRevealRef])

  return (
    <section className="products" id="products">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">OUR PRODUCTS</span>
          <h2 className="section-title">
            혁신적인 <span className="gradient-text">제품</span>으로
            <br />
            세상을 변화시킵니다
          </h2>
        </div>

        <div className="products-grid">
          <div className="product-card featured reveal" ref={card1Ref}>
            <div className="product-badge">
              <i className="fas fa-check-circle"></i>
              <span>출시 완료</span>
            </div>

            <div className="product-icon">
              <i className="fas fa-qrcode"></i>
            </div>

            <div className="product-content">
              <h3 className="product-title">QR 자동전환형 차량 전화번호판</h3>
              <p className="product-description">
                기존 종이·플라스틱 전화번호판의 불편함을 QR코드 자동전환
                방식으로 완전히 혁신했습니다. 차량 대시보드 위에 올려두는
                스마트한 솔루션으로, 첫 번째 출시 제품입니다.
              </p>

              <div className="product-features">
                <div className="feature-item">
                  <i className="fas fa-mobile-alt"></i>
                  <span>QR 스캔으로 즉시 연락</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-shield-alt"></i>
                  <span>개인정보 보호</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-sync-alt"></i>
                  <span>번호 자동 전환</span>
                </div>
              </div>
            </div>
          </div>

          <div className="product-card reveal delay-1" ref={card2Ref}>
            <div className="product-badge in-dev">
              <i className="fas fa-cog fa-spin"></i>
              <span>개발중</span>
            </div>

            <div className="product-icon">
              <i className="fas fa-water"></i>
            </div>

            <div className="product-content">
              <h3 className="product-title">AI 기반 웻수트</h3>
              <p className="product-description">
                인공지능 기술이 접목된 차세대 웻수트입니다. 수온, 체온, 활동량을
                실시간으로 분석하여 최적의 수중 활동을 지원합니다.
              </p>

              <div className="product-features">
                <div className="feature-item">
                  <i className="fas fa-brain"></i>
                  <span>AI 온도 조절</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-heartbeat"></i>
                  <span>실시간 모니터링</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-chart-line"></i>
                  <span>데이터 분석</span>
                </div>
              </div>
            </div>
          </div>

          <div className="product-card reveal delay-2" ref={card3Ref}>
            <div className="product-badge in-dev">
              <i className="fas fa-cog fa-spin"></i>
              <span>개발중</span>
            </div>

            <div className="product-icon">
              <i className="fas fa-mountain"></i>
            </div>

            <div className="product-content">
              <h3 className="product-title">생존 시그널라인 아웃도어 자켓</h3>
              <p className="product-description">
                위급 상황에서 생존 신호를 발신하는 기능이 내장된 혁신적인
                아웃도어 자켓입니다. 안전과 스타일을 동시에 추구하는 차세대
                아웃도어 웨어입니다.
              </p>

              <div className="product-features">
                <div className="feature-item">
                  <i className="fas fa-satellite-dish"></i>
                  <span>긴급 신호 발신</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-map-marked-alt"></i>
                  <span>GPS 위치 추적</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-shield-alt"></i>
                  <span>생존 기능 통합</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
