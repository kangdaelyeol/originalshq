import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

/** 시계 판 — 고리와 시침·분침(가운데에서 12시로 그려 두고 키프레임이 돌린다). 크기는 영상의 큰 시계 기준. */
function ClockFace({ name, r = 18.25, stroke = 4.25 }: { name: string; r?: number; stroke?: number }) {
  return (
    <>
      <circle className="d2-clock__ring" cx={31} cy={31} r={r} strokeWidth={stroke} />
      <line className={`d2-clock__hand ${name}__hour`} x1={31} y1={31} x2={31} y2={24.95} />
      <line className={`d2-clock__hand ${name}__minute`} x1={31} y1={31} x2={31} y2={20.85} />
    </>
  )
}

// 뻐꾸기 시계 집 — 지붕(처마가 벽보다 조금 나온다)과 벽·바닥, 가운데 작은 시계 판
function CuckooHouse({ name }: { name: string }) {
  return (
    <>
      <path className="d2-cuckoo__house" d="M18.7 24.2 31 11.8l12.3 12.4M20.9 24.6l2.4 11.6h15.4l2.4-11.6" />
      <circle className="d2-cuckoo__face" cx={30.8} cy={25.5} r={5.24} />
      <line className={`d2-cuckoo__hand ${name}__hour`} x1={30.8} y1={25.5} x2={30.8} y2={23.8} />
      <line className={`d2-cuckoo__hand ${name}__minute`} x1={30.8} y1={25.5} x2={30.8} y2={22.9} />
    </>
  )
}

/** 시침은 한 바퀴, 분침은 네 바퀴 — 쉬지 않고 도는 시계(1.8초). */
export function LoaderClockSpin(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-clock-spin">
      <ClockFace name="d2-clock-spin" />
    </LoaderFrame>
  )
}

/** 시계가 0.36초마다 콩닥이며 커졌다 작아지고, 바늘은 돌다가 한 바퀴 끝에 제자리로 튄다. */
export function LoaderClockPulse(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-clock-pulse">
      <g className="d2-clock-pulse__beat">
        <ClockFace name="d2-clock-pulse" r={17.98} stroke={4.08} />
      </g>
    </LoaderFrame>
  )
}

/** 작은 시계가 둥실 내려왔다 올라가고, 바닥을 박차고 오를 때 그림자가 번진다. */
export function LoaderClockFloat(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-clock-float">
      <ellipse className="d2-clock-float__shadow" cx={30.85} cy={48.6} rx={13.6} ry={2} />
      <g className="d2-clock-float__body">
        {/* 큰 시계를 0.545배로 줄여 (30.9, 22.38) 에 둔다 */}
        <g transform="translate(30.9 22.38) scale(0.545) translate(-31 -31)">
          <ClockFace name="d2-clock-float" />
        </g>
      </g>
    </LoaderFrame>
  )
}

/** 오른쪽 위 축에 매달린 추(작은 시계)가 좌우로 흔들린다(0.9초). */
export function LoaderClockPendulum(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-clock-pendulum">
      <g className="d2-clock-pendulum__arm">
        <line className="d2-clock-pendulum__rod" x1={30.89} y1={12.44} x2={30.89} y2={38} />
        <circle className="d2-clock-pendulum__bob" cx={30.89} cy={42.19} r={4.15} />
        <line className="d2-clock-pendulum__tick" x1={30.89} y1={42.19} x2={30.89} y2={40.1} />
      </g>
      <circle cx={30.89} cy={12.44} r={1.35} />
    </LoaderFrame>
  )
}

/** 뻐꾸기 시계 — 바늘이 돌고 아래 추가 좌우로 흔들린다. */
export function LoaderCuckooPendulum(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-cuckoo-pendulum">
      <CuckooHouse name="d2-cuckoo-pendulum" />
      <g className="d2-cuckoo-pendulum__arm">
        <line className="d2-cuckoo__chain" x1={31} y1={36.6} x2={31} y2={46.8} />
        <circle className="d2-cuckoo-pendulum__bob" cx={31} cy={48.6} r={1.75} />
      </g>
    </LoaderFrame>
  )
}

/** 뻐꾸기 시계 — 두 솔방울 추가 번갈아 오르내린다. */
export function LoaderCuckooWeights(props: LoaderProps) {
  const weight = 'M0 -2.9 1.5 -0.6 0 2.9 -1.5 -0.6Z'
  return (
    <LoaderFrame {...props} name="d2-cuckoo-weights">
      <CuckooHouse name="d2-cuckoo-weights" />
      <line className="d2-cuckoo__chain d2-cuckoo-weights__chain d2-cuckoo-weights__chain--l" x1={27} y1={36.6} x2={27} y2={48} />
      <line className="d2-cuckoo__chain d2-cuckoo-weights__chain d2-cuckoo-weights__chain--r" x1={35} y1={36.6} x2={35} y2={48} />
      <g className="d2-cuckoo-weights__weight d2-cuckoo-weights__weight--l">
        <path d={weight} transform="translate(27 48.4)" />
      </g>
      <g className="d2-cuckoo-weights__weight d2-cuckoo-weights__weight--r">
        <path d={weight} transform="translate(35 48.4)" />
      </g>
    </LoaderFrame>
  )
}

/** 12시에서 부채꼴이 시계 방향으로 차올랐다가, 같은 방향으로 비워진다. */
export function LoaderClockPie(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-clock-pie">
      <circle className="d2-clock__ring" cx={31} cy={31} r={18.25} strokeWidth={4.25} />
      {/* 반지름 6.1 원에 굵기 12.2 획 — 획 하나가 반지름 12.2 부채꼴이 된다 */}
      <circle className="d2-arc d2-clock-pie__pie" cx={31} cy={31} r={6.1} pathLength={360} />
    </LoaderFrame>
  )
}

/** 모래시계가 뒤집히고, 위의 모래가 줄며 아래에 쌓인다(0.9초). */
export function LoaderHourglass(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-hourglass">
      <g className="d2-hourglass__flip">
        <path
          className="d2-hourglass__glass"
          d="M19.8 15h21.86q-.2 11-10.13 16 9.93 5 10.13 16H19.8q.2-11 10.13-16Q20 26 19.8 15Z"
        />
        {/* 모래는 유리 안쪽 곡선을 따라 볼록한 삼각형 — 아래 것은 꼭짓점 기준으로 줄고, 위 것은 밑변 기준으로 자란다(뒤집힌 뒤엔 위아래가 바뀐다) */}
        <path className="d2-hourglass__sand d2-hourglass__sand--drain" d="M30.73 35.6Q35.63 39.3 36.33 43H25.13Q25.83 39.3 30.73 35.6Z" />
        <path className="d2-hourglass__sand d2-hourglass__sand--fill" d="M30.73 26.6Q35.63 22.9 36.33 19.2H25.13Q25.83 22.9 30.73 26.6Z" />
      </g>
    </LoaderFrame>
  )
}
