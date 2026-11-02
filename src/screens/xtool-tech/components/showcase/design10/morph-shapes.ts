// 모핑 모양 — 영상 F1~F60의 윤곽을 중심(532, 677.6)에서 1°마다 반지름으로 재서 맞췄다. 단위는 영상 px.
// 세 모양을 같은 개수의 점으로 두고 점끼리 직선으로 섞는다. 원·X는 같은 각도에 점을 두고(원→X 구간은
// 반지름만 섞여 오차 0.1px), 별은 윤곽을 따라 같은 길이마다 점을 둔다 — X→별, 별→원 구간의 가운데
// 모양(F30 꽃잎 8개, F50 마름모)이 이 대응일 때만 맞는다(각도 대응이면 4.8px 어긋남).

export type MorphShapeName = 'circle' | 'clover' | 'star'
type Pt = readonly [number, number]

/** 점 개수 — 4의 배수(사분면마다 같게) */
export const MORPH_POINTS = 360

/** 원 — F1 반지름 61.47 */
const CIRCLE_R = 61.47

/** X(네 잎) — F20 푸리에: r = 56.37 − 22.03·cos4θ − 11.07·cos8θ. 잎 끝이 살짝 패인다(45°에서 67.3, 30°·60°에서 72.9). */
function cloverR(th: number) {
  return 56.37 - 22.03 * Math.cos(4 * th) - 11.07 * Math.cos(8 * th)
}

/** 별(네 꼭지) — F39 윤곽을 사분면마다 3차 베지어 하나로 맞춤(오차 0.07px): 꼭지 73.5, 대각선 30.5 */
const STAR_QUADRANT: readonly Pt[] = [
  [73.5, 0],
  [2.5, 30.5],
  [30.5, 2.5],
  [0, 73.5],
]

function bezier(p: readonly Pt[], u: number): Pt {
  const a = (1 - u) ** 3
  const b = 3 * u * (1 - u) ** 2
  const c = 3 * u * u * (1 - u)
  const d = u ** 3
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]
}

function polar(n: number, r: (th: number) => number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const th = (2 * Math.PI * i) / n
    return [r(th) * Math.cos(th), r(th) * Math.sin(th)] as const
  })
}

// 한 사분면 곡선을 촘촘히 잘라 길이를 누적한 뒤 같은 길이 간격으로 점을 고르고, 90°씩 돌려 나머지를 채운다.
function starPoints(n: number): Pt[] {
  const fine = 2000
  const pts = Array.from({ length: fine + 1 }, (_, i) => bezier(STAR_QUADRANT, i / fine))
  const len = [0]
  for (let i = 1; i <= fine; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = len[fine]
  const quarter = n / 4
  const q: Pt[] = []
  let k = 0
  for (let j = 0; j < quarter; j++) {
    const target = (total * j) / quarter
    while (len[k + 1] < target) k++
    const f = (target - len[k]) / (len[k + 1] - len[k] || 1)
    q.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f])
  }
  const out: Pt[] = []
  for (let r = 0; r < 4; r++) {
    for (const [x, y] of q) {
      // (x, y)를 90°·r 돌린다
      out.push(r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x])
    }
  }
  return out
}

export const MORPH_SHAPES: Record<MorphShapeName, readonly Pt[]> = {
  circle: polar(MORPH_POINTS, () => CIRCLE_R),
  clover: polar(MORPH_POINTS, cloverR),
  star: starPoints(MORPH_POINTS),
}

/** 영상 순서: 원 → X → 별 → (다시 원) */
export const MORPH_DEFAULT_SHAPES: readonly MorphShapeName[] = ['circle', 'clover', 'star']

/**
 * 각 모양에 다다르는 시각(초, 한 바퀴 2초). 구간마다 easeInOutSine — 반지름 변화를 맞춰 보니
 * 세 구간 모두 사인 이징이 가장 잘 맞았다(오차 0.003): 원→X F0.9→F20.1, X→별 F20.1→F38.4, 별→원 F38.4→F60.9.
 */
export const MORPH_DEFAULT_STOPS: readonly number[] = [0, 0.637, 1.247]

const easeInOutSine = (u: number) => (1 - Math.cos(Math.PI * u)) / 2

/** t초의 윤곽 path(d) — 마지막 모양 다음엔 첫 모양으로 돌아간다. */
export function morphPath(shapes: readonly MorphShapeName[], stops: readonly number[], t: number, period = 2) {
  const n = shapes.length
  let from = n - 1
  for (let i = 0; i < n; i++) if (t >= stops[i]) from = i
  const to = (from + 1) % n
  const wrapped = t < stops[0]
  const start = wrapped ? stops[n - 1] - period : stops[from]
  const end = wrapped ? stops[0] : from === n - 1 ? stops[0] + period : stops[to]
  const s = easeInOutSine(Math.min(1, Math.max(0, (t - start) / (end - start))))
  const a = MORPH_SHAPES[shapes[from]]
  const b = MORPH_SHAPES[shapes[to]]
  let d = ''
  for (let i = 0; i < a.length; i++) {
    const x = a[i][0] + (b[i][0] - a[i][0]) * s
    const y = a[i][1] + (b[i][1] - a[i][1]) * s
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${d}Z`
}
