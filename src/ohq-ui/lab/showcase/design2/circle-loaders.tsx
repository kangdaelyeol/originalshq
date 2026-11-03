import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'
import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

// 링 반지름(획 가운데) — 영상 칸에서 잰 값. 굵기·트랙 밝기는 .d2-track/.d2-arc 에.
const R = 18.27

function Track() {
  return <circle className="d2-track" cx={31} cy={31} r={R} />
}

/** 링 위의 호 — 꼬리(--d2-t)·머리(--d2-h) 각도를 키프레임이 움직이고, 길이·회전은 CSS 가 계산한다. */
function Arc({ className, style }: { className?: string; style?: CSSProperties }) {
  return <circle className={cx('d2-arc', className)} cx={31} cy={31} r={R} pathLength={360} style={style} />
}

// 잔상은 앞선 시간의 모습을 덜 진하게 겹친 것 — 늦출 시간만큼 음수 지연을 줘 첫 바퀴부터 이어지게 한다.
const lag = (ms: number): CSSProperties => ({ animationDelay: `${ms - 1800}ms` })

/** 12시의 점이 시계 방향으로 한 바퀴를 그려 링을 채우고, 같은 방향으로 지워 다시 점이 된다. */
export function LoaderRingDraw(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-draw">
      <Track />
      <Arc />
    </LoaderFrame>
  )
}

/** 머리가 먼저 내달리고 꼬리가 두 번에 나눠 쫓아가며 세 바퀴 — 다시 12시의 점으로 모인다. */
export function LoaderRingChase(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-chase">
      <Track />
      <Arc />
    </LoaderFrame>
  )
}

/** 7시 반쯤의 짧은 호가 뒤로 한 번 감겼다가, 늘어나며 한 바퀴 휘돌아 제자리로. */
export function LoaderRingWindup(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-windup">
      <Track />
      <Arc />
    </LoaderFrame>
  )
}

/** 거의 꽉 찬 링에 난 틈이 뒤로 살짝 물러섰다가 한 바퀴 돈다(호 길이는 그대로). */
export function LoaderRingGap(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-gap">
      <Track />
      {/* 쉴 때 꼬리가 12시에서 227.9도 — 원 경로는 3시에서 시작하니 137.9도 돌려 둔다 */}
      <g transform="rotate(137.9 31 31)">
        <circle className="d2-ring-gap__arc" cx={31} cy={31} r={R} pathLength={360} />
      </g>
    </LoaderFrame>
  )
}

/** 12시에서 자란 호가 둘로 갈라져, 양쪽에서 6시로 모여 점이 된 뒤 사라진다. */
export function LoaderRingSplit(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-split">
      <Track />
      <g className="d2-ring-split__arcs">
        <Arc className="d2-ring-split__a" />
        <Arc className="d2-ring-split__b" />
      </g>
    </LoaderFrame>
  )
}

/** LoaderRingDraw 와 같은 꼴에, 한 박자 늦은 옅은 호가 꼬리 쪽에 남는다. */
export function LoaderRingDrawTrail(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-draw-trail">
      <Track />
      <Arc className="d2-ring-draw-trail__echo" style={lag(28)} />
      <Arc />
    </LoaderFrame>
  )
}

/** 짧은 호가 한 바퀴 도는 동안, 12시에서 떨어져 나온 옅은 조각이 뒤를 쫓는다. */
export function LoaderRingComet(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-ring-comet">
      <Track />
      <Arc className="d2-ring-comet__ghost" />
      <Arc className="d2-ring-comet__head" />
    </LoaderFrame>
  )
}

// 세 점(12·4·8시)과 잔상 4겹 — 60ms 씩 늦고 점점 옅다(영상에서 잰 밝기).
const ORBIT_DOTS = [0, 120, 240].map((deg) => {
  const rad = (deg * Math.PI) / 180
  return { x: 31 + R * Math.sin(rad), y: 31 - R * Math.cos(rad) }
})
const ORBIT_ECHOES = [0.09, 0.21, 0.3, 0.45]

/** 링 위 세 점이 천천히 출발해 빠르게 돌고 잔상을 남기며 멈춘다. */
export function LoaderRingOrbit(props: LoaderProps) {
  const dots = ORBIT_DOTS.map((d) => <circle key={d.x} cx={d.x} cy={d.y} r={2.15} />)
  return (
    <LoaderFrame {...props} name="d2-ring-orbit">
      <Track />
      {ORBIT_ECHOES.map((opacity, i) => (
        <g key={opacity} className="d2-ring-orbit__dots" style={{ ...lag((ORBIT_ECHOES.length - i) * 60), opacity }}>
          {dots}
        </g>
      ))}
      <g className="d2-ring-orbit__dots">{dots}</g>
    </LoaderFrame>
  )
}
