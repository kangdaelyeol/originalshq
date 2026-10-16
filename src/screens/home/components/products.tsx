import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useRevealContext } from '@/context/reveal-context'
import '@/screens/home/styles/products.scss'

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
            {/* 판매 전 사전 예약 단계라 "출시 완료"가 아니라 "사전 예약 중". */}
            <div className="product-badge">
              <i className="fas fa-check-circle"></i>
              <span>사전 예약 중</span>
            </div>

            <div className="product-icon">
              <i className="fas fa-qrcode"></i>
            </div>

            {/* 문구는 Parke 제품 페이지(/parke)와 같은 내용으로 맞췄다 — 운전자를
                인식해 연락 대상을 바꾸는 것이 핵심이고, 안심번호(번호 가림)는
                제공하지 않으므로 "개인정보 보호"는 넣지 않는다. */}
            <div className="product-content">
              <h3 className="product-title">파르케 · 운전자 인식 주차번호판</h3>
              <p className="product-description">
                등록된 운전자를 블루투스로 인식해, 지금 차를 운전하는 사람에게
                주차 연락이 가도록 연락 대상을 자동으로 바꿉니다. 대시보드에
                올려두는 QR 하나로, 차를 함께 쓰는 가족 누구나 바로 연락받을 수
                있습니다.
              </p>

              <div className="product-features">
                <div className="feature-item">
                  <i className="fas fa-mobile-alt"></i>
                  <span>QR 스캔으로 바로 연락</span>
                </div>
                <div className="feature-item">
                  <i className="fab fa-bluetooth-b"></i>
                  <span>운전자 자동 인식</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-sync-alt"></i>
                  <span>연락 대상 자동 전환</span>
                </div>
              </div>

              <Link className="product-link" to="/parke">
                파르케 자세히 보기
                <i className="fas fa-arrow-right"></i>
              </Link>
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
