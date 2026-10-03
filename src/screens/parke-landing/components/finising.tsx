import { ParkeEngraving } from './parke-engraving'

export const Finishing = () => {
  return (
    <>
      <section id="package" className="pf-package pf-photo-panel">
        <img
          src="/images/brand/package.webp"
          alt="파르케 본체를 담은 프리미엄 패키지 디자인 시안"
          width={1672}
          height={941}
          loading="lazy"
        />
        <div className="pf-photo-copy">
          <p className="pf-eyebrow">THE FIRST IMPRESSION</p>
          <h2>
            열어보는 순간부터.
            <br />
            파르케답게.
          </h2>
          <p>
            제품을 위한 패키지.
            <br />
            소중한 사람의 차를 위한 선물.
          </p>
        </div>
      </section>
      <ParkeEngraving />
    </>
  )
}
