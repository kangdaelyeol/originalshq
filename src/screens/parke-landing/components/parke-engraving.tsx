import type { CSSProperties } from 'react'
import { useEngravingViewModel } from '../view-model'

const phrases = ['Just do it', '오늘도 무사히', '좋은 날의 시작', 'MY OWN WAY']

export const  ParkeEngraving = () => {
  const { state, actions } = useEngravingViewModel(phrases[0])
  const { engraving, preview, letteringSize } = state
  const { setEngraving } = actions
  const lettering = { '--engraving-size': letteringSize } as CSSProperties

  return (
    <section id="engraving" className="pe-custom" aria-labelledby="pe-heading">
      <div className="pe-heading">
        <p className="pf-eyebrow">MAKE IT YOURS</p>
        <h2 id="pe-heading">
          당신의 한마디를.
          <br />
          파르케의 얼굴에.
        </h2>
        <p>
          전면 Parké 로고 자리에,
          <br className="pe-mobile-break" /> 이름도 다짐도 새겨보세요.
        </p>
      </div>

      <div className="pe-layout">
        <figure className="pe-preview">
          <div
            className="pe-render"
            role="img"
            aria-label={`파르케 전면 로고 자리에 ${preview} 문구가 새겨진 모습`}
          >
            <img
              src="/images/engraving-v29/front-blank.webp"
              width={1672}
              height={941}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="pe-lettering" style={lettering} aria-hidden="true">
              {preview}
            </span>
          </div>
          <figcaption>전면 각인 미리보기</figcaption>
        </figure>

        <div className="pe-controls">
          <label htmlFor="pe-message">나만의 각인 문구</label>
          <div className="pe-input-wrap">
            <input
              id="pe-message"
              value={engraving}
              maxLength={16}
              onChange={(event) => setEngraving(event.target.value)}
              placeholder="이름이나 좋아하는 문구"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="pe-input-help"
            />
            <span className="pe-count" aria-hidden="true">
              {engraving.length}/16
            </span>
          </div>
          <p id="pe-input-help" className="pe-input-help">
            문구를 바꾸면 제품 전면에 바로 반영됩니다.
          </p>
          <div className="pe-presets" role="group" aria-label="추천 각인 문구">
            {phrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                aria-pressed={engraving === phrase}
                onClick={() => setEngraving(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>
          <p className="pe-option">
            커스텀 각인 서비스 <span>· 선택 옵션</span>
          </p>
        </div>
      </div>
    </section>
  )
}
