// 블랙 파편 그림의 모양 — 웹 src/ohq-ui/backgrounds/generate-shards.mjs(→ public/xtool-tech/bg-shards.svg)를 그대로
// 옮겼다. 시드가 같고 난수를 같은 차례로 꺼내므로 웹 SVG와 같은 조각·같은 색이 나온다(좌표는 SVG처럼 0.1 단위로
// 반올림). 웹은 미리 만든 SVG 파일을 쓰지만, 앱은 처음 한 번 계산해 Skia로 그린다(SVG 194KB를 묶지 않으려고).

export const SHARDS_W = 2400;
export const SHARDS_H = 1500;
const SEED = 20261030;

const GAP_MIN = 2.5;
const GAP_MAX = 5;

type Pt = [number, number];
type Poly = Pt[];

function normalize(v: number[]): number[] {
  const len = Math.hypot(...v) || 1;
  return v.map(x => x / len);
}

const LIGHT_3D = normalize([-0.42, -0.7, 0.58]);
const LIGHT_2D = normalize([-0.45, -1]);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function signedArea(poly: Poly): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

function centroid(poly: Poly): Pt {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

function clip(poly: Poly, p0: Pt, n: number[]): Poly {
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a[0] - p0[0]) * n[0] + (a[1] - p0[1]) * n[1];
    const db = (b[0] - p0[0]) * n[0] + (b[1] - p0[1]) * n[1];
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function inset(poly: Poly, d: number): Poly | null {
  const sign = Math.sign(signedArea(poly)) || 1;
  let out = poly;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const n = [(-dy / len) * sign, (dx / len) * sign];
    out = clip(out, [a[0] + n[0] * d, a[1] + n[1] * d], n);
    if (out.length < 3) return null;
  }
  return Math.abs(signedArea(out)) < 300 ? null : out;
}

function isConvex(poly: Poly): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const [cx, cy] = poly[(i + 2) % poly.length];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

const f = (n: number) => Math.round(n * 10) / 10;
const gray = (l: number, tint: number) => {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(l)}${c(l + tint * 0.4)}${c(l + tint)}`;
};

/** 조각 면 하나 — 꼭짓점(0.1 반올림)과 objectBoundingBox 선형 그라데이션 */
export interface ShardFace {
  points: Pt[];
  /** 꼭짓점 상자 — 그라데이션 단위 상자·화면 밖 거르기 */
  box: { x: number; y: number; w: number; h: number };
  /** 단위 상자 안 그라데이션 시작·끝 */
  from: Pt;
  to: Pt;
  colors: string[];
  positions: number[];
}

/** 조각 가장자리 선 하나 — 빛 쪽은 흰 선, 반대쪽은 검은 선 */
export interface ShardEdge {
  from: Pt;
  to: Pt;
  white: boolean;
  opacity: number;
  width: number;
}

export interface ShardsData {
  faces: ShardFace[];
  edges: ShardEdge[];
}

function generate(): ShardsData {
  const rand = mulberry32(SEED);
  const range = (min: number, max: number) => min + rand() * (max - min);

  const jitteredCells = (cols: number, rows: number, margin: number): Poly[] => {
    const cw = (SHARDS_W + margin * 2) / cols;
    const ch = (SHARDS_H + margin * 2) / rows;
    const pts: Pt[][] = [];
    for (let r = 0; r <= rows; r++) {
      pts.push([]);
      for (let c = 0; c <= cols; c++) {
        const edgeX = c === 0 || c === cols;
        const edgeY = r === 0 || r === rows;
        const x = -margin + c * cw + (edgeX ? 0 : range(-0.28, 0.28) * cw);
        const y = -margin + r * ch + (edgeY ? 0 : range(-0.28, 0.28) * ch);
        pts[r].push([x, y]);
      }
    }
    const cells: Poly[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const quad: Poly = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]];
        if (isConvex(quad)) cells.push(quad);
        else cells.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]);
      }
    }
    return cells;
  };

  // 조각내기(웹 shatter) — 난수를 꺼내는 차례까지 같게(&&의 짧은 계산 포함)
  const queue = jitteredCells(8, 5, 60);
  const shards: Poly[] = [];
  while (queue.length > 0) {
    const poly = queue.pop() as Poly;
    const area = Math.abs(signedArea(poly));
    const keep = area < 6000 || (area < 26000 && rand() < 0.45) || (area < 60000 && rand() < 0.16);
    if (keep) {
      shards.push(poly);
      continue;
    }
    const xs = poly.map(p => p[0]);
    const ys = poly.map(p => p[1]);
    const wide = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
    const angle = (wide ? 0 : Math.PI / 2) + range(-0.65, 0.65);
    const n = [Math.cos(angle), Math.sin(angle)];
    const [cx, cy] = centroid(poly);
    const jitter = Math.sqrt(area) * 0.22;
    const px = cx + range(-jitter, jitter);
    const py = cy + range(-jitter, jitter);
    const a = clip(poly, [px, py], n);
    const b = clip(poly, [px, py], [-n[0], -n[1]]);
    if (a.length < 3 || b.length < 3) shards.push(poly);
    else queue.push(a, b);
  }

  // 칠하기(웹 render)
  const faces: ShardFace[] = [];
  const edges: ShardEdge[] = [];
  for (const poly of shards) {
    const shard = inset(poly, range(GAP_MIN, GAP_MAX));
    if (!shard) continue;
    const normal = normalize([range(-0.75, 0.75), range(-0.75, 0.75), 1]);
    const facing = Math.max(
      0,
      normal.reduce((s, v, k) => s + v * LIGHT_3D[k], 0),
    );
    const base = 9 + 30 * facing ** 1.8 + range(-3, 3);
    const glossy = rand() < 0.17;
    const tint = range(1, 5);
    const angle = Math.atan2(normal[1], normal[0]) + Math.PI;
    const c = Math.cos(angle) / 2;
    const s = Math.sin(angle) / 2;
    const colors = glossy
      ? [gray(base + range(60, 95), tint), gray(base + 14, tint), gray(base - 4, tint)]
      : [gray(base + 9, tint), gray(Math.max(4, base - 7), tint)];
    const points = shard.map(([x, y]) => [f(x), f(y)] as Pt);
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    faces.push({
      points,
      box: { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 },
      from: [f(0.5 - c), f(0.5 - s)],
      to: [f(0.5 + c), f(0.5 + s)],
      colors,
      positions: glossy ? [0, 0.35, 1] : [0, 1],
    });

    const sign = Math.sign(signedArea(shard)) || 1;
    for (let k = 0; k < shard.length; k++) {
      const a = shard[k];
      const b = shard[(k + 1) % shard.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 14) continue;
      const out = [(dy / len) * sign, (-dx / len) * sign];
      const lit = out[0] * LIGHT_2D[0] + out[1] * LIGHT_2D[1];
      const from: Pt = [f(a[0]), f(a[1])];
      const to: Pt = [f(b[0]), f(b[1])];
      if (lit >= 0.3) {
        const alpha = Math.min(0.85, (0.08 + 0.6 * lit ** 2) * (glossy ? 1.4 : 1) * range(0.5, 1.1));
        const width = f(range(1, 2.2));
        edges.push({ from, to, white: true, opacity: f(alpha * 100) / 100, width });
      } else if (lit <= -0.35) {
        const opacity = f(range(0.35, 0.6) * 100) / 100;
        const width = f(range(2.5, 4));
        edges.push({ from, to, white: false, opacity, width });
      }
    }
  }
  return { faces, edges };
}

let cache: ShardsData | null = null;

/** 조각 그림 데이터 — 처음 부를 때 한 번 계산한다(조각 351개) */
export function shardsData(): ShardsData {
  cache ??= generate();
  return cache;
}
