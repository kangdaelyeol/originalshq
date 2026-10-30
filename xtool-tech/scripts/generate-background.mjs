// 배경 이미지 생성기 — 샘플 영상의 "검은 파편 타일" 사진 대신 쓰는 SVG를 만든다.
// 직사각형을 무작위 직선으로 계속 잘라 볼록 다각형 조각을 만들고, 조각마다
// 기울기(빛을 받는 정도)에 따라 명암·광택·하이라이트 엣지를 준다. 시드가
// 고정이라 다시 돌려도 같은 그림이 나온다.
//   npm run gen:bg  →  public/bg-shards.svg
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const W = 2400
const H = 1500
const SEED = 20261030
const OUT = fileURLToPath(new URL('../public/bg-shards.svg', import.meta.url))

// 조각 사이 틈(검은 균열) 폭 범위(px).
const GAP_MIN = 2.5
const GAP_MAX = 5
// 빛 방향 — 화면 왼쪽 위 앞쪽에서 비춘다(y는 아래로 증가).
const LIGHT_3D = normalize([-0.42, -0.7, 0.58])
const LIGHT_2D = normalize([-0.45, -1])

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const range = (min, max) => min + rand() * (max - min)

function normalize(v) {
  const len = Math.hypot(...v) || 1
  return v.map((x) => x / len)
}

/** 부호 있는 넓이(신발끈 공식) — 부호로 꼭짓점 방향을 안다. */
function signedArea(poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

function centroid(poly) {
  const n = poly.length
  return [
    poly.reduce((s, p) => s + p[0], 0) / n,
    poly.reduce((s, p) => s + p[1], 0) / n,
  ]
}

/** 볼록 다각형을 반평면 dot(p - p0, n) >= 0 으로 자른다(Sutherland–Hodgman 한 번). */
function clip(poly, p0, n) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = (a[0] - p0[0]) * n[0] + (a[1] - p0[1]) * n[1]
    const db = (b[0] - p0[0]) * n[0] + (b[1] - p0[1]) * n[1]
    if (da >= 0) out.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

/** 볼록 다각형을 안쪽으로 d만큼 줄인다 — 각 변을 안쪽으로 민 반평면들로 다시
 * 자르는 방식이라, 너무 작아 사라지면 null을 돌려준다. */
function inset(poly, d) {
  const sign = Math.sign(signedArea(poly)) || 1
  let out = poly
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const n = [(-dy / len) * sign, (dx / len) * sign]
    out = clip(out, [a[0] + n[0] * d, a[1] + n[1] * d], n)
    if (out.length < 3) return null
  }
  return Math.abs(signedArea(out)) < 300 ? null : out
}

function isConvex(poly) {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    const [cx, cy] = poly[(i + 2) % poly.length]
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (Math.abs(cross) < 1e-9) continue
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  return true
}

/** 꼭짓점을 흔든 격자 — 한 번에 캔버스 전체를 자르면 끝까지 이어지는 직선 균열이
 * 생겨 인위적으로 보여서, 먼저 비뚤어진 칸으로 나눈 뒤 칸 안에서만 자른다. */
function jitteredCells(cols, rows, margin) {
  const cw = (W + margin * 2) / cols
  const ch = (H + margin * 2) / rows
  const pts = []
  for (let r = 0; r <= rows; r++) {
    pts.push([])
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols
      const edgeY = r === 0 || r === rows
      pts[r].push([
        -margin + c * cw + (edgeX ? 0 : range(-0.28, 0.28) * cw),
        -margin + r * ch + (edgeY ? 0 : range(-0.28, 0.28) * ch),
      ])
    }
  }
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const quad = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]]
      // 흔들다 오목해진 칸은 대각선으로 나눠 볼록한 삼각형 둘로 만든다(clip·inset이 볼록 전제).
      if (isConvex(quad)) cells.push(quad)
      else cells.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]])
    }
  }
  return cells
}

/** 캔버스를 조각낸다 — 큰 조각일수록 더 잘게 쪼개질 확률이 높고, 자르는 선은
 * 조각의 긴 축을 가로지르게 기울여 너무 가는 조각이 덜 생기게 한다. */
function shatter() {
  const queue = jitteredCells(8, 5, 60)
  const shards = []
  while (queue.length > 0) {
    const poly = queue.pop()
    const area = Math.abs(signedArea(poly))
    const keep =
      area < 6000 ||
      (area < 26000 && rand() < 0.45) ||
      (area < 60000 && rand() < 0.16)
    if (keep) {
      shards.push(poly)
      continue
    }

    const xs = poly.map((p) => p[0])
    const ys = poly.map((p) => p[1])
    const wide = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys)
    const angle = (wide ? 0 : Math.PI / 2) + range(-0.65, 0.65)
    const n = [Math.cos(angle), Math.sin(angle)]
    const [cx, cy] = centroid(poly)
    const jitter = Math.sqrt(area) * 0.22
    const p0 = [cx + range(-jitter, jitter), cy + range(-jitter, jitter)]

    const a = clip(poly, p0, n)
    const b = clip(poly, p0, [-n[0], -n[1]])
    if (a.length < 3 || b.length < 3) shards.push(poly)
    else queue.push(a, b)
  }
  return shards
}

const f = (n) => Math.round(n * 10) / 10
const gray = (l, tint = 0) =>
  `rgb(${Math.round(l)},${Math.round(l + tint * 0.4)},${Math.round(l + tint)})`
const pathOf = (poly) =>
  `M${poly.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`

function render(shards) {
  const defs = []
  const faces = []
  const edges = []

  shards.forEach((poly, i) => {
    const shard = inset(poly, range(GAP_MIN, GAP_MAX))
    if (!shard) return

    // 조각마다 살짝 기운 면 — 빛을 정면으로 받을수록 밝다.
    const normal = normalize([range(-0.75, 0.75), range(-0.75, 0.75), 1])
    const facing = Math.max(0, normal.reduce((s, v, k) => s + v * LIGHT_3D[k], 0))
    const base = 9 + 30 * facing ** 1.8 + range(-3, 3)
    const glossy = rand() < 0.17
    const tint = range(1, 5)

    // 면 안의 그라데이션 — 기울어진 쪽으로 어두워지고, 광택 조각은 한쪽에 밝은 반사가 걸린다.
    const angle = Math.atan2(normal[1], normal[0]) + Math.PI
    const c = Math.cos(angle) / 2
    const s = Math.sin(angle) / 2
    const id = `g${i}`
    const stops = glossy
      ? `<stop offset="0" stop-color="${gray(base + range(60, 95), tint)}"/><stop offset=".35" stop-color="${gray(base + 14, tint)}"/><stop offset="1" stop-color="${gray(base - 4, tint)}"/>`
      : `<stop offset="0" stop-color="${gray(base + 9, tint)}"/><stop offset="1" stop-color="${gray(Math.max(4, base - 7), tint)}"/>`
    defs.push(
      `<linearGradient id="${id}" x1="${f(0.5 - c)}" y1="${f(0.5 - s)}" x2="${f(0.5 + c)}" y2="${f(0.5 + s)}">${stops}</linearGradient>`,
    )
    faces.push(`<path d="${pathOf(shard)}" fill="url(#${id})"/>`)

    // 빛을 향한 변에만 얇은 하이라이트 — 조각 가장자리의 베벨이 빛을 받는 느낌.
    const sign = Math.sign(signedArea(shard)) || 1
    for (let k = 0; k < shard.length; k++) {
      const a = shard[k]
      const b = shard[(k + 1) % shard.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len = Math.hypot(dx, dy)
      if (len < 14) continue
      // 바깥쪽 법선 = 안쪽 법선의 반대.
      const out = [(dy / len) * sign, (-dx / len) * sign]
      const lit = out[0] * LIGHT_2D[0] + out[1] * LIGHT_2D[1]
      const d = `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`
      if (lit >= 0.3) {
        const alpha = Math.min(0.85, (0.08 + 0.6 * lit ** 2) * (glossy ? 1.4 : 1) * range(0.5, 1.1))
        edges.push(
          `<path d="${d}" stroke="#fff" stroke-opacity="${f(alpha * 100) / 100}" stroke-width="${f(range(1, 2.2))}"/>`,
        )
      } else if (lit <= -0.35) {
        // 빛 반대쪽 변은 안쪽 가장자리를 어둡게 — 조각이 두께를 가진 것처럼 보인다.
        edges.push(
          `<path d="${d}" stroke="#000" stroke-opacity="${f(range(0.35, 0.6) * 100) / 100}" stroke-width="${f(range(2.5, 4))}"/>`,
        )
      }
    }
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">`,
    `<defs>${defs.join('')}</defs>`,
    `<rect width="${W}" height="${H}" fill="#040405"/>`,
    `<g>${faces.join('')}</g>`,
    `<g stroke-linecap="round" fill="none">${edges.join('')}</g>`,
    `</svg>`,
  ].join('\n')
}

const shards = shatter()
const svg = render(shards)
writeFileSync(OUT, svg)
console.log(`bg-shards.svg: 조각 ${shards.length}개, ${(svg.length / 1024).toFixed(0)}KB`)
