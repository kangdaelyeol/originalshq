/**
 * 물방울 한 알(Design 7) — 반지름 5.5의 작은 유리구슬(F244: 지름 11px).
 * 아래쪽에 밝은 초승달, 왼쪽 위에 반짝임, 가장자리는 옅게 어둡다. 튀는 방울은 이걸 줄여 쓴다.
 * SVG <g> 안에 넣어 쓴다(원점 = 방울 가운데).
 */
export function LiquidDropShape() {
  return (
    <>
      <circle r="5.5" fill="#fff" fillOpacity="0.16" stroke="#2a282d" strokeOpacity="0.42" strokeWidth="0.9" />
      <path d="M-4.9 1.1A5 5 0 0 0 4.9 1.1A6.8 6.8 0 0 1-4.9 1.1Z" fill="#fff" fillOpacity="0.92" />
      <ellipse cx="-1.9" cy="-2.4" rx="1.6" ry="1.3" fill="#fff" fillOpacity="0.95" />
    </>
  )
}
