import { useRevealOnceViewModel } from '../view-model'

/*
const SignalLink = ({ studio = false }: { studio?: boolean }) => {
  const line = studio
    ? 'M 520 515 C 600 300 730 320 812 470'
    : 'M 722 415 C 660 390 580 510 460 556'
  return (
    <svg
      className={`pv-signal ${studio ? 'is-studio' : ''}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="pv-signal-halo" d={line} />
      <path className="pv-signal-base" d={line} />
      <path className="pv-signal-flow" d={line} />
      {(studio
        ? [
            [520, 515],
            [812, 470],
          ]
        : [
            [722, 415],
            [460, 556],
          ]
      ).map(([x, y], i) => (
        <g key={i}>
          <circle className="pv-signal-ring" cx={x} cy={y} r="25" />
          <circle className="pv-signal-point" cx={x} cy={y} r="9" />
        </g>
      ))}
    </svg>
  )
} */

/** Yesterday's driver and today's, side by side. The two frames enter once,
 * one after the other, when the block scrolls into view, and stay put after
 * that. */
export const DriverChangeScenes = () => {
  const { targetRef, state } = useRevealOnceViewModel<HTMLDivElement>()

  return (
    <div
      ref={targetRef}
      className={`pv-driver-comparison ${state.revealed ? 'is-revealed' : ''}`}
    >
      <figure className="pv-driver-frame is-yesterday">
        <div className="pv-day-heading">
          <span>어제</span>
          <strong>아내가 운전한 날</strong>
        </div>
        <div className="pv-driver-photo">
          <img
            src="/images/story-v26/yesterday-exit.webp"
            alt="어제 운전한 아내가 차 문을 닫고 걸어가는 뒷모습"
            width={1254}
            height={1254}
            loading="lazy"
          />
        </div>
        <figcaption>
          <span>운전은 끝났지만,</span>
          <strong>번호는 그대로 남아 있습니다.</strong>
        </figcaption>
      </figure>
      <figure className="pv-driver-frame is-today">
        <div className="pv-day-heading">
          <span>오늘</span>
          <strong>남편이 운전하는 날</strong>
        </div>
        <div className="pv-driver-photo">
          <img
            src="/images/story-v26/today-manual.webp"
            alt="오늘 운전하는 남편이 대시보드의 일반 주차번호판 숫자를 손으로 바꾸는 모습"
            width={1254}
            height={1254}
            loading="lazy"
          />
        </div>
        <figcaption>
          <span>이제 내가 연락받으려면,</span>
          <strong>번호판도 직접 바꿔야 합니다.</strong>
        </figcaption>
      </figure>
    </div>
  )
}

export const BeautyCut = () => {
  return (
    <figure className="pv-beauty">
      <img
        src="/images/story-v26/beauty.webp"
        alt="빛으로 모서리와 무광 마감을 드러낸 Parké 제품 뷰티컷"
        width={1536}
        height={1024}
        loading="lazy"
      />
      <figcaption>
        <span>Parké</span>
        <p>
          함께 쓰는 차를 위한
          <br />
          <strong>자동 주차번호판.</strong>
        </p>
      </figcaption>
    </figure>
  )
}
