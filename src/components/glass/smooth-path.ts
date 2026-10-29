/**
 * 점들을 지나는 부드러운 곡선(SVG path) — 단조 3차 보간(monotone cubic,
 * Fritsch–Carlson). 두 점 사이에서 곡선이 두 점의 값보다 위·아래로 넘치지
 * 않아서, 없던 봉우리나 0 아래로 꺼지는 모양을 만들지 않는다.
 */
export const smoothPath = (pts: [number, number][]): string => {
  if (pts.length === 0) return ''
  if (pts.length < 3) {
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  }
  const n = pts.length
  const dx = pts.slice(1).map(([x], i) => x - pts[i][0])
  const slope = pts.slice(1).map(([, y], i) => (y - pts[i][1]) / dx[i])
  // 점마다 기울기 — 양옆 기울기의 부호가 다르면(봉우리·골) 0으로 평평하게.
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0]
    if (i === n - 1) return slope[n - 2]
    const [a, b] = [slope[i - 1], slope[i]]
    if (a * b <= 0) return 0
    const [h0, h1] = [dx[i - 1], dx[i]]
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b)
  })
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = dx[i] / 3
    d += ` C${x0 + h},${y0 + tangent[i] * h} ${x1 - h},${y1 - tangent[i + 1] * h} ${x1},${y1}`
  }
  return d
}
