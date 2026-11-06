// 차트 선 — 단조 3차 보간(d3 curveMonotoneX와 같은 Fritsch–Carlson). 영상 12M 선이 9~10월에 평평하게
// 붙어 있고(186.4~186.8) 넘치지 않아서 이 곡선으로 골랐다.

export type Pt = readonly [number, number]

function slopes(pts: readonly Pt[]) {
  const n = pts.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  const m: number[] = new Array(n).fill(0)
  m[0] = d[0] ?? 0
  m[n - 1] = d[n - 2] ?? 0
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0
    else {
      const h0 = pts[i][0] - pts[i - 1][0]
      const h1 = pts[i + 1][0] - pts[i][0]
      // 가중 조화 평균(d3 monotoneX)
      const p = (d[i - 1] * h1 + d[i] * h0) / (h0 + h1)
      m[i] = (Math.sign(d[i - 1]) + Math.sign(d[i])) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p))
    }
  }
  return m
}

const r = (v: number) => Math.round(v * 100) / 100

/** 점들을 지나는 부드러운 선(SVG path d) */
export function monotonePath(pts: readonly Pt[]) {
  if (pts.length === 0) return ''
  const m = slopes(pts)
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = (x1 - x0) / 3
    d += `C${r(x0 + h)},${r(y0 + m[i] * h)} ${r(x1 - h)},${r(y1 - m[i + 1] * h)} ${r(x1)},${r(y1)}`
  }
  return d
}

/** 선 아래 면(바닥 y까지 닫는다) */
export function areaPath(pts: readonly Pt[], baseY: number) {
  if (pts.length === 0) return ''
  return `${monotonePath(pts)}L${r(pts[pts.length - 1][0])},${baseY}L${r(pts[0][0])},${baseY}Z`
}

/** 값들을 판 안 좌표로 — x0~x1에 고르게, 0~top을 bottom~topY로 */
export function toPoints(
  values: readonly number[],
  box: { x0: number; x1: number; topY: number; baseY: number; top: number },
) {
  const n = values.length
  return values.map((v, i): Pt => [
    box.x0 + (n === 1 ? 0 : (i * (box.x1 - box.x0)) / (n - 1)),
    box.baseY - (Math.max(0, v) / box.top) * (box.baseY - box.topY),
  ])
}
