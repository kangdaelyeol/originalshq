import { NODES, SECTIONS } from './data'

// 신경망 평면의 좌표(평면 안의 px) — 카메라가 이 평면 전체를 원근으로 기울여
// 보여 준다. 섬유는 이웃한 기둥의 모든 카드를 잇는다 — 카드에서 나와 기둥 사이
// 세로줄로 휘어 들어가 꼬이며 오르내리다 다음 카드로 나가서, 세로줄마다 밝은
// 밧줄처럼 보인다. 간격은 영상에서 잰 비율(카드 사이 = 카드 폭의 32%).

export const CARD_W = 250
export const CARD_H = 104
export const OUT_W = 300
export const COL_STRIDE = 330
export const ROW_STRIDE = 134
export const X0 = 170
export const Y0 = 140
export const ROWS = 8
export const HEADER_Y = 46
export const WORLD_W = X0 + 4 * COL_STRIDE + OUT_W + 200
export const WORLD_H = Y0 + ROWS * ROW_STRIDE + 80

export const colX = (col: number) => X0 + col * COL_STRIDE
export const rowY = (row: number) => Y0 + row * ROW_STRIDE
/** 기둥 g와 g+1 사이 섬유가 모이는 세로줄. */
export const spineX = (gap: number) =>
  colX(gap) + CARD_W + (COL_STRIDE - CARD_W) / 2
export const colWidth = (col: number) => (col === 4 ? OUT_W : CARD_W)

export interface Pt {
  x: number
  y: number
}
export interface Rect extends Pt {
  w: number
  h: number
}
export interface Cubic {
  p0: Pt
  c1: Pt
  c2: Pt
  p3: Pt
}

interface Placed {
  col: number
  row: number
}

const PLACED = new Map<string, Placed>([
  ...NODES.map((n) => [n.id, { col: n.col, row: n.row }] as const),
  ...SECTIONS.map((s) => [s.id, { col: 4, row: s.row }] as const),
])

export const placeOf = (id: string) => PLACED.get(id)!

export const nodeRect = (id: string): Rect => {
  const { col, row } = placeOf(id)
  return { x: colX(col), y: rowY(row), w: colWidth(col), h: CARD_H }
}

/** 출력 노드(PROMPT) 전체 틀 — 8칸을 감싼다. */
export const OUT_RECT: Rect = {
  x: colX(4) - 10,
  y: rowY(0) - 12,
  w: OUT_W + 20,
  h: ROWS * ROW_STRIDE - (ROW_STRIDE - CARD_H) + 24,
}

const PORT_Y = 0.42

export const portOut = (id: string): Pt => {
  const r = nodeRect(id)
  return { x: r.x + r.w, y: r.y + r.h * PORT_Y }
}
export const portIn = (id: string): Pt => {
  const r = nodeRect(id)
  return { x: r.x, y: r.y + r.h * PORT_Y }
}

export const bezier = (c: Cubic, t: number): Pt => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const d = 3 * u * t * t
  const e = t * t * t
  return {
    x: a * c.p0.x + b * c.c1.x + d * c.c2.x + e * c.p3.x,
    y: a * c.p0.y + b * c.c1.y + d * c.c2.y + e * c.p3.y,
  }
}

/** 두 카드를 잇는 S자 곡선 — 기둥을 건너뛰거나 줄이 거의 같을 때. */
export const connector = (fromId: string, toId: string): Cubic => {
  const p0 = portOut(fromId)
  const p3 = portIn(toId)
  const span = placeOf(toId).col - placeOf(fromId).col
  if (span === 1) {
    const m = spineX(placeOf(fromId).col)
    return { p0, c1: { x: m, y: p0.y }, c2: { x: m, y: p3.y }, p3 }
  }
  const dx = p3.x - p0.x
  return {
    p0,
    c1: { x: p0.x + dx * 0.45, y: p0.y },
    c2: { x: p3.x - dx * 0.45, y: p3.y },
    p3,
  }
}

/** 곡선을 점으로. */
export const sample = (c: Cubic, n = 48): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => bezier(c, i / n))

/** 점을 이은 길 — 점마다 처음부터의 길이를 같이 둔다(빛 점이 고른 속도로 가게). */
export interface Path {
  pts: Pt[]
  len: number[]
  total: number
}

export const toPath = (pts: Pt[]): Path => {
  const len = [0]
  for (let i = 1; i < pts.length; i++)
    len.push(
      len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y),
    )
  return { pts, len, total: len[len.length - 1] }
}

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
  Array.from({ length: 9 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / 8
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })

const CORNER = 22
const pathCache = new Map<string, Path>()

/**
 * 켜진 경로의 길 — 이웃 기둥이면 카드 오른쪽 끝에서 나와 기둥 사이 세로줄을
 * 따라 오르내린 뒤(모서리는 둥글게) 다음 카드 왼쪽으로 들어간다. 같은 줄이면
 * 거의 곧게 간다.
 */
export const pathOf = (fromId: string, toId: string): Path => {
  const key = `${fromId}>${toId}`
  const hit = pathCache.get(key)
  if (hit) return hit
  const p0 = portOut(fromId)
  const p3 = portIn(toId)
  const dy = p3.y - p0.y
  let path: Path
  if (
    placeOf(toId).col - placeOf(fromId).col !== 1 ||
    Math.abs(dy) < CORNER * 2 + 4
  ) {
    path = toPath(sample(connector(fromId, toId), 40))
  } else {
    const m = spineX(placeOf(fromId).col)
    const s = Math.sign(dy)
    const r = CORNER
    path = toPath([
      p0,
      ...arc(m - r, p0.y + s * r, r, (-s * Math.PI) / 2, 0),
      ...arc(m + r, p3.y - s * r, r, Math.PI, Math.PI - (s * Math.PI) / 2),
      p3,
    ])
  }
  pathCache.set(key, path)
  return path
}

/** 길 위에서 처음부터 u(0~1)만큼 간 자리. */
export const pointAt = (path: Path, u: number): Pt => {
  const target = Math.min(1, Math.max(0, u)) * path.total
  const { pts, len } = path
  let i = 1
  while (i < len.length - 1 && len[i] < target) i++
  const seg = len[i] - len[i - 1] || 1
  const k = Math.min(1, Math.max(0, (target - len[i - 1]) / seg))
  return {
    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k,
    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k,
  }
}

// ── 섬유 ────────────────────────────────────────────────────────────────

/** 같은 모양이 매번 나오게 — 씨앗 고정 난수. */
export const rng = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export interface Strand {
  path: Path
  /** 어느 기둥 사이인지(-1이면 두 기둥을 건너는 긴 선). */
  gap: number
  color: string
  alpha: number
  width: number
}

export interface Knot extends Pt {
  r: number
  alpha: number
}

const STRAND_TINTS: [string, number][] = [
  ['#ffffff', 0.68],
  ['#8fe3ff', 0.12],
  ['#ff7ab6', 0.1],
  ['#a99bff', 0.1],
]

const pick = (r: () => number, list: [string, number][]) => {
  let x = r()
  for (const [v, w] of list) {
    if ((x -= w) <= 0) return v
  }
  return list[0][0]
}

const columnIds = (col: number) =>
  col === 4
    ? SECTIONS.map((s) => s.id)
    : NODES.filter((n) => n.col === col).map((n) => n.id)

/** 섬유 한 가닥 — 카드 오른쪽에서 나와 세로줄로 휘어 들어가, 조금씩 꼬이며
 * 오르내리다 다음 카드 왼쪽으로 나간다. */
const braid = (a: Pt, b: Pt, m: number, r: () => number): Pt[] => {
  const dy = b.y - a.y
  const s = Math.sign(dy) || 1
  const bend = Math.min(Math.abs(dy) / 2, 16 + r() * 30)
  const xm = m + (r() - 0.5) * 14
  const amp = 3 + r() * 11
  const wave = 70 + r() * 170
  const phase = r() * Math.PI * 2
  const y0 = a.y + s * bend
  const y1 = b.y - s * bend
  const pts = sample(
    {
      p0: a,
      c1: { x: xm - 4, y: a.y },
      c2: { x: xm, y: a.y + s * bend * 0.3 },
      p3: { x: xm, y: y0 },
    },
    10,
  )
  const n = Math.max(2, Math.ceil(Math.abs(y1 - y0) / 12))
  for (let i = 1; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / n
    const env = Math.sin((Math.PI * i) / n)
    pts.push({
      x: xm + amp * env * Math.sin((y / wave) * Math.PI * 2 + phase),
      y,
    })
  }
  pts.push(
    ...sample(
      {
        p0: { x: xm, y: y1 },
        c1: { x: xm, y: b.y - s * bend * 0.3 },
        c2: { x: xm + 4, y: b.y },
        p3: b,
      },
      10,
    ),
  )
  return pts
}

const build = () => {
  const r = rng(20261031)
  const strands: Strand[] = []
  const wisps: Strand[] = []
  const knots: Knot[] = []
  for (let gap = 0; gap < 4; gap++) {
    const m0 = spineX(gap)
    for (const a of columnIds(gap)) {
      for (const b of columnIds(gap + 1)) {
        const count = r() < 0.4 ? 2 : 1
        for (let k = 0; k < count; k++) {
          const from = portOut(a)
          const to = portIn(b)
          const color = pick(r, STRAND_TINTS)
          strands.push({
            gap,
            color,
            alpha: (color === '#ffffff' ? 0.06 : 0.08) + r() * 0.12,
            width: 0.5 + r() * 0.9,
            path: toPath(
              braid(
                { x: from.x - r() * 6, y: from.y + (r() - 0.5) * 50 },
                { x: to.x + r() * 6, y: to.y + (r() - 0.5) * 50 },
                m0,
                r,
              ),
            ),
          })
        }
      }
    }
    // 흩어지는 가닥 — 세로줄에서 옆으로 휘어 나간다.
    for (let i = 0; i < 34; i++) {
      const y = rowY(0) - 40 + r() * (ROWS * ROW_STRIDE + 40)
      const side = r() < 0.5 ? -1 : 1
      const reach = 24 + r() * 90
      const drop = (r() - 0.5) * 260
      wisps.push({
        gap,
        color: pick(r, STRAND_TINTS),
        alpha: 0.06 + r() * 0.16,
        width: 0.5 + r() * 0.7,
        path: toPath(
          sample(
            {
              p0: { x: m0 + (r() - 0.5) * 8, y },
              c1: { x: m0 + side * reach * 0.2, y: y + drop * 0.5 },
              c2: { x: m0 + side * reach, y: y + drop * 0.6 },
              p3: { x: m0 + side * reach * (0.8 + r() * 0.6), y: y + drop },
            },
            24,
          ),
        ),
      })
    }
    // 매듭 — 세로줄 위의 밝은 점.
    for (let i = 0; i < 26; i++) {
      knots.push({
        x: m0 + (r() - 0.5) * 12,
        y: rowY(0) - 20 + r() * (ROWS * ROW_STRIDE),
        r: 1 + r() * 1.6,
        alpha: 0.5 + r() * 0.5,
      })
    }
  }
  // 긴 색선 — 두 기둥 너머로 가로지르는 연결(영상의 분홍·청록 대각선).
  const all = NODES.map((x) => x.id)
  for (let i = 0; i < 26; i++) {
    const a = all[Math.floor(r() * all.length)]
    const col = placeOf(a).col
    if (col > 1) continue
    const targets = columnIds(col + 2)
    const b = targets[Math.floor(r() * targets.length)]
    const from = portOut(a)
    const to = portIn(b)
    wisps.push({
      gap: -1,
      color: pick(r, [
        ['#ff6fa8', 0.35],
        ['#5fe0d8', 0.3],
        ['#a99bff', 0.2],
        ['#f2d36b', 0.15],
      ]),
      alpha: 0.12 + r() * 0.2,
      width: 0.6 + r() * 0.5,
      path: toPath(
        sample(
          {
            p0: from,
            c1: {
              x: from.x + (to.x - from.x) * 0.35,
              y: from.y + (r() - 0.5) * 120,
            },
            c2: {
              x: from.x + (to.x - from.x) * 0.7,
              y: to.y + (r() - 0.5) * 120,
            },
            p3: to,
          },
          40,
        ),
      ),
    })
  }
  return { strands, wisps, knots }
}

export const FIBERS = build()

/** 기둥 사이마다의 섬유(빛기둥으로 다시 칠할 때). */
export const STRANDS_BY_GAP = [0, 1, 2, 3].map((g) =>
  FIBERS.strands.filter((s) => s.gap === g),
)

export { columnIds }
