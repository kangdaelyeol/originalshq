import { Battery, Plus, Thermometer } from 'lucide-react'
import { useSensorPartsViewModel } from '../view-model'

export const Craft = () => {
  const { state, actions } = useSensorPartsViewModel()
  const { part } = state
  const { selectPart } = actions
  const parts = [
    [
      '블루투스 인식 모듈',
      '등록된 휴대폰이 가까이 오면, 다음 연락 대상을 알아봅니다.',
    ],
    ['제어보드', '인식 정보를 앱의 연락 전환 흐름으로 이어줍니다.'],
    ['전원부', '1등급 건전지 배터리 하나로 최대 1년 이상 사용합니다.'],
  ]
  return (
    <>
      <section className="pf-endurance" id="details">
        <div className="pf-section-intro">
          <p className="pf-eyebrow">DESIGNED FOR THE DASHBOARD</p>
          <h2>
            차 안의 열도.
            <br />
            오래 쓰는 일도.
          </h2>
          <p>
            매일 차에 두는 제품이기에,
            <br />
            사용 환경부터 꼼꼼하게.
          </p>
        </div>
        <div className="pf-endurance-grid">
          <article>
            <Thermometer />
            <span>HEAT RESISTANCE</span>
            <strong className="pf-spec-number">
              100°C<span>+</span>
            </strong>
            <h3>
              차량 내장재용
              <br />
              ABS+ 소재.
            </h3>
            <p>
              100°C 이상에서도 사용 가능한
              <br />
              자동차 내장재용 ABS+를 사용합니다.
            </p>
          </article>
          <article>
            <Battery />
            <span>LONG LASTING</span>
            <strong className="pf-spec-number">
              1<span>년 이상</span>
            </strong>
            <h3>
              배터리 하나로.
              <br />
              최대 1년 이상.
            </h3>
            <p>
              1등급 건전지 배터리 사용.
              <br />
              배터리 1개로 오래 이어지는 편리함.
            </p>
            <small className="pf-spec-note">
              사용 환경에 따라 사용 기간은 달라질 수 있습니다.
            </small>
          </article>
        </div>
      </section>
      <section className="pf-finish pf-photo-panel">
        <img
          src="/images/brand/product-studio.webp"
          alt="제품 모서리와 무광 표면의 마감 렌더"
          width={1672}
          height={941}
          loading="lazy"
        />
        <div className="pf-photo-copy">
          <p className="pf-eyebrow">EVERY EDGE, CONSIDERED</p>
          <h2>
            매일 마주할 물건.
            <br />
            끝선까지, 정교하게.
          </h2>
        </div>
      </section>
      <section className="pf-sensors">
        <div className="pf-section-intro">
          <p className="pf-eyebrow">INTELLIGENCE INSIDE</p>
          <h2>
            작지만,
            <br />할 일은 분명하게.
          </h2>
        </div>
        <div className="pf-sensor-visual">
          <img
            src="/images/brand/internal.webp"
            width={1920}
            height={1080}
            alt="사용자 인식 모듈, 제어보드, 전원부가 들어가는 내부 배치 시안"
            loading="lazy"
          />
          <button
            className={`pf-hotspot hs-0 ${part === 0 ? 'active' : ''}`}
            aria-label="블루투스 인식 모듈 보기"
            onClick={() => selectPart(0)}
          >
            <Plus />
          </button>
          <button
            className={`pf-hotspot hs-1 ${part === 1 ? 'active' : ''}`}
            aria-label="제어보드 보기"
            onClick={() => selectPart(1)}
          >
            <Plus />
          </button>
          <button
            className={`pf-hotspot hs-2 ${part === 2 ? 'active' : ''}`}
            aria-label="전원부 보기"
            onClick={() => selectPart(2)}
          >
            <Plus />
          </button>
        </div>
        <div className="pf-sensor-answer" aria-live="polite">
          <span>0{part + 1}</span>
          <div>
            <h3>{parts[part][0]}</h3>
            <p>{parts[part][1]}</p>
          </div>
        </div>
        <small className="pf-footnote">내부 구성 이미지</small>
      </section>
    </>
  )
}
