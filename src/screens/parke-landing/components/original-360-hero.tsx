import { AMBIENT_HEIGHT, AMBIENT_WIDTH, useHeroViewModel } from '../view-model'
import { HERO_COPY } from '../config'

/** Markup only — the scroll sequence, copy timing and intro live in
 * useHeroViewModel. */
export const Original360Hero = ({ still }: { still: boolean }) => {
  const { sectionRef, canvasRef, ambientRef, posterRef, bindCopy } =
    useHeroViewModel(still)

  return (
    <>
      {!still && (
        <>
          <link
            rel="preload"
            as="fetch"
            href="/media/parke-scroll-v28/mobile/00.webp"
            media="(max-width:700px)"
          />
          <link
            rel="preload"
            as="fetch"
            href="/media/parke-scroll-v28/desktop/00.webp"
            media="(min-width:701px)"
          />
        </>
      )}
      <section
        id="top"
        ref={sectionRef}
        className={`pf-original-hero pf-scroll pf-source-film pf-continuous-landing pf-video-hero pf-motion-stable ${still ? 'is-still' : ''}`}
        aria-label="Parké 제품 인트로, 한 바퀴 회전과 대시보드 장면"
      >
        <div
          className="pf-pin"
          data-renderer={still ? 'brand-still' : 'sprite-loading'}
        >
          {!still && (
            <canvas
              ref={ambientRef}
              className="pf-world-ambient"
              aria-hidden="true"
              width={AMBIENT_WIDTH}
              height={AMBIENT_HEIGHT}
            />
          )}
          <div className="pf-render-world" aria-hidden="true">
            <img
              ref={posterRef}
              className="pf-world-poster"
              fetchPriority="high"
              decoding="async"
              src={
                still
                  ? '/images/brand/product-studio.webp'
                  : '/images/brand/intro-poster.jpg'
              }
              width={1672}
              height={941}
              alt=""
            />
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              style={{ opacity: 0 }}
            />
          </div>
          <div className="pf-original-shade" />
          <h1 className="sr-only">
            Parké 파르케 — 앱을 열지 않아도 연락 대상이 바뀌는 자동 주차번호판.
          </h1>
          {HERO_COPY.map((cue, index) => (
            <div
              ref={bindCopy(index)}
              className="pf-original-copy"
              key={cue.label}
              aria-hidden={cue.enter !== null}
              style={{ opacity: cue.enter === null ? 1 : 0 }}
            >
              <p className="pf-eyebrow">{cue.label}</p>
              <h2>
                {cue.heading[0]}
                <br />
                {cue.heading[1]}
              </h2>
              <p className="pf-hero-explain">{cue.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
