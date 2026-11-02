import type { CSSProperties } from 'react'
import { LoaderFrame } from './loader-frame'
import type { LoaderProps } from './types'

const lag = (ms: number, cycle: number): CSSProperties => ({ animationDelay: `${ms - cycle}ms` })

/** 점에서 피어난 원판이 커지며 흐려지고, 0.16초 뒤 두 번째 원판이 그 안에서 같은 길을 따른다(0.9초). */
export function LoaderFadeBloom(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-bloom">
      <circle className="d2-fade-bloom__disc" cx={31} cy={31} r={19.5} />
      <circle className="d2-fade-bloom__disc" cx={31} cy={31} r={19.5} style={lag(160, 900)} />
    </LoaderFrame>
  )
}

/** 원판이 칸을 꽉 채울 만큼 부풀었다 살짝 오므라들며 흐려지고, 0.54초 뒤 다음 원판이 덮는다. */
export function LoaderFadeSwell(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-swell">
      <circle className="d2-fade-swell__disc" cx={31} cy={31} r={21.3} />
      <circle className="d2-fade-swell__disc" cx={31} cy={31} r={21.3} style={lag(540, 1800)} />
    </LoaderFrame>
  )
}

/** 자라던 원판 가운데에 구멍이 뚫려, 점점 가늘어지는 고리로 퍼져 사라진다(0.9초). */
export function LoaderFadeRing(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-ring">
      <circle className="d2-fade-ring__ring" cx={31} cy={31} />
    </LoaderFrame>
  )
}

/** 원판 하나가 커지다가 다 자랄 무렵 흐려진다(0.9초). */
export function LoaderFadeDisc(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-disc">
      <circle className="d2-fade-disc__disc" cx={31} cy={31} r={20} />
    </LoaderFrame>
  )
}

/** 가운데 원판이 숨 쉬듯 부풀 때마다 회색 무리가 퍼져 나가 흐려진다(0.6초). */
export function LoaderFadeHalo(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-halo">
      <circle className="d2-fade-halo__halo" cx={31} cy={31} r={19.45} />
      <circle className="d2-fade-halo__core" cx={31} cy={31} r={8.45} />
    </LoaderFrame>
  )
}

/** 가운데 원판이 부풀며 가는 고리를 내보내고, 고리는 퍼지며 흐려진다(0.9초). */
export function LoaderFadeEmit(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-emit">
      <circle className="d2-fade-emit__ring" cx={31} cy={31} r={17.31} />
      <circle className="d2-fade-emit__core" cx={31} cy={31} r={6.15} />
    </LoaderFrame>
  )
}

/** 가운데서 자란 고리가 바깥 고리에 닿으면, 바깥 고리가 용수철처럼 출렁이다 멈춘다. */
export function LoaderFadeRipple(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-ripple">
      <g className="d2-fade-ripple__spring">
        <circle className="d2-fade-ripple__ring" cx={31} cy={31} r={16.2} />
        <circle className="d2-fade-ripple__ring d2-fade-ripple__grow" cx={31} cy={31} r={16.2} />
      </g>
    </LoaderFrame>
  )
}

/** 밝은 고리와 옅은 고리가 반 주기마다 안쪽·바깥쪽 자리를 맞바꾼다. */
export function LoaderFadeSwap(props: LoaderProps) {
  return (
    <LoaderFrame {...props} name="d2-fade-swap">
      <circle className="d2-fade-swap__ring" cx={31} cy={31} r={18.24} style={{ ...lag(900, 1800), opacity: 0.5 }} />
      <circle className="d2-fade-swap__ring" cx={31} cy={31} r={18.24} />
    </LoaderFrame>
  )
}
