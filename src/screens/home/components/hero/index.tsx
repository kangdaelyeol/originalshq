import { useCallback, useEffect, useRef } from 'react'
import './styles.scss'

export const Hero = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    containerRef.current.style.opacity = String((600 - scrollY) / 600)
    containerRef.current.style.transform = `translateY(${scrollY * 0.3}px)`
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  return (
    <section className="hero" id="home" ref={containerRef}>
      <div className="hero-background">
        <div className="gradient-overlay"></div>
        <div className="grid-overlay"></div>
      </div>

      <div className="container">
        <div className="hero-content">
          <div className="hero-badge fade-in">
            <i className="fas fa-rocket"></i>
            <span>Inspired by Adam Grant's Originals</span>
          </div>

          <h1 className="hero-title fade-in-up">
            We Are <span className="gradient-text">Originals</span>
          </h1>

          <p className="hero-subtitle fade-in-up delay-1">
            AI 기반 혁신 하드웨어로 세상에 없던 미래를 만듭니다
          </p>

          <div className="hero-description fade-in-up delay-2">
            <p>
              젊고 활기찬 아이디어로, 일상의 불편함을 혁신적 제품으로
              해결합니다.
            </p>
          </div>

          <div className="hero-cta fade-in-up delay-3">
            <a href="#products" className="btn btn-primary">
              <span>Explore Products</span>
              <i className="fas fa-arrow-right"></i>
            </a>
            <a href="#about" className="btn btn-secondary">
              <span>Learn More</span>
            </a>
          </div>

          <div className="hero-stats fade-in-up delay-4">
            <div className="stat-item">
              <div className="stat-number">01</div>
              <div className="stat-label">제품 출시</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">02</div>
              <div className="stat-label">개발중</div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number">∞</div>
              <div className="stat-label">혁신 진행중</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
