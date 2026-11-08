import { ImageFormat, Skia, TileMode, type SkPicture } from '@shopify/react-native-skia';
import { useImage } from '@shopify/react-native-skia';
import { saturateMatrix } from '../theme';
import { PHOTO_SCREEN_CROP, PHOTO_TILE_CROP, type PhotoCrop } from './art';

// 흐린 배경 — 웹 유리 판의 backdrop-filter: blur(Npx) saturate(M%)를 배경 그림 전체에 한 번 걸어 둔 작은 그림.
// 판들은 이 그림을 화면 좌표에 맞춰 깐다(glass-surface). 흐린 그림은 고운 결이 없어 작게 만들어 늘려도 같다 —
// 흐림 반경(σ)의 1/3쯤 간격으로 찍으면 충분해서, 해상도를 3/blur로 줄인다(기본 22px → 약 ¼ — 390×844 화면이 98×211).

/** 흐린 그림 해상도(점 1개당 픽셀) — 흐림이 작을수록 곱게, 1을 넘지 않는다 */
export function backdropScale(blur: number): number {
  if (blur < 3) return 1;
  return Math.min(1, Math.max(0.125, 3 / blur));
}

/**
 * 배경 그림을 흐리고 채도를 올린 작은 PNG(data URI). 순서는 CSS와 같다(blur → saturate). 가장자리는 늘여(clamp)
 * 화면 끝이 어두워지지 않게 한다.
 */
export function blurredBackdrop(
  picture: SkPicture,
  width: number,
  height: number,
  blur: number,
  saturate: number,
): string | null {
  const k = backdropScale(blur);
  const w = Math.max(1, Math.round(width * k));
  const h = Math.max(1, Math.round(height * k));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const sx = w / width;
  const sy = h / height;
  const paint = Skia.Paint();
  const sigma = blur * sx;
  const blurFilter = sigma > 0 ? Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null) : null;
  paint.setImageFilter(
    Skia.ImageFilter.MakeColorFilter(Skia.ColorFilter.MakeMatrix(saturateMatrix(saturate / 100)), blurFilter),
  );
  // 층은 축소 전에 연다 — 흐림 σ가 작은 그림의 픽셀 단위가 되게
  canvas.saveLayer(paint);
  canvas.scale(sx, sy);
  canvas.drawPicture(picture);
  canvas.restore();
  surface.flush();
  const image = surface.makeImageSnapshot().makeNonTextureImage();
  const base64 = image?.encodeToBase64(ImageFormat.PNG, 100);
  return base64 ? `data:image/png;base64,${base64}` : null;
}

/** 그림을 JPEG data URI로(설정 타일처럼 가만히 있는 작은 그림 — Skia 판을 여럿 띄우지 않게) */
export function pictureUri(picture: SkPicture, width: number, height: number, density: number): string | null {
  const w = Math.max(1, Math.round(width * density));
  const h = Math.max(1, Math.round(height * density));
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(w / width, h / height);
  canvas.drawPicture(picture);
  surface.flush();
  const base64 = surface.makeImageSnapshot().makeNonTextureImage()?.encodeToBase64(ImageFormat.JPEG, 92);
  return base64 ? `data:image/jpeg;base64,${base64}` : null;
}

const PHOTO_SCREEN = require('../assets/photo-screen.webp');
const PHOTO_TILE = require('../assets/photo-tile.webp');

/** 사진 배경 에셋 — screen: 화면용(원본 크기 잘라낸 것) · tile: 미리보기 타일용(넓게 잘라 반 크기) · null: 안 읽음 */
export function usePhotoCrop(which: 'screen' | 'tile' | null): PhotoCrop | null {
  const image = useImage(which === 'screen' ? PHOTO_SCREEN : which === 'tile' ? PHOTO_TILE : null);
  if (!image || !which) return null;
  return { image, ...(which === 'screen' ? PHOTO_SCREEN_CROP : PHOTO_TILE_CROP) };
}
