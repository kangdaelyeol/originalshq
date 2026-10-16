import { Link } from 'react-router-dom'
import { LogoGroup } from '@/illustrations'
import { useHero } from '@/screens/home/controller'
import '@/screens/home/styles/hero.scss'
import LogoText from '@/assets/originals_logo_text.svg'

// 큰 제목 — 단어마다 나눠서 차례로 올라오게 한다. accent는 브랜드 색 강조.
const HEADLINE: { text: string; accent?: boolean }[][] = [
  [{ text: '세상에' }, { text: '없던' }],
  [{ text: '미래를', accent: true }, { text: '만듭니다' }],
]

/**
 * 첫 화면.
 *
 * 처음 들어오면 한 번만 차례로 나타나고(소식 띠 → 로고 → 제목 단어들 → 설명 →
 * 버튼) 멈춘다. 그 뒤로는 사용자가 움직일 때만 반응한다 — 마우스를 따라 로고가
 * 기울고 배경 빛과 별자리가 반응하며, 아래로 스크롤하면 내용이 작아지며
 * 흐려진다(use-hero.ts). 스스로 반복하는 애니메이션은 없다.
 */
export const Hero = () => {
  const { heroRef, canvasRef } = useHero()
  let wordIndex = 0

  return (
    <section className="hero" id="home" ref={heroRef}>
      {/* 배경 — 브랜드 색 빛(오로라)과 별자리. 꾸밈이라 읽기 도구에서는 숨긴다. */}
      <div className="hero__aurora" aria-hidden="true">
        <span className="glow glow--lilac" />
        <span className="glow glow--violet" />
        <span className="glow glow--navy" />
      </div>
      <canvas className="hero__stars" ref={canvasRef} aria-hidden="true" />

      <div className="hero__content">
        <Link to="/parke" className="hero__news">
          <span className="tag">NEW</span>
          <span>파르케 사전 예약 중</span>
          <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </Link>

        <div className="hero__logo">
          <LogoGroup size={96} />
          <img src={LogoText} className="logo-text" alt="Originals" />
        </div>

        <h1 className="hero__headline">
          {HEADLINE.map((line, lineIndex) => (
            <span className="line" key={lineIndex}>
              {line.map((word) => (
                <span
                  key={word.text}
                  className={['word', word.accent ? 'accent' : '']
                    .join(' ')
                    .trim()}
                  // 단어마다 조금씩 늦게 — 순서는 CSS 변수로 넘긴다.
                  style={{ '--i': wordIndex++ } as React.CSSProperties}
                >
                  {word.text}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <div className="hero__cta">
          <a href="#products" className="btn btn-primary">
            <span>Explore Products</span>
            <i className="fas fa-arrow-right"></i>
          </a>
          <a href="#about" className="btn btn-secondary">
            <span>Learn More</span>
          </a>
        </div>

        <p className="hero__inspired">Inspired by Adam Grant's Originals</p>
      </div>

      <a href="#about" className="hero__scroll" aria-label="아래로 스크롤">
        <span>Scroll</span>
        <i className="fas fa-chevron-down" aria-hidden="true"></i>
      </a>
    </section>
  )
}
