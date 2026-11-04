/** 요소의 CSS px 폭(소수까지) — offsetWidth·clientWidth는 정수로 반올림돼 0.5px까지 어긋난다 */
export const cssWidth = (el: Element): number => parseFloat(getComputedStyle(el).width) || 0

/**
 * 기준 요소의 화면 배율 — 조상의 zoom·transform까지. getBoundingClientRect(소수, 배율 곱함)를 이 값으로 나누면
 * 기준 요소 안의 CSS px가 된다. ResizeObserver 콜백·효과에서만 부른다(rAF 안에서는 읽지 않는다).
 */
export function layoutScale(root: Element): number {
  const css = cssWidth(root)
  const seen = root.getBoundingClientRect().width
  return css > 0 && seen > 0 ? seen / css : 1
}

/** el의 테두리 상자를 root 왼쪽 위 기준 CSS px로(소수까지) */
export function boxWithin(el: Element, root: Element, scale = layoutScale(root)) {
  const r = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  return { x: (r.x - b.x) / scale, y: (r.y - b.y) / scale, width: r.width / scale, height: r.height / scale }
}
