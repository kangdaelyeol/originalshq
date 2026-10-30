import { X_BOX, X_POLYGONS } from '../../brand/x-shape'

// 입자가 모일 모양 — 모두 "모델 좌표"(가운데 0, 글자 폭 = 1)로 돌려준다. 실제 크기·위치·
// 회전은 ParticleField가 매 프레임 입힌다.

function insidePolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** xTool의 X(앱 아이콘과 같은 두 덩어리)를 면으로 채운 점 — 상자 안 아무 점이나 찍어 X 안에
 * 든 것만 남긴다. z에 두께를 줘서 돌리면 X가 입체로 보인다. */
export function sampleXMark(count: number, depth: number): Float32Array {
  const out = new Float32Array(count * 3)
  const { width, height } = X_BOX
  for (let i = 0; i < count; ) {
    const x = Math.random() * width
    const y = Math.random() * height
    if (!X_POLYGONS.some((poly) => insidePolygon(x, y, poly))) continue
    out[i * 3] = (x - width / 2) / width
    out[i * 3 + 1] = (y - height / 2) / width
    out[i * 3 + 2] = (Math.random() - 0.5) * depth
    i++
  }
  return out
}

export interface TextShape {
  points: Float32Array
  /** 글자 높이(폭 = 1 기준) — 자리 상자의 높이에도 맞춰 크기를 정할 때 쓴다. */
  height: number
  /** 점마다 1이면 강조색(로고의 녹색 X에서 뽑힌 점), 0이면 흰색. */
  accent?: Uint8Array
}

/**
 * 로고 이미지(투명 배경 PNG)의 칠해진 픽셀에서 점을 뽑는다 — 글꼴로 흉내 내지 않고 실제
 * 워드마크 모양 그대로. 녹색 픽셀에서 뽑힌 점은 accent로 표시해 강조색으로 그린다.
 */
export async function sampleImage(url: string, count: number, depth: number): Promise<TextShape> {
  const img = new Image()
  img.src = url
  await img.decode()

  // 원본이 작아서(600×76) 두 배로 키워 촘촘하게 뽑는다.
  const scale = 2
  const width = img.naturalWidth * scale
  const height = img.naturalHeight * scale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d를 쓸 수 없어요')
  ctx.drawImage(img, 0, 0, width, height)

  const data = ctx.getImageData(0, 0, width, height).data
  const points: number[] = []
  const green: number[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const p = (y * width + x) * 4
      if (data[p + 3] < 140) continue
      points.push(x, y)
      green.push(data[p + 1] > 120 && data[p] < 90 ? 1 : 0)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (points.length === 0) throw new Error('로고 이미지에 칠해진 픽셀이 없어요')

  const span = Math.max(1, maxX - minX)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const total = points.length / 2
  const out = new Float32Array(count * 3)
  const accent = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * total)
    out[i * 3] = (points[j * 2] + Math.random() * 2 - 1 - cx) / span
    out[i * 3 + 1] = (points[j * 2 + 1] + Math.random() * 2 - 1 - cy) / span
    out[i * 3 + 2] = (Math.random() - 0.5) * depth
    accent[i] = green[j]
  }
  return { points: out, height: (maxY - minY) / span, accent }
}

/**
 * 글자를 화면 밖 캔버스에 그려 칠해진 픽셀 위치를 뽑는다 — 글자 "속"까지 채운 점(샘플의
 * CODEXR처럼 윤곽선이 아니라 면). z에 두께를 줘서, 비스듬히 돌리면 글자가 입체로 보인다.
 * tracking(글자 크기 대비 자간)을 주면 한 글자씩 띄워 그린다 — canvas letterSpacing은
 * 아직 일부 브라우저에서 안 돼서 직접 계산한다.
 */
export function sampleText(text: string, font: string, count: number, depth: number, tracking = 0): TextShape {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const out = new Float32Array(count * 3)
  if (!ctx) return { points: out, height: 0.35 }

  const fontSize = parseFloat(font.match(/(\d+)px/)?.[1] ?? '200')
  const chars = [...text]
  const spacing = fontSize * tracking
  ctx.font = font
  const charWidths = chars.map((ch) => ctx.measureText(ch).width)
  const inkWidth = charWidths.reduce((sum, w) => sum + w, 0) + spacing * (chars.length - 1)
  const width = Math.ceil(inkWidth) + 60
  const height = Math.ceil(fontSize * 1.5)
  canvas.width = width
  canvas.height = height
  ctx.font = font // 캔버스 크기를 바꾸면 상태가 초기화된다
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  let x = (width - inkWidth) / 2
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, height / 2)
    x += charWidths[i] + spacing
  })

  const data = ctx.getImageData(0, 0, width, height).data
  const points: number[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] < 140) continue
      points.push(x, y)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (points.length === 0) return { points: out, height: 0.35 }

  const span = Math.max(1, maxX - minX)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const total = points.length / 2
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * total) * 2
    // 2px 격자를 살짝 흔들어 줄무늬가 안 보이게.
    out[i * 3] = (points[j] + Math.random() * 2 - 1 - cx) / span
    out[i * 3 + 1] = (points[j + 1] + Math.random() * 2 - 1 - cy) / span
    out[i * 3 + 2] = (Math.random() - 0.5) * depth
  }
  return { points: out, height: (maxY - minY) / span }
}
