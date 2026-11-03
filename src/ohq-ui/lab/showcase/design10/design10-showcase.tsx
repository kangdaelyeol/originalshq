import { ShowcaseStage } from '../showcase-stage'
import { BounceBall } from './bounce-ball'
import { D10_CARDS, D10_PART_MORPH, D10_SCRAMBLE_WORD } from './design10-data'
import { MorphShape } from './morph-shape'
import { MotionCard } from './motion-card'
import { SquashStretchBlob } from './squash-stretch-blob'
import { TextScramble } from './text-scramble'

/** Design 10 — sample/design10.mp4: AI 영상용 모션그래픽 카드 네 장(2초마다 함께 되풀이) */
export function Design10Showcase() {
  return (
    <ShowcaseStage
      title="Design 10 — 모션그래픽 카드 네 장"
      note="sample/design10.mp4 · 네 움직임이 영상처럼 2초마다 함께 되풀이돼요(움직임 줄이기 설정이면 멈춰요)"
      className="showcase-stage--d10"
    >
      <div className="d10-scene">
        <div className="d10-page">
          <p className="d10-page__eyebrow" lang="en">
            MOTION GRAPHICS FOR AI VIDEO
          </p>
          <h2 className="d10-page__title">
            <span>AI 영상에 활용하기 좋은</span>
            <span>
              <em>모션그래픽</em> 22가지
            </span>
          </h2>
          <div className="d10-grid">
            <MotionCard text={D10_CARDS.squash} tall>
              <SquashStretchBlob className="d10-card__squash" />
            </MotionCard>
            <MotionCard text={D10_CARDS.bounce} tall>
              <BounceBall />
            </MotionCard>
            <MotionCard text={D10_CARDS.scramble}>
              <TextScramble text={D10_SCRAMBLE_WORD} className="d10-card__scramble" />
            </MotionCard>
            <MotionCard text={D10_CARDS.morph}>
              <MorphShape className="d10-card__morph" />
            </MotionCard>
          </div>
        </div>
      </div>

      <div className="d10-parts">
        <section className="d10-part">
          <p className="d10-part__name">
            <code>{'<SquashStretchBlob expression>'}</code> 표정 세 가지
          </p>
          <div className="d10-part__row">
            <figure>
              <div className="d10-part__well">
                <SquashStretchBlob expression="neutral" className="d10-part__blob" />
              </div>
              <figcaption>neutral — 땅에 있을 때</figcaption>
            </figure>
            <figure>
              <div className="d10-part__well">
                <SquashStretchBlob expression="strain" className="d10-part__blob" />
              </div>
              <figcaption>strain — 웅크려 힘줄 때</figcaption>
            </figure>
            <figure>
              <div className="d10-part__well">
                <SquashStretchBlob expression="happy" className="d10-part__blob" />
              </div>
              <figcaption>happy — 날아오를 때</figcaption>
            </figure>
          </div>
        </section>

        <section className="d10-part">
          <p className="d10-part__name">
            <code>{'<TextScramble text>'}</code> · <code>{'<MorphShape shapes>'}</code> 다른 값
          </p>
          <div className="d10-part__row">
            <figure>
              <div className="d10-part__well d10-part__well--wide">
                <TextScramble text="MOTION" className="d10-part__scramble" />
              </div>
              <figcaption>text=&quot;MOTION&quot;</figcaption>
            </figure>
            <figure>
              <div className="d10-part__well">
                <MorphShape shapes={D10_PART_MORPH.shapes} stops={D10_PART_MORPH.stops} className="d10-part__morph" />
              </div>
              <figcaption>shapes=[&apos;star&apos;, &apos;circle&apos;]</figcaption>
            </figure>
            <figure>
              <div className="d10-part__well d10-part__well--tall">
                <BounceBall />
              </div>
              <figcaption>
                <code>{'<BounceBall>'}</code>
              </figcaption>
            </figure>
          </div>
        </section>
      </div>
    </ShowcaseStage>
  )
}
