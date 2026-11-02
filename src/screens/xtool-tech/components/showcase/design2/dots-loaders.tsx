import type { CSSProperties } from 'react'
import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

// 키프레임이 한 주기를 다 돌기 전부터 이어지게, 늦출 시간(ms)을 주기만큼 당겨 음수 지연으로 준다.
const lag = (ms: number, cycle = 1800): CSSProperties => ({ animationDelay: `${ms - cycle}ms` })

/** 가로 세 점이 차례로 솟았다 내려앉는 물결(0.9초). */
export function LoaderDotsWave(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-wave">
      {[16.8, 31, 45.25].map((x, i) => (
        <circle key={x} className={`d2-dots-wave__dot d2-dots-wave__dot--${i}`} cx={x} cy={31.1} r={5.05} />
      ))}
    </LoaderFrame>
  )
}

/** 세 점이 0.18초 간격으로 천천히 켜졌다 꺼진다. */
export function LoaderDotsFade(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-fade">
      {[16.8, 31, 45.25].map((x, i) => (
        <circle key={x} className="d2-dots-fade__dot" cx={x} cy={31.1} r={5} style={lag(60 + i * 180)} />
      ))}
    </LoaderFrame>
  )
}

/**
 * 맨 왼쪽 점이 둘을 넘어 오른쪽 끝에 내려앉고 나머지는 한 칸씩 당겨진다(0.9초).
 * 점이 모두 같아 주기 끝에 제자리로 돌아가도 이어져 보인다.
 */
export function LoaderDotsLeap(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-leap">
      <g className="d2-dots-leap__jump">
        <circle className="d2-dots-leap__hop" cx={16.72} cy={31.1} r={5} />
      </g>
      <circle className="d2-dots-leap__slide" cx={30.9} cy={31.1} r={5} />
      <circle className="d2-dots-leap__slide" cx={45.1} cy={31.1} r={5} />
    </LoaderFrame>
  )
}

/** 세 점이 차례로 부풀었다 줄어든다(0.9초). */
export function LoaderDotsPulse(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-pulse">
      {[16.68, 30.95, 45.15].map((x, i) => (
        <circle key={x} className="d2-dots-pulse__dot" cx={x} cy={31.05} r={4.6} style={lag(i * 120, 900)} />
      ))}
    </LoaderFrame>
  )
}

/** 작은 점이 두 큰 점 사이를 8자로 누비고, 부딪힌 큰 점은 살짝 밀렸다 돌아온다. */
export function LoaderDotsOrbit(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-orbit">
      <circle className="d2-dots-orbit__mid" cx={30.93} cy={31.08} r={5.05} />
      <circle className="d2-dots-orbit__right" cx={46.07} cy={31.09} r={5.05} />
      <circle className="d2-dots-orbit__moon" cx={15.6} cy={31.1} r={3} />
    </LoaderFrame>
  )
}

// 펼쳐졌을 때(--d2-k = 1) 세 점의 자리 — 칸 가운데 기준. 정삼각형이 아니라 영상에서 잰 그대로.
const SPLIT_ARMS = [
  [0, -10.75],
  [11.45, 7.61],
  [-11.54, 7.43],
]

/** 가운데 점 하나가 셋으로 갈라져 돌며 벌어졌다가, 더 빨리 돌며 다시 하나로 모인다. */
export function LoaderDotsSplit(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-dots-split">
      <g className="d2-dots-split__turn">
        {SPLIT_ARMS.map(([x, y]) => (
          <circle
            key={x}
            className="d2-dots-split__dot"
            cx={31}
            cy={31}
            r={5.65}
            style={{ '--d2-ax': `${x}px`, '--d2-ay': `${y}px` } as CSSProperties}
          />
        ))}
      </g>
    </LoaderFrame>
  )
}

/** 역삼각형 세 점(밝기 셋)이 0.6초마다 시계 반대로 한 꼭짓점씩 옮겨 간다. */
export function LoaderDotsTriangle(props: LoaderProps) {
  // 키프레임은 오른쪽 위에서 출발하는 점 기준 — 왼쪽 위·아래에서 시작하는 점은 그만큼 앞당긴다.
  const dots = [
    { opacity: 0.42, ahead: 600 },
    { opacity: 0.84, ahead: 1200 },
    { opacity: 1, ahead: 0 },
  ]
  return (
    <LoaderFrame {...props} name="d2-dots-triangle">
      {dots.map(({ opacity, ahead }) => (
        <circle
          key={opacity}
          className="d2-dots-triangle__dot"
          cx={42.3}
          cy={23.6}
          r={5.05}
          style={{ ...lag(60 - ahead), opacity }}
        />
      ))}
    </LoaderFrame>
  )
}

/** 밝기가 다른 세 점이 왼쪽 → 오른쪽 → 가운데(작게) 순으로 자리를 바꾼다. */
export function LoaderDotsSwap(props: LoaderProps) {
  const dots = [
    { opacity: 0.4, ahead: 1200 },
    { opacity: 0.8, ahead: 600 },
    { opacity: 1, ahead: 0 },
  ]
  return (
    <LoaderFrame {...props} name="d2-dots-swap">
      {dots.map(({ opacity, ahead }) => (
        <circle
          key={opacity}
          className="d2-dots-swap__dot"
          cx={15.45}
          cy={31.03}
          r={5.05}
          style={{ ...lag(69 - ahead), opacity }}
        />
      ))}
    </LoaderFrame>
  )
}
