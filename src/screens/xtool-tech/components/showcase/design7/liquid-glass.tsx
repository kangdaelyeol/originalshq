import { useId, type RefObject } from 'react'
import { INDICATOR_Y, OPEN_CX, PILL_HALF_H, PILL_LEFT_REL, type LiquidGeometry, type LiquidPose } from './liquid-menu-data'
import { PILL_TOP_INSET, glassAttrs } from './liquid-glass-attrs'

/** 엔진이 매 프레임 고치는 SVG 요소들 */
export interface LiquidGlassRefs {
  circle: RefObject<SVGCircleElement | null>
  pill: RefObject<SVGRectElement | null>
  track: RefObject<SVGRectElement | null>
  rings: RefObject<SVGGElement | null>
}

interface LiquidGlassBodyProps {
  pose: LiquidPose
  geo: LiquidGeometry
  refs?: LiquidGlassRefs
  className?: string
}

/**
 * 물방울 유리 몸(Design 7) — 버튼(원)과 메뉴 알약이 한 덩어리 물처럼 붙고 떨어진다.
 * 원은 빨강, 알약은 초록 채널에 그려 필터 안에서 따로 꺼내 흐린 뒤 "더해서"(메타볼) 문턱을 넘긴다.
 * 그냥 합집합을 흐리면 이음매가 영상보다 가늘다 — 더한 장(σ10, 문턱 0.5)이 F79 목 모양과 맞는다(오차 5 vs 120).
 * 유리 무늬도 그 모양 하나에서 만든다: 위·왼쪽 2px 어두운 테두리, 아래·오른쪽 흰 테두리,
 * 위쪽 안쪽 그림자, 오른쪽 아래로 떨어지는 그림자. 좌표 단위 = 영상 px.
 */
export function LiquidGlassBody({ pose, geo, refs, className }: LiquidGlassBodyProps) {
  const uid = useId().replace(/:/g, '')
  const glassId = `d7-glass-${uid}`
  const trackId = `d7-track-${uid}`
  const clipId = `d7-clip-${uid}`
  const ringBlurId = `d7-ring-${uid}`
  const a = glassAttrs(pose, geo)
  const restL = OPEN_CX + PILL_LEFT_REL

  return (
    <svg className={className} viewBox="-420 -200 840 400" aria-hidden focusable="false">
      <defs>
        <LiquidGlassFilter id={glassId} />
        <filter id={trackId} x="-20%" y="-60%" width="140%" height="220%" colorInterpolationFilters="sRGB">
          {/* 홈: 어두운 바닥(-26) + 둘레 선(위가 진하다, F1 x480: 위 -58 / 아래 -39) + 위쪽 안쪽 그림자 */}
          <feMorphology in="SourceAlpha" operator="erode" radius="1.4" result="in" />
          <feComposite in="SourceAlpha" in2="in" operator="out" result="ring" />
          <feOffset in="SourceAlpha" dy="2" result="down" />
          <feComposite in="SourceAlpha" in2="down" operator="out" result="topRim" />
          <feOffset in="SourceAlpha" dy="5" result="down5" />
          <feGaussianBlur in="down5" stdDeviation="3" result="down5b" />
          <feComposite in="SourceAlpha" in2="down5b" operator="out" result="inset" />
          <feColorMatrix in="SourceAlpha" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" result="fill" />
          <feColorMatrix in="ring" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" result="ringC" />
          <feColorMatrix in="topRim" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0" result="topC" />
          <feColorMatrix in="inset" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0" result="insetC" />
          <feMerge>
            <feMergeNode in="fill" />
            <feMergeNode in="insetC" />
            <feMergeNode in="ringC" />
            <feMergeNode in="topC" />
          </feMerge>
        </filter>
        <clipPath id={clipId}>
          <rect x={restL} y={-PILL_HALF_H} width={geo.pillLen} height={PILL_HALF_H * 2} rx={PILL_HALF_H} />
        </clipPath>
        <filter id={ringBlurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <g filter={`url(#${glassId})`}>
        <circle ref={refs?.circle} cx={a.cx} cy={0} r={a.r} fill="#f00" />
        <rect
          ref={refs?.pill}
          x={a.pillX}
          y={-PILL_HALF_H + PILL_TOP_INSET}
          width={a.pillW}
          height={PILL_HALF_H * 2 - PILL_TOP_INSET}
          rx={a.pillRx}
          ry={PILL_HALF_H}
          fill={a.pillFill}
          display={a.pillDisplay}
          style={{ mixBlendMode: 'screen' }}
        />
      </g>

      {/* 물결 — 물방울이 닿으면 알약 유리 안에서만 두 겹 퍼진다(F426~F432, 밝고 어두운 고리 ±9) */}
      <g ref={refs?.rings} clipPath={`url(#${clipId})`} filter={`url(#${ringBlurId})`} opacity={0}>
        {[0, 1].map((k) => (
          <g key={k} data-ring={k}>
            <circle cx={0} cy={INDICATOR_Y} r={1} fill="none" stroke="#000" strokeOpacity={0.13} strokeWidth={8} />
            <circle cx={0} cy={INDICATOR_Y} r={1} fill="none" stroke="#fff" strokeOpacity={0.34} strokeWidth={7} />
          </g>
        ))}
      </g>

      <rect
        ref={refs?.track}
        x={a.trackX}
        y={a.trackY}
        width={a.trackW}
        height={a.trackH}
        rx={a.trackH / 2}
        fill="#000"
        display={a.trackDisplay}
        filter={`url(#${trackId})`}
      />
    </svg>
  )
}

/** 물 모양 + 유리 무늬 필터. 입력: 원 = 빨강, 알약 = 초록(밝기 = 물에 보태는 정도) */
function LiquidGlassFilter({ id }: { id: string }) {
  const alpha = (k: number) => `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${k} 0`
  const white = (k: number) => `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${k} 0`
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x="-420" y="-200" width="840" height="400" colorInterpolationFilters="sRGB">
      {/* 1. 원·알약을 따로 흐려 더한 장 → 문턱 0.5 */}
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="c" />
      <feGaussianBlur in="c" stdDeviation="10" result="cb" />
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0" result="p" />
      <feGaussianBlur in="p" stdDeviation="10" result="pb" />
      <feComposite in="cb" in2="pb" operator="arithmetic" k2="1" k3="1" result="field" />
      <feColorMatrix in="field" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 30 -14.5" result="shape" />
      <feColorMatrix in="cb" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 30 -14.5" result="cshape" />

      {/* 2. 그림자 — 크게 퍼져 오른쪽 아래로(F49: 중심 +19·+45, 반지름 78, 28%; F1 알약 오른쪽 50px까지) + 옅은 둘레 */}
      <feMorphology in="shape" operator="dilate" radius="20" result="spread" />
      <feGaussianBlur in="spread" stdDeviation="18" result="spreadB" />
      <feOffset in="spreadB" dx="21" dy="44" result="far" />
      <feColorMatrix in="far" values={alpha(0.27)} result="farC" />
      <feGaussianBlur in="shape" stdDeviation="12" result="nearC0" />
      <feColorMatrix in="nearC0" values={alpha(0.13)} result="nearC" />
      <feMerge result="shadows">
        <feMergeNode in="farC" />
        <feMergeNode in="nearC" />
      </feMerge>
      <feComposite in="shadows" in2="shape" operator="out" result="shadowOut" />

      {/* 3. 유리 — 위쪽 안쪽 그림자(F1 x480: 가장자리 -42 → 13px 안쪽 -21 → 27px 안쪽 -4) */}
      <feOffset in="shape" dx="7" dy="13" result="innerO" />
      <feGaussianBlur in="innerO" stdDeviation="8" result="innerB" />
      <feComposite in="shape" in2="innerB" operator="out" result="inner" />
      <feColorMatrix in="inner" values={alpha(0.24)} result="innerC" />
      {/* 어두운 테두리 — 왼쪽 위로 2px(225° 62, 180° 78, 270° 88) + 둘레 전체에 옅은 1px(315° 116) */}
      <feOffset in="shape" dx="1.7" dy="1.9" result="darkO" />
      <feComposite in="shape" in2="darkO" operator="out" result="darkA" />
      <feGaussianBlur in="darkA" stdDeviation="0.55" result="darkB" />
      <feComposite in="darkB" in2="shape" operator="in" result="dark" />
      <feColorMatrix in="dark" values={alpha(0.62)} result="darkC" />
      <feMorphology in="shape" operator="erode" radius="1" result="thin" />
      <feComposite in="shape" in2="thin" operator="out" result="outline" />
      <feColorMatrix in="outline" values={alpha(0.24)} result="outlineC" />
      {/* 흰 테두리 — 오른쪽 아래 45°에서 가장 넓고(5px) 0°·90°는 3.5px, 135°·315°엔 없다 */}
      <feOffset in="shape" dx="-3.4" dy="-3.4" result="whiteO" />
      <feComposite in="shape" in2="whiteO" operator="out" result="whiteA" />
      <feGaussianBlur in="whiteA" stdDeviation="0.7" result="whiteB" />
      <feComposite in="whiteB" in2="shape" operator="in" result="whiteIn" />
      <feColorMatrix in="whiteIn" values={white(0.9)} result="whiteC" />
      {/* 흰 테두리 안쪽으로 번지는 빛(F1 x480: 685~687 +20~36) */}
      <feOffset in="shape" dx="-2" dy="-5.5" result="softO" />
      <feComposite in="shape" in2="softO" operator="out" result="softA" />
      <feGaussianBlur in="softA" stdDeviation="1.4" result="softB" />
      <feComposite in="softB" in2="shape" operator="in" result="softIn" />
      <feColorMatrix in="softIn" values={white(0.3)} result="softC" />
      {/* 이음매 — 붙어 있을 때 버튼 자신의 흰 테두리가 덩어리 안에 남는다(F81 x≈143) */}
      <feOffset in="cshape" dx="-3.4" dy="-3.4" result="seamO" />
      <feComposite in="cshape" in2="seamO" operator="out" result="seamA" />
      <feGaussianBlur in="seamA" stdDeviation="1.3" result="seamB" />
      <feComposite in="seamB" in2="shape" operator="in" result="seamIn" />
      <feColorMatrix in="seamIn" values={white(0.5)} result="seamC" />
      {/* 유리 몸은 바탕보다 5 어둡다(F1 x290~560 가운데 -5) */}
      <feColorMatrix in="shape" values={alpha(0.026)} result="tint" />

      <feMerge>
        <feMergeNode in="shadowOut" />
        <feMergeNode in="tint" />
        <feMergeNode in="innerC" />
        <feMergeNode in="softC" />
        <feMergeNode in="seamC" />
        <feMergeNode in="whiteC" />
        <feMergeNode in="outlineC" />
        <feMergeNode in="darkC" />
      </feMerge>
    </filter>
  )
}
