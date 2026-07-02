import { LogoGroup } from '@/illustrations'
import '@/screens/home/styles/hero.scss'

export const Hero = () => {
  return (
    <section className="hero" id="home">
      <div className="hero__content">
        <div className="badge fade-in">
          <span>Inspired by Adam Grant's Originals</span>
        </div>

        <div className="logo__box">
          <LogoGroup size={100} />
        </div>

        <h1 className="title fade-in-up">Originals</h1>

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
    </section>
  )
}
