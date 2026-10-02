import { Lock, ShieldCheck } from 'lucide-react'

export const Benefits = () => {
  return (
    <section className="pf-benefits">
      <article>
        <ShieldCheck />
        <p className="pf-eyebrow">PRIVATE BY DESIGN</p>
        <h2>
          내 번호는 숨기고.
          <br />
          연락은 이어지게.
        </h2>
        <span className="pf-benefit-value">안심번호</span>
        <p>
          실제 휴대폰 번호를 번호판에 노출하지 않는
          <br />
          안심번호 기반 주차 연락.
        </p>
      </article>
      <article>
        <Lock />
        <p className="pf-eyebrow">NO SERVER FEE</p>
        <h2>
          매달 더해지는
          <br />
          서버 비용 없이.
        </h2>
        <span className="pf-benefit-value">
          0<span>원</span>
        </span>
        <p>
          서버 이용료 무료.
          <br />
          제품의 기본 연락 서비스를 가볍게.
        </p>
      </article>
    </section>
  )
}
