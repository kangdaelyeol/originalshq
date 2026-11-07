import { Image } from 'react-native';
import { AlphaType, ColorType, matchFont, Skia } from '@shopify/react-native-skia';
import { X_BOX, X_POLYGONS } from '../shape';

// 입자가 모일 모양 — 웹(components/login/particles/shapes.ts)과 같다. 모두 "모델 좌표"(가운데 0, 글자 폭 = 1)로
// 돌려주고, 실제 크기·위치·회전은 ParticleField가 매 프레임 입힌다. 웹의 화면 밖 캔버스 대신 Skia로 픽셀을 읽는다.

function insidePolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** xTool의 X를 면으로 채운 점 — z에 두께를 줘서 돌리면 X가 입체로 보인다. */
export function sampleXMark(count: number, depth: number): Float32Array {
  const out = new Float32Array(count * 3);
  const { width, height } = X_BOX;
  for (let i = 0; i < count; ) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    if (!X_POLYGONS.some(poly => insidePolygon(x, y, poly))) continue;
    out[i * 3] = (x - width / 2) / width;
    out[i * 3 + 1] = (y - height / 2) / width;
    out[i * 3 + 2] = (Math.random() - 0.5) * depth;
    i++;
  }
  return out;
}

export interface TextShape {
  points: Float32Array;
  /** 글자 높이(폭 = 1 기준) */
  height: number;
  /** 점마다 1이면 강조색(로고의 녹색 X에서 뽑힌 점), 0이면 흰색. */
  accent?: Uint8Array;
}

/** 칠해진 픽셀 목록에서 count개를 골라 모델 좌표로 — 격자를 살짝 흔들어 줄무늬가 안 보이게. */
function pickPoints(
  px: number[],
  flags: number[] | null,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  count: number,
  depth: number,
  jitter: number,
): TextShape {
  const out = new Float32Array(count * 3);
  const accent = flags ? new Uint8Array(count) : undefined;
  const span = Math.max(1, bounds.maxX - bounds.minX);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const total = px.length / 2;
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * total);
    out[i * 3] = (px[j * 2] + (Math.random() * 2 - 1) * jitter - cx) / span;
    out[i * 3 + 1] = (px[j * 2 + 1] + (Math.random() * 2 - 1) * jitter - cy) / span;
    out[i * 3 + 2] = (Math.random() - 0.5) * depth;
    if (accent && flags) accent[i] = flags[j];
  }
  return { points: out, height: (bounds.maxY - bounds.minY) / span, accent };
}

/**
 * 로고 이미지(투명 배경 PNG)의 칠해진 픽셀에서 점을 뽑는다 — 실제 워드마크 모양 그대로. 녹색 픽셀에서 뽑힌 점은
 * accent로 표시해 강조색으로 그린다. 웹은 두 배로 키워 2px마다 읽는데, 같은 촘촘함이라 원본 픽셀을 하나씩 읽는다.
 */
export async function sampleImage(asset: number, count: number, depth: number): Promise<TextShape> {
  const source = Image.resolveAssetSource(asset);
  if (!source) throw new Error('로고 이미지를 찾지 못했어요');
  const data = await Skia.Data.fromURI(source.uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('로고 이미지를 읽지 못했어요');
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) throw new Error('로고 이미지 픽셀을 읽지 못했어요');

  const px: number[] = [];
  const green: number[] = [];
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (pixels[p + 3] < 140) continue;
      px.push(x, y);
      green.push(pixels[p + 1] > 120 && pixels[p] < 90 ? 1 : 0);
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
    }
  }
  if (px.length === 0) throw new Error('로고 이미지에 칠해진 픽셀이 없어요');
  return pickPoints(px, green, b, count, depth, 0.5);
}

/**
 * 글자를 화면 밖 판에 그려 칠해진 픽셀 위치를 뽑는다 — 글자 "속"까지 채운 점. tracking(글자 크기 대비 자간)을
 * 주면 한 글자씩 띄워 그린다.
 */
export function sampleText(
  text: string,
  font: { size: number; weight: '700' | '900' },
  count: number,
  depth: number,
  tracking = 0,
): TextShape {
  const out = { points: new Float32Array(count * 3), height: 0.35 };
  const skFont = matchFont({ fontFamily: 'Helvetica Neue', fontSize: font.size, fontWeight: font.weight });
  const chars = [...text];
  const spacing = font.size * tracking;
  const charWidths = chars.map(ch => skFont.measureText(ch).width);
  const inkWidth = charWidths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1);
  const width = Math.ceil(inkWidth) + 60;
  const height = Math.ceil(font.size * 1.5);
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return out;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('#ffffff'));
  // 글자 가운데가 판 가운데에 오게(웹 textBaseline 'middle'과 같은 자리).
  const metrics = skFont.getMetrics();
  const baseline = height / 2 - (metrics.ascent + metrics.descent) / 2;
  let x = (width - inkWidth) / 2;
  chars.forEach((ch, i) => {
    canvas.drawText(ch, x, baseline, paint, skFont);
    x += charWidths[i] + spacing;
  });
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return out;

  const px: number[] = [];
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let y = 0; y < height; y += 2) {
    for (let x2 = 0; x2 < width; x2 += 2) {
      if (pixels[(y * width + x2) * 4 + 3] < 140) continue;
      px.push(x2, y);
      if (x2 < b.minX) b.minX = x2;
      if (x2 > b.maxX) b.maxX = x2;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
    }
  }
  if (px.length === 0) return out;
  return pickPoints(px, null, b, count, depth, 1);
}
