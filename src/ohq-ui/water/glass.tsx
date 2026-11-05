// 물 유리(D7) SVG 필터 — lab/showcase/design7/liquid-glass.tsx의 값을 그대로 옮기고 크기 배율(k)만 더했다.
// 값은 영상 px(표시 알약 높이 50.5px 기준)라 작은 부품은 k로 줄인다. 필터는 비싸다(넓은 blur 여러 번) —
// 모양이 바뀌는(물처럼 붙고 떨어지는) 곳에만 쓰고, 가만히 있는 상자는 CSS 믹스인(styles/_tokens.scss
// w-glass)으로 칠한다.

const alpha = (a: number) => `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${a} 0`
const white = (a: number) => `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${a} 0`
const n = (v: number) => Math.round(v * 1000) / 1000

/**
 * 그림자 퍼짐(CSS box-shadow spread) — 모양을 퍼짐/2로 흐린 뒤 Φ(−2)(= 0.02275)에서 자르면 퍼짐만큼 둥글게
 * 커진다(CSS처럼 모서리 반지름도 같이 커진다). 기울기는 끝이 1px 안에서 0 → 1이 되게, 작은 그림자도 먼 곳이
 * 0으로 남게(절편 ≤ 0) 23 아래로는 내리지 않는다. 예전 dilate(네모 퍼짐)는 모서리가 각져 CSS와 4~8 달랐다
 */
const SPREAD_T = 0.02275
const spreadSlope = (sd: number) => Math.max(sd / 0.05399, 0.5 / SPREAD_T + 1)

export interface WaterFilterRegion {
  x: number
  y: number
  width: number
  height: number
}

interface WaterGlassFilterProps {
  id: string
  /** 필터가 그릴 영역(그리는 SVG의 좌표, px) — 그림자가 오른쪽 아래로 크게 퍼지니 넉넉히 */
  region: WaterFilterRegion
  /** 크기 배율 — 테두리·안쪽 그림자 두께(1 = D7 영상) */
  k?: number
  /**
   * 떨어지는 그림자 배율 — 크기를 줄이고, 1 아래면 진하기도 같이 줄인다(CSS w-glass와 같은 규칙이라 필터와
   * CSS 유리를 바꿔 끼워도 이음매가 없다). 0이면 그림자 없음 — 그 몫만큼 싸다
   */
  lift?: number
  /**
   * 물 모양(메타볼) — 빨강 채널 모양(버튼)과 초록 채널 모양(알약)을 흐려 더한 뒤 문턱을 넘겨 한 덩어리로
   * 붙인다(σ10, 30x-14.5). 파랑 채널은 알약의 참 모양 — 떨어져 있을 때 켜면(버튼 빨강도 늘 참 모양으로 들어간다)
   * 멈춘 모양이 goo를 끈 필터·CSS 유리(w-glass)와 같아 바꿔 끼워도 이음매가 없다. 모양은 순수한 빨강·초록·파랑으로
   * 그리고 겹치면 mix-blend-mode: screen. 끄면 그린 모양(알파) 그대로 유리를 입힌다.
   * 비싸다 — 크롬(Skia)이 물 모양을 쓰는 곳(테두리·그림자 18곳)마다 흐림부터 다시 계산한다(GPU 패스 3배).
   * 움직이는 곳은 두 겹(안 <g>에 WaterGooShapeFilter, 바깥 <g>에 gooShape)으로 쓴다
   */
  goo?: boolean
  /**
   * 그린 것이 WaterGooShapeFilter의 결과다(빨강 = 물 모양, 초록 = 버튼 모양) — 물 모양을 안 겹에서 한 번만
   * 계산해 goo보다 GPU 패스가 1/3. 모양·이음매는 goo와 같다
   */
  gooShape?: boolean
  /** 테두리·안쪽 그림자 진하기 배수 — CSS w-glass의 --w-rim과 같은 값을 넘긴다(사용자 설정, theme/water.ts) */
  rim?: number
  /** 떨어지는 그림자(크기·진하기) 배수 — CSS w-glass의 --w-depth와 같다 */
  depth?: number
  /** 유리 농도 — 0이면 D7 몸(2.6% 어둡게), 올리면 그만큼 흰 막(CSS --w-pane과 같다) */
  frost?: number
}

/**
 * 물 모양(메타볼) 만들기 — 결과 shape(붙은 모양 알파) · cshape(버튼 몫만, 물 목 이음매 흰 선용)
 * 검은 바탕 위에 깔아 불투명하게 — 채널(색)을 꺼낼 때 가장자리 반투명 화소가 꽉 차서 모양이 반 화소 커지고
 * 테두리 띠가 2~3px로 번지던 것을 없앤다. 빨강·초록을 한 장으로 한 번만 흐린다. 참 모양(빨강 버튼 + 파랑
 * 알약)과 합쳐 문턱이 둥근 끝을 반 화소쯤 깎는 것을 되돌린다 — 떨어져 멈춘 모양이 goo를 끈 필터와 같다
 */
function gooShapeOps(k: number) {
  return (
    <>
      <feFlood floodColor="#000" floodOpacity="1" result="black" />
      <feMerge result="opaque">
        <feMergeNode in="black" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
      <feGaussianBlur in="opaque" stdDeviation={n(10 * k)} result="blurred" />
      <feColorMatrix in="blurred" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  30 30 0 0 -14.5" result="field" />
      <feColorMatrix in="opaque" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 1 0 0" result="trueShape" />
      <feComposite in="trueShape" in2="field" operator="over" result="shape" />
      <feColorMatrix in="blurred" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  30 0 0 0 -14.5" result="cshape" />
    </>
  )
}

/**
 * 물 모양만 만드는 안 겹 필터 — 빨강(버튼)·초록(알약 물 몫)·파랑(알약 참 모양) 모양을 받아(goo와 같은 규칙),
 * 빨강 = 붙은 모양 알파, 초록 = 버튼 몫 알파인 불투명 그림을 낸다. 바깥 <g>에 WaterGlassFilter(gooShape)를 건다:
 * <g filter={유리}><g filter={물 모양}>모양들</g></g>. 영역은 바깥과 같게
 */
export function WaterGooShapeFilter({ id, region, k = 1 }: { id: string; region: WaterFilterRegion; k?: number }) {
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
      colorInterpolationFilters="sRGB"
    >
      {gooShapeOps(k)}
      <feColorMatrix in="shape" values="0 0 0 1 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="shapeR" />
      <feColorMatrix in="cshape" values="0 0 0 0 0  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1" result="cshapeG" />
      <feComposite in="shapeR" in2="cshapeG" operator="arithmetic" k2="1" k3="1" />
    </filter>
  )
}

/**
 * 유리 무늬 — 왼쪽 위 어두운 테두리(1.7·1.9px), 둘레 옅은 1px 선, 오른쪽 아래 흰 테두리(3.4px)와 번지는 빛,
 * 위쪽 안쪽 그림자(7·13px), 오른쪽 아래로 크게 떨어지는 그림자(21·44px, 27%)와 둘레 옅은 그림자.
 * 유리 몸은 바탕보다 조금(2.6%) 어둡다.
 *
 * CSS 유리(w-glass)와 바꿔 낄 때 — 크롬은 CSS 상자 높이를 장치 화소에 붙여(반올림) 그리고 transform은 소수
 * 자리 그대로(흐리게) 옮기는데, SVG 모양은 소수 자리 그대로 그린다. 바꿔 끼우는 순간의 모양(자리·높이)은 양쪽 다
 * 장치 화소에 붙여야 테두리가 반 화소 어긋나지 않는다(소수 자리면 테두리 줄이 40~70 다르다)
 */
export function WaterGlassFilter({
  id,
  region,
  k = 1,
  lift = 1,
  goo = false,
  gooShape = false,
  rim = 1,
  depth = 1,
  frost = 0,
}: WaterGlassFilterProps) {
  const s = k * lift * depth
  const seam = goo || gooShape
  // 떨어지는 그림자 — 깊이 0이면 없음
  const shadow = lift > 0 && depth > 0
  // 테두리 진하기(rim)·그림자 진하기(depth)를 곱한 불투명도(1을 넘지 않게)
  const edge = (a: number) => n(Math.min(1, a * rim))
  const drop = (a: number) => n(Math.min(1, a * Math.min(1, lift) * depth))
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
      colorInterpolationFilters="sRGB"
    >
      {gooShape ? (
        <>
          {/* 안 겹(WaterGooShapeFilter)이 낸 불투명 그림 — 빨강 = 모양, 초록 = 버튼 몫 */}
          <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="shape" />
          <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 1 0 0 0" result="cshape" />
        </>
      ) : goo ? (
        gooShapeOps(k)
      ) : (
        <feColorMatrix in="SourceAlpha" values={alpha(1)} result="shape" />
      )}

      {shadow && (
        <>
          <feGaussianBlur in="shape" stdDeviation={n(10 * s)} result="spread0" />
          <feComponentTransfer in="spread0" result="spread">
            <feFuncA
              type="linear"
              slope={n(spreadSlope(10 * s))}
              intercept={n(0.5 - spreadSlope(10 * s) * SPREAD_T)}
            />
          </feComponentTransfer>
          <feGaussianBlur in="spread" stdDeviation={n(18 * s)} result="spreadB" />
          <feOffset in="spreadB" dx={n(21 * s)} dy={n(44 * s)} result="far" />
          <feColorMatrix in="far" values={alpha(drop(0.27))} result="farC" />
          <feGaussianBlur in="shape" stdDeviation={n(12 * s)} result="nearC0" />
          <feColorMatrix in="nearC0" values={alpha(drop(0.13))} result="nearC" />
          <feMerge result="shadows">
            <feMergeNode in="farC" />
            <feMergeNode in="nearC" />
          </feMerge>
          <feComposite in="shadows" in2="shape" operator="out" result="shadowOut" />
        </>
      )}

      <feOffset in="shape" dx={n(7 * k)} dy={n(13 * k)} result="innerO" />
      <feGaussianBlur in="innerO" stdDeviation={n(8 * k)} result="innerB" />
      <feComposite in="shape" in2="innerB" operator="out" result="inner" />
      <feColorMatrix in="inner" values={alpha(edge(0.24))} result="innerC" />

      <feOffset in="shape" dx={n(1.7 * k)} dy={n(1.9 * k)} result="darkO" />
      <feComposite in="shape" in2="darkO" operator="out" result="darkA" />
      <feGaussianBlur in="darkA" stdDeviation={n(0.55 * k)} result="darkB" />
      <feComposite in="darkB" in2="shape" operator="in" result="dark" />
      <feColorMatrix in="dark" values={alpha(edge(0.62))} result="darkC" />
      <feMorphology in="shape" operator="erode" radius={n(Math.max(0.75, k))} result="thin" />
      <feComposite in="shape" in2="thin" operator="out" result="outline" />
      <feColorMatrix in="outline" values={alpha(edge(0.24))} result="outlineC" />

      <feOffset in="shape" dx={n(-3.4 * k)} dy={n(-3.4 * k)} result="whiteO" />
      <feComposite in="shape" in2="whiteO" operator="out" result="whiteA" />
      <feGaussianBlur in="whiteA" stdDeviation={n(0.7 * k)} result="whiteB" />
      <feComposite in="whiteB" in2="shape" operator="in" result="whiteIn" />
      <feColorMatrix in="whiteIn" values={white(edge(0.9))} result="whiteC" />
      <feOffset in="shape" dx={n(-2 * k)} dy={n(-5.5 * k)} result="softO" />
      <feComposite in="shape" in2="softO" operator="out" result="softA" />
      <feGaussianBlur in="softA" stdDeviation={n(1.4 * k)} result="softB" />
      <feComposite in="softB" in2="shape" operator="in" result="softIn" />
      <feColorMatrix in="softIn" values={white(edge(0.3))} result="softC" />
      {seam && (
        <>
          <feOffset in="cshape" dx={n(-3.4 * k)} dy={n(-3.4 * k)} result="seamO" />
          <feComposite in="cshape" in2="seamO" operator="out" result="seamA" />
          <feGaussianBlur in="seamA" stdDeviation={n(1.3 * k)} result="seamB" />
          <feComposite in="seamB" in2="shape" operator="in" result="seamIn" />
          <feColorMatrix in="seamIn" values={white(edge(0.5))} result="seamC" />
        </>
      )}
      <feColorMatrix in="shape" values={frost > 0 ? white(n(frost)) : alpha(0.026)} result="tint" />

      <feMerge>
        {shadow && <feMergeNode in="shadowOut" />}
        <feMergeNode in="tint" />
        <feMergeNode in="innerC" />
        <feMergeNode in="softC" />
        {seam && <feMergeNode in="seamC" />}
        <feMergeNode in="whiteC" />
        <feMergeNode in="outlineC" />
        <feMergeNode in="darkC" />
      </feMerge>
    </filter>
  )
}

/**
 * 홈(D7 track) — 유리 알약 안에 파인 길. 어두운 바닥(12%) + 위쪽 2px 진한 테두리(30%) + 둘레 1.4px 선(16%) +
 * 위쪽 안쪽 그림자(5%). 검은색으로 그린 모양에 건다.
 */
export function WaterGrooveFilter({ id, k = 1 }: { id: string; k?: number }) {
  return (
    <filter id={id} x="-20%" y="-60%" width="140%" height="220%" colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius={n(1.4 * k)} result="in" />
      <feComposite in="SourceAlpha" in2="in" operator="out" result="ring" />
      <feOffset in="SourceAlpha" dy={n(2 * k)} result="down" />
      <feComposite in="SourceAlpha" in2="down" operator="out" result="topRim" />
      <feOffset in="SourceAlpha" dy={n(5 * k)} result="down5" />
      <feGaussianBlur in="down5" stdDeviation={n(3 * k)} result="down5b" />
      <feComposite in="SourceAlpha" in2="down5b" operator="out" result="inset" />
      <feColorMatrix in="SourceAlpha" values={alpha(0.12)} result="fill" />
      <feColorMatrix in="ring" values={alpha(0.16)} result="ringC" />
      <feColorMatrix in="topRim" values={alpha(0.3)} result="topC" />
      <feColorMatrix in="inset" values={alpha(0.05)} result="insetC" />
      <feMerge>
        <feMergeNode in="fill" />
        <feMergeNode in="insetC" />
        <feMergeNode in="ringC" />
        <feMergeNode in="topC" />
      </feMerge>
    </filter>
  )
}

/**
 * 물방울 한 알(반지름 5.5 유리구슬, D7 liquid-drop) — 아래쪽 밝은 초승달, 왼쪽 위 반짝임, 옅게 어두운
 * 가장자리. SVG <g> 안에 넣는다(원점 = 방울 가운데).
 */
export function WaterBead() {
  return (
    <>
      <circle r="5.5" fill="#fff" fillOpacity="0.16" stroke="#2a282d" strokeOpacity="0.42" strokeWidth="0.9" />
      <path d="M-4.9 1.1A5 5 0 0 0 4.9 1.1A6.8 6.8 0 0 1-4.9 1.1Z" fill="#fff" fillOpacity="0.92" />
      <ellipse cx="-1.9" cy="-2.4" rx="1.6" ry="1.3" fill="#fff" fillOpacity="0.95" />
    </>
  )
}
