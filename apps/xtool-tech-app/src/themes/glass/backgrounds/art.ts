import {
  BlendMode,
  ClipOp,
  ColorChannel,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkMatrix,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import { mixHex, type GlassBackground } from '../theme';
import { shardsData, SHARDS_H, SHARDS_W } from './shards';

// 배경 그림 — 웹 ohq-ui backgrounds(background-art·silk-waves·grunge, _backgrounds.scss)를 Skia로 같은 식으로 그린다.
// 상자(w×h) 하나를 꽉 채우고, 화면 배경(Frame)·흐린 유리 바탕·설정 미리보기 타일이 같은 함수를 쓴다.
// CSS 그라데이션의 "transparent"는 웹이 미리 곱한 색으로 섞으니, 여기서는 같은 색의 알파 0으로 바꿔 같은 결과를 낸다.

/** 사진 에셋 — 웹 bg-picture-1.webp(5120×1200)에서 폰에 보이는 곳만 잘라 둔 것. 원본 좌표(cropX…)로 웹과 같은 자리에 놓는다 */
export interface PhotoCrop {
  image: SkImage;
  /** 원본(5120×1200)에서 자른 곳 */
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export const PHOTO_SOURCE = { width: 5120, height: 1200, focusX: 0.42, focusY: 0.55 } as const;
/** 화면용 — 아이폰 세로(가로/세로 0.46~0.56)에서 보이는 곳 + 여유 */
export const PHOTO_SCREEN_CROP = { cropX: 1856, cropY: 0, cropW: 696, cropH: 1200 } as const;
/** 타일·미리보기용 — 16:10 타일까지 보이는 곳, 반 크기로 줄여 둠 */
export const PHOTO_TILE_CROP = { cropX: 1344, cropY: 0, cropW: 1920, cropH: 1200 } as const;

export interface ArtInput {
  kind: GlassBackground;
  /** 지금 칠하는 강조색(사진이면 쓰지 않는다) */
  accent: string;
  width: number;
  height: number;
  /** 사진 배경일 때 — 아직 못 읽었으면 null(어두운 바탕만) */
  photo?: PhotoCrop | null;
}

const BASE = '#050506';

// ── 색·모양 도우미 ─────────────────────────────────────────────────────────────────────────────────────────

const color = (c: string) => Skia.Color(c);
const rect = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function fill(shader: SkShader | null, c?: string) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (shader) paint.setShader(shader);
  if (c) paint.setColor(color(c));
  return paint;
}

/** CSS linear-gradient(각도) 시작·끝점 — 상자(x, y, w, h) 기준 */
export function cssLinear(deg: number, x: number, y: number, w: number, h: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    start: { x: cx - (dx * len) / 2, y: cy - (dy * len) / 2 },
    end: { x: cx + (dx * len) / 2, y: cy + (dy * len) / 2 },
  };
}

/** CSS radial-gradient(rx ry at cx cy, …) — 원 그라데이션을 세로로 늘려 타원으로 */
function ellipse(cx: number, cy: number, rx: number, ry: number, colors: string[], positions: number[]) {
  const m: SkMatrix = Skia.Matrix()
    .translate(cx, cy)
    .scale(1, ry / rx);
  return Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, rx, colors.map(color), positions, TileMode.Clamp, m);
}

/** 비녜트 — radial-gradient(120% 95% at 50% 38%, transparent 52%, rgba(0,0,0,.6) 100%) */
function vignette(canvas: SkCanvas, w: number, h: number) {
  const shader = ellipse(w * 0.5, h * 0.38, w * 1.2, h * 0.95, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.6)'], [0.52, 1]);
  canvas.drawRect(rect(0, 0, w, h), fill(shader));
}

/** SVG viewBox(vw×vh) + preserveAspectRatio="xMidYMid slice" — 상자를 덮게 키우고 가운데 맞춤 */
function slice(canvas: SkCanvas, w: number, h: number, vw: number, vh: number) {
  const k = Math.max(w / vw, h / vh);
  canvas.translate((w - vw * k) / 2, (h - vh * k) / 2);
  canvas.scale(k, k);
  return k;
}

// ── 블랙 파편(기본) ───────────────────────────────────────────────────────────────────────────────────────

function drawShards(canvas: SkCanvas, w: number, h: number, accent: string) {
  canvas.drawRect(rect(0, 0, w, h), fill(null, BASE));

  // 그림 — inset -1% 상자에 center / cover(웹 .bg-shards__image)
  const bx = -0.01 * w;
  const by = -0.01 * h;
  const bw = w * 1.02;
  const bh = h * 1.02;
  const k = Math.max(bw / SHARDS_W, bh / SHARDS_H);
  const left = bx + (bw - SHARDS_W * k) / 2;
  const top = by + (bh - SHARDS_H * k) / 2;
  // 보이는 곳(그림 좌표) — 밖의 조각은 그리지 않는다(폰 세로면 가운데 약 30%만 보인다)
  const vx0 = -left / k - 8;
  const vy0 = -top / k - 8;
  const vx1 = (w - left) / k + 8;
  const vy1 = (h - top) / k + 8;

  canvas.save();
  canvas.translate(left, top);
  canvas.scale(k, k);
  canvas.drawRect(rect(0, 0, SHARDS_W, SHARDS_H), fill(null, '#040405'));
  const { faces, edges } = shardsData();
  for (const face of faces) {
    const { x, y, w: fw, h: fh } = face.box;
    if (x > vx1 || y > vy1 || x + fw < vx0 || y + fh < vy0) continue;
    const path = Skia.Path.Polygon(
      face.points.map(([px, py]) => ({ x: px, y: py })),
      true,
    );
    // objectBoundingBox 그라데이션 — 단위 상자에서 정의하고 조각 상자로 늘린다(SVG와 같은 기울기)
    const m = Skia.Matrix()
      .translate(x, y)
      .scale(fw || 1, fh || 1);
    const shader = Skia.Shader.MakeLinearGradient(
      { x: face.from[0], y: face.from[1] },
      { x: face.to[0], y: face.to[1] },
      face.colors.map(color),
      face.positions,
      TileMode.Clamp,
      m,
    );
    canvas.drawPath(path, fill(shader));
  }
  const stroke = Skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeCap(StrokeCap.Round);
  for (const e of edges) {
    const ex0 = Math.min(e.from[0], e.to[0]);
    const ey0 = Math.min(e.from[1], e.to[1]);
    const ex1 = Math.max(e.from[0], e.to[0]);
    const ey1 = Math.max(e.from[1], e.to[1]);
    if (ex0 > vx1 || ey0 > vy1 || ex1 < vx0 || ey1 < vy0) continue;
    stroke.setColor(color(e.white ? '#ffffff' : '#000000'));
    stroke.setAlphaf(e.opacity);
    stroke.setStrokeWidth(e.width);
    canvas.drawLine(e.from[0], e.from[1], e.to[0], e.to[1], stroke);
  }
  canvas.restore();

  // 빛 번짐 — 세 겹을 한 층에 그리고 그 층을 screen으로(웹 mix-blend-mode: screen). 뒤 겹부터.
  const screen = Skia.Paint();
  screen.setBlendMode(BlendMode.Screen);
  canvas.saveLayer(screen);
  const glows: [number, number, number, number, string, number][] = [
    [0.62, 0.26, 0.3, 0.34, 'rgba(255, 255, 255, 0.05)', 0.7],
    [0.94, 0.92, 0.42, 0.46, 'rgba(58, 154, 230, 0.16)', 0.72],
    [0.1, 0.06, 0.38, 0.42, rgba(accent, 0.16), 0.7],
  ];
  for (const [px, py, rx, ry, c, end] of glows) {
    const clear = c.replace(/[\d.]+\)$/, '0)');
    canvas.drawRect(rect(0, 0, w, h), fill(ellipse(px * w, py * h, rx * w, ry * h, [c, clear], [0, end])));
  }
  canvas.restore();

  // 대각선 빛줄기 — inset -20% 상자, 118deg 세 줄, 흐림 8px(웹 .bg-shards__streaks)
  const blur = Skia.Paint();
  blur.setImageFilter(Skia.ImageFilter.MakeBlur(8, 8, TileMode.Decal, null));
  canvas.saveLayer(blur);
  const sx = -0.2 * w;
  const sy = -0.2 * h;
  const sw = w * 1.4;
  const sh = h * 1.4;
  const { start, end } = cssLinear(118, sx, sy, sw, sh);
  const streaks: [number, number, number, number][] = [
    [0.74, 0.77, 0.81, 0.03],
    [0.57, 0.61, 0.66, 0.05],
    [0.36, 0.43, 0.5, 0.075],
  ];
  for (const [a, b, c, op] of streaks) {
    const shader = Skia.Shader.MakeLinearGradient(
      start,
      end,
      ['rgba(255, 255, 255, 0)', `rgba(255, 255, 255, ${op})`, 'rgba(255, 255, 255, 0)'].map(color),
      [a, b, c],
      TileMode.Clamp,
    );
    canvas.drawRect(rect(sx, sy, sw, sh), fill(shader));
  }
  canvas.restore();

  vignette(canvas, w, h);
}

// ── 실크 웨이브 ───────────────────────────────────────────────────────────────────────────────────────────

const VB_W = 1600;
const VB_H = 1000;

/** 시드 고정 난수(웹 backgrounds/seeded.ts) */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Ribbon {
  curve: (x: number) => number;
  thickness: number;
  strength: number;
}

let ribbons: Ribbon[] | null = null;

/** 리본 여섯 줄(웹 silk-waves buildRibbons — 난수 차례 같게) */
function silkRibbons(): Ribbon[] {
  if (ribbons) return ribbons;
  const rand = seededRandom(424242);
  const list: Ribbon[] = [];
  for (let i = 0; i < 6; i++) {
    const y0 = -240 + i * 205 + rand() * 60;
    const slope = 0.28 + rand() * 0.1;
    const a1 = 55 + rand() * 75;
    const l1 = 900 + rand() * 700;
    const p1 = rand() * Math.PI * 2;
    const a2 = 18 + rand() * 30;
    const l2 = 380 + rand() * 260;
    const p2 = rand() * Math.PI * 2;
    const curve = (x: number) =>
      y0 + slope * x + a1 * Math.sin((x / l1) * Math.PI * 2 + p1) + a2 * Math.sin((x / l2) * Math.PI * 2 + p2);
    const thickness = 130 + rand() * 170;
    const strength = 0.35 + 0.65 * Math.exp(-(((i - 2.7) / 2) ** 2));
    rand(); // 웹은 리본마다 흐림 값을 하나 더 꺼낸다(쓰지 않는다) — 다음 리본의 난수가 같게
    list.push({ curve, thickness, strength });
  }
  ribbons = list;
  return list;
}

/** 리본 가운데 곡선을 dy만큼 민 꺾은선(x −160..1760, 24 간격 — 웹 path) */
function ribbonPath(r: Ribbon, dy: number) {
  const points: { x: number; y: number }[] = [];
  for (let x = -160; x <= VB_W + 160; x += 24) points.push({ x, y: round1(r.curve(x) + dy) });
  return Skia.Path.Polygon(points, false);
}

function drawSilk(canvas: SkCanvas, w: number, h: number, accent: string) {
  const light = mixHex(accent, '#ffffff', 0.45);
  const deep = mixHex(accent, '#000000', 0.55);
  const ground = mixHex(accent, '#000000', 0.95);
  canvas.drawRect(rect(0, 0, w, h), fill(null, BASE));
  canvas.save();
  slice(canvas, w, h, VB_W, VB_H);
  const bbox = Skia.Matrix().scale(VB_W, VB_H);
  canvas.drawRect(
    rect(0, 0, VB_W, VB_H),
    fill(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        [color(ground), color('#020203')],
        [0, 1],
        TileMode.Clamp,
        bbox,
      ),
    ),
  );
  canvas.drawRect(
    rect(0, 0, VB_W, VB_H),
    fill(
      Skia.Shader.MakeRadialGradient(
        { x: 0.3, y: 0.25 },
        0.75,
        [color(rgba(accent, 0.16)), color(rgba(accent, 0))],
        [0, 1],
        TileMode.Clamp,
        bbox,
      ),
    ),
  );

  const layers: { dy: number; width: number; c: string; op: number; blur: number }[] = [];
  for (const r of silkRibbons()) {
    const t = r.thickness;
    layers.length = 0;
    // 몸통 · 빛 받는 면 · 접힌 그림자 · 광택선(웹 차례)
    layers.push(
      { dy: 0, width: t, c: deep, op: 0.55, blur: 30 },
      { dy: -t * 0.18, width: t * 0.5, c: accent, op: 0.6, blur: 18 },
      { dy: t * 0.34, width: t * 0.38, c: '#000000', op: 0.6, blur: 13 },
      { dy: -t * 0.36, width: 3.2, c: light, op: 0.42, blur: 2.6 },
    );
    const group = Skia.Paint();
    group.setAlphaf(r.strength);
    canvas.saveLayer(group);
    for (const l of layers) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeWidth(l.width);
      paint.setColor(color(l.c));
      paint.setAlphaf(l.op);
      paint.setImageFilter(Skia.ImageFilter.MakeBlur(l.blur, l.blur, TileMode.Decal, null));
      canvas.drawPath(ribbonPath(r, l.dy), paint);
    }
    canvas.restore();
  }
  canvas.restore();
  vignette(canvas, w, h);
}

// ── 그런지 ───────────────────────────────────────────────────────────────────────────────────────────────

interface GrungeMarks {
  scratches: string;
  brightScratches: string;
  specks: string;
  blots: string;
}

let marks: GrungeMarks | null = null;

/** 긁힘·점·얼룩 자리(웹 grunge buildMarks — 난수 차례 같게) */
function grungeMarks(): GrungeMarks {
  if (marks) return marks;
  const rand = seededRandom(20261030);
  const line = () => {
    const vertical = rand() < 0.78;
    const angle = vertical ? Math.PI / 2 + (rand() - 0.5) * 0.45 : (rand() - 0.5) * 0.35;
    const length = 14 + rand() ** 2.2 * 260;
    const x = rand() * VB_W;
    const y = rand() * VB_H;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    return `M${round1(x)} ${round1(y)}L${round1(x + dx)} ${round1(y + dy)}`;
  };
  const dot = (rMin: number, rMax: number) => {
    const r = rMin + rand() ** 2 * (rMax - rMin);
    const x = round1(rand() * VB_W);
    const y = round1(rand() * VB_H);
    const rr = round1(r);
    return `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${rr * 2} 0a${rr} ${rr} 0 1 0 ${-rr * 2} 0`;
  };
  marks = {
    scratches: Array.from({ length: 320 }, line).join(''),
    brightScratches: Array.from({ length: 70 }, line).join(''),
    specks: Array.from({ length: 520 }, () => dot(0.6, 2.4)).join(''),
    blots: Array.from({ length: 46 }, () => dot(3, 10)).join(''),
  };
  return marks;
}

const svgPath = (d: string) => Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();

/** linearRGB 값(SVG 필터 기본 색 공간)을 화면 sRGB로 */
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function drawGrunge(canvas: SkCanvas, w: number, h: number, accent: string) {
  const ink = mixHex('#9aa3b5', accent, 0.35);
  const inkBright = mixHex('#d3d9e4', accent, 0.25);
  const m = grungeMarks();
  canvas.drawRect(rect(0, 0, w, h), fill(null, BASE));
  canvas.save();
  slice(canvas, w, h, VB_W, VB_H);
  const box = rect(0, 0, VB_W, VB_H);

  // 바탕 — (0,0)→(0.4,1) bbox
  canvas.drawRect(
    box,
    fill(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: 0 },
        { x: 0.4, y: 1 },
        [color(mixHex('#171a21', accent, 0.05)), color('#090a0d')],
        [0, 1],
        TileMode.Clamp,
        Skia.Matrix().scale(VB_W, VB_H),
      ),
    ),
  );
  // 한쪽이 빛을 받은 세로 띠 — bbox 단위 + gradientTransform(translate .42 .2 · scale .55 1.4 · translate −.42 −.2)
  const band = Skia.Matrix().scale(VB_W, VB_H).translate(0.42, 0.2).scale(0.55, 1.4).translate(-0.42, -0.2);
  canvas.drawRect(
    box,
    fill(
      Skia.Shader.MakeRadialGradient(
        { x: 0.42, y: 0.2 },
        0.6,
        [color(rgba(inkBright, 0.16)), color(rgba(inkBright, 0))],
        [0, 1],
        TileMode.Clamp,
        band,
      ),
    ),
  );
  // 캔버스 천 결 — fractalNoise(0.9 0.55, 2옥타브, seed 7) + 행렬(RGB 상수는 linearRGB → sRGB, A = 1.4A − 0.62), 0.32
  const weave = Skia.Paint();
  weave.setShader(Skia.Shader.MakeFractalNoise(0.9, 0.55, 2, 7, 0, 0));
  weave.setColorFilter(
    Skia.ColorFilter.MakeMatrix([
      0,
      0,
      0,
      0,
      linearToSrgb(0.72),
      0,
      0,
      0,
      0,
      linearToSrgb(0.75),
      0,
      0,
      0,
      0,
      linearToSrgb(0.8),
      0,
      0,
      0,
      1.4,
      -0.62,
    ]),
  );
  weave.setAlphaf(0.32);
  canvas.drawRect(box, weave);

  // 긁힘
  const scratch = Skia.Paint();
  scratch.setAntiAlias(true);
  scratch.setStyle(PaintStyle.Stroke);
  scratch.setStrokeCap(StrokeCap.Round);
  scratch.setStrokeWidth(1);
  scratch.setColor(color(ink));
  scratch.setAlphaf(0.32);
  canvas.drawPath(svgPath(m.scratches), scratch);
  scratch.setStrokeWidth(1.3);
  scratch.setColor(color(inkBright));
  scratch.setAlphaf(0.55);
  canvas.drawPath(svgPath(m.brightScratches), scratch);

  // 점·얼룩 — 가장자리를 거칠게(fractalNoise 0.09 + 밀어내기 5)
  const rough = Skia.Paint();
  rough.setImageFilter(
    Skia.ImageFilter.MakeDisplacementMap(
      ColorChannel.A,
      ColorChannel.A,
      5,
      Skia.ImageFilter.MakeShader(Skia.Shader.MakeFractalNoise(0.09, 0.09, 2, 3, 0, 0)),
      null,
    ),
  );
  canvas.saveLayer(rough);
  const dots = Skia.Paint();
  dots.setAntiAlias(true);
  dots.setColor(color(ink));
  dots.setAlphaf(0.45);
  canvas.drawPath(svgPath(m.specks), dots);
  dots.setAlphaf(0.28);
  canvas.drawPath(svgPath(m.blots), dots);
  canvas.restore();

  canvas.restore();
  vignette(canvas, w, h);
}

// ── 사진 ───────────────────────────────────────────────────────────────────────────────────────────────

function drawPhoto(canvas: SkCanvas, w: number, h: number, photo: PhotoCrop | null | undefined) {
  canvas.drawRect(rect(0, 0, w, h), fill(null, BASE));
  if (photo) {
    // background-size: cover · position 42% 55% — 원본 크기로 계산하고 자른 곳을 그 자리에 놓는다
    const k = Math.max(w / PHOTO_SOURCE.width, h / PHOTO_SOURCE.height);
    const x = (w - PHOTO_SOURCE.width * k) * PHOTO_SOURCE.focusX;
    const y = (h - PHOTO_SOURCE.height * k) * PHOTO_SOURCE.focusY;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRectOptions(
      photo.image,
      rect(0, 0, photo.image.width(), photo.image.height()),
      rect(x + photo.cropX * k, y + photo.cropY * k, photo.cropW * k, photo.cropH * k),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );
  }
  // 밝은 사진 위 흰 글씨가 묻히지 않게 누르는 막(180deg)
  const { start, end } = cssLinear(180, 0, 0, w, h);
  canvas.drawRect(
    rect(0, 0, w, h),
    fill(
      Skia.Shader.MakeLinearGradient(
        start,
        end,
        ['rgba(4, 5, 8, 0.62)', 'rgba(4, 5, 8, 0.48)', 'rgba(4, 5, 8, 0.7)'].map(color),
        [0, 0.45, 1],
        TileMode.Clamp,
      ),
    ),
  );
  vignette(canvas, w, h);
}

// ── 그리기 ─────────────────────────────────────────────────────────────────────────────────────────────

/** 배경 하나를 캔버스에 — (0,0)부터 w×h */
export function drawBackground(canvas: SkCanvas, { kind, accent, width, height, photo }: ArtInput): void {
  switch (kind) {
    case 'silk':
      drawSilk(canvas, width, height, accent);
      return;
    case 'grunge':
      drawGrunge(canvas, width, height, accent);
      return;
    case 'photo':
      drawPhoto(canvas, width, height, photo);
      return;
    case 'shards':
      drawShards(canvas, width, height, accent);
  }
}

/** 배경을 그림(SkPicture)으로 — 한 번 기록해 두고 화면·흐린 바탕이 같이 쓴다 */
export function backgroundPicture(input: ArtInput): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(rect(0, 0, input.width, input.height));
  canvas.clipRect(rect(0, 0, input.width, input.height), ClipOp.Intersect, false);
  drawBackground(canvas, input);
  return recorder.finishRecordingAsPicture();
}
