// 입자가 모일 모양 — 모두 "모델 좌표"(가운데 0, 글자 폭 = 1)로 돌려준다. 실제 크기·위치·
// 회전은 ParticleField가 매 프레임 입힌다.

/** 단위 구 표면에 고르게 퍼진 점(피보나치 나선). */
export function fibonacciSphere(count: number): Float32Array {
  const out = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    out[i * 3] = Math.cos(theta) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(theta) * r
  }
  return out
}

export interface TextShape {
  points: Float32Array
  /** 글자 높이(폭 = 1 기준) — 자리 상자의 높이에도 맞춰 크기를 정할 때 쓴다. */
  height: number
}

/**
 * 글자를 화면 밖 캔버스에 그려 칠해진 픽셀 위치를 뽑는다 — 글자 "속"까지 채운 점(샘플의
 * CODEXR처럼 윤곽선이 아니라 면). z에 두께를 줘서, 비스듬히 돌리면 글자가 입체로 보인다.
 */
export function sampleText(text: string, font: string, count: number, depth: number): TextShape {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const out = new Float32Array(count * 3)
  if (!ctx) return { points: out, height: 0.35 }

  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + 60
  const height = Math.ceil(parseFloat(font.match(/(\d+)px/)?.[1] ?? '200') * 1.5)
  canvas.width = width
  canvas.height = height
  ctx.font = font // 캔버스 크기를 바꾸면 상태가 초기화된다
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, width / 2, height / 2)

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
