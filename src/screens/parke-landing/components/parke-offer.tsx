import {
  ArrowUpRight,
  Gift,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

export default function ParkeOffer({ onReserve }: { onReserve: () => void }) {
  return (
    <section className="pf-price pf-package-offer" id="reserve">
      <p className="pf-eyebrow">Parké FAMILY PACKAGE</p>
      <h2>
        본체부터 무료 앱까지.
        <br />한 번에, 파르케.
      </h2>
      <p className="pf-offer-intro">
        가족이 함께 쓰는 주차번호판.
        <br />
        매달 서버 비용을 더할 필요 없이.
      </p>
      <figure className="pf-offer-visual">
        <img
          src="/images/premium-v27/package-offer.webp"
          alt="파르케 본체와 전용 패키지, 설치 안내서를 함께 배치한 패키지 이미지"
          width={1536}
          height={1024}
          loading="lazy"
        />
        <figcaption>Parké 본체 + 전용 패키지</figcaption>
      </figure>
      <div className="pf-price-details">
        <p className="pf-included-heading">이 모든 것을 함께.</p>
        <ul className="pf-offer-includes">
          <li>
            <Gift />
            <div>
              <strong>본체 + 전용 패키지</strong>
              <span>선물하기에도 좋은 구성</span>
            </div>
          </li>
          <li>
            <Smartphone />
            <div>
              <strong>파르케 앱 무료</strong>
              <span>다운로드·기본 이용 0원</span>
            </div>
          </li>
          <li>
            <ShieldCheck />
            <div>
              <strong>안심번호 연락 포함</strong>
              <span>개인번호를 드러내지 않게</span>
            </div>
          </li>
          <li>
            <LockKeyhole />
            <div>
              <strong>서버 이용료 무료</strong>
              <span>기본 서버 이용료 0원</span>
            </div>
          </li>
        </ul>
        <div className="pf-offer-price-block">
          <span className="pf-offer-product">파르케 가족 공유형</span>
          <div className="pf-offer-was">
            <span>정상가</span>
            <del>89,000원</del>
            <span className="pf-offer-saving">30,000원 혜택</span>
          </div>
          <div className="pf-offer-now">
            <span>예약 혜택가</span>
            <strong>
              59,000<span>원</span>
            </strong>
          </div>
          <p>
            앱을 열지 않아도 자동 전환.
            <br />
            편리함은 매일, 서버 이용료는 0원.
          </p>
        </div>
        <button className="pf-primary" onClick={onReserve}>
          지금 바로 예약하기
          <ArrowUpRight size={22} />
        </button>
        <p className="pf-price-note">
          결제 없는 사전 예약 · 배송 일정은 추후 안내
          <br />
          커스텀 각인 서비스는 선택 옵션입니다.
        </p>
      </div>
    </section>
  )
}
