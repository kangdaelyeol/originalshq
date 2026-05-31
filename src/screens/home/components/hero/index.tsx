import './styles.scss'
import { LogoGroup } from '@/illustrations'

export const Hero = () => {
  return (
    <section className="hero" id="home">
      <div className="container">
        <div className="hero__content">
          <div className="badge fade-in">
            <span>Inspired by Adam Grant's Originals</span>
          </div>

          <LogoGroup size={100} />

          <h1 className="title fade-in-up">We Are Originals</h1>

          <p className="subtitle fade-in-up delay-1">
            AI 기반 혁신 하드웨어로 세상에 없던 미래를 만듭니다
          </p>

          <div className="cta fade-in-up delay-3">
            <a href="#products" className="btn btn-primary">
              <span>Explore Products</span>
              <i className="fas fa-arrow-right"></i>
            </a>
            <a href="#about" className="btn btn-secondary">
              <span>Learn More</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
