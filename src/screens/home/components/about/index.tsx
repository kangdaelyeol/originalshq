import { useEffect, useRef } from 'react'
import './styles.scss'
import { useRevealContext } from '@/context/reveal-context'

export const About = () => {
  const aboutCard1Ref = useRef<HTMLDivElement>(null)
  const aboutCard2Ref = useRef<HTMLDivElement>(null)
  const aboutCard3Ref = useRef<HTMLDivElement>(null)
  const aboutCard4Ref = useRef<HTMLDivElement>(null)
  const { pushRevealRef } = useRevealContext()
  useEffect(() => {
    if (
      aboutCard1Ref.current !== null &&
      aboutCard2Ref.current !== null &&
      aboutCard3Ref.current !== null &&
      aboutCard4Ref.current !== null
    ) {
      pushRevealRef(aboutCard1Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(aboutCard2Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(aboutCard3Ref as React.RefObject<HTMLDivElement>)
      pushRevealRef(aboutCard4Ref as React.RefObject<HTMLDivElement>)
    }
  }, [pushRevealRef])
  return (
    <section className="about" id="about">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">ABOUT US</span>
          <h2 className="section-title">
            세상에 없던 <span className="gradient-text">아이디어</span>를<br />
            실현하는 기업
          </h2>
        </div>

        <div className="about-grid">
          <div className="about-card reveal" ref={aboutCard1Ref}>
            <div className="about-icon">
              <i className="fas fa-lightbulb"></i>
            </div>
            <h3>Innovation First</h3>
            <p>
              애덤 그랜트의 'Originals'에서 영감을 받아, 기존의 틀을 깨고 진정한
              혁신을 추구합니다.
            </p>
          </div>

          <div className="about-card reveal delay-1" ref={aboutCard2Ref}>
            <div className="about-icon">
              <i className="fas fa-robot"></i>
            </div>
            <h3>AI-Powered Hardware</h3>
            <p>
              인공지능 기술을 하드웨어와 결합하여 일상의 불편함을 해결하는
              제품을 만듭니다.
            </p>
          </div>

          <div className="about-card reveal delay-2" ref={aboutCard3Ref}>
            <div className="about-icon">
              <i className="fas fa-users"></i>
            </div>
            <h3>Young & Dynamic</h3>
            <p>
              젊고 활기찬 팀이 끊임없이 도전하며, 불가능을 가능으로
              만들어갑니다.
            </p>
          </div>
        </div>

        <div className="vision-statement reveal" ref={aboutCard4Ref}>
          <div className="vision-icon">
            <i className="fas fa-quote-left"></i>
          </div>
          <blockquote>
            "세상에 없던 것을 만들어내는 것. 그것이 우리가 존재하는 이유입니다."
          </blockquote>
          <div className="vision-author">- Originals Team</div>
        </div>
      </div>
    </section>
  )
}
