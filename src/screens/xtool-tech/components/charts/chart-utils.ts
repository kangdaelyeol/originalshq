type Point = readonly [number, number]

const r1 = (n: number): number => Math.round(n * 10) / 10

/** 단조 3차 곡선(d3 curveMonotoneX와 같은 기울기 규칙) — 점 사이에서 위아래로 튀지 않아
 * 0 아래로 내려가거나 없던 봉우리가 생기지 않는다. */
export function monotonePath(points: readonly Point[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${r1(points[0][0])},${r1(points[0][1])}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0])
    slope.push((points[i + 1][1] - points[i][1]) / dx[i])
  }

  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1]
    const s1 = slope[i]
    const p = (s0 * dx[i] + s1 * dx[i - 1]) / (dx[i - 1] + dx[i])
    tangent.push((Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0)
  }
  tangent.push(slope[n - 2])

  let d = `M${r1(points[0][0])},${r1(points[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    d += ` C${r1(x0 + h)},${r1(y0 + h * tangent[i])} ${r1(x1 - h)},${r1(y1 - h * tangent[i + 1])} ${r1(x1)},${r1(y1)}`
  }
  return d
}

/** 0부터 시작하는 깔끔한 눈금 — 간격은 1·2·2.5·5 × 10^k. integer면 간격을 1 이상으로. */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (!(max > 0)) return [0, 1]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / magnitude
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude
  if (integer) step = Math.max(1, Math.ceil(step))
  const steps = Math.ceil(max / step - 1e-9)
  return Array.from({ length: steps + 1 }, (_, i) => Number((i * step).toPrecision(12)))
}
