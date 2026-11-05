// 프레임 지문(pHash) — 프레임을 32×32 회색으로 줄인 값으로 만든 64비트 해시.
// 크기·화질·밝기만 바꾸거나 살짝 잘라낸 프레임은 해시가 거의 같아서(해밍 거리가
// 작아) 같은 촬영본을 쓴 소재를 찾는 데 쓴다. 자막 띠처럼 화면 일부를 크게
// 덮으면 멀어진다(FRAME_MATCH_BITS 참고). 의존성 없는 계산만 — 회색 값은
// creatives/media.ts가 ffmpeg로 뽑는다.

/** ffmpeg가 줄여 줄 크기 — 한 변 32픽셀(회색 1바이트씩, 1 024바이트). */
export const PHASH_SIDE = 32
/** 해시에 쓰는 낮은 주파수 칸 — 8×8 = 64비트. */
const LOW = 8

const COS: number[][] = []
for (let u = 0; u < LOW; u++) {
  COS.push([])
  for (let x = 0; x < PHASH_SIDE; x++)
    COS[u].push(Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PHASH_SIDE)))
}

/** 32×32 회색 값(행 순서) → 16자리 16진수 해시. 낮은 주파수 8×8 DCT 계수가
 * 그 중앙값보다 크면 1. */
export const phashOf = (gray: Uint8Array): string => {
  if (gray.length !== PHASH_SIDE * PHASH_SIDE)
    throw new Error(`회색 값이 ${PHASH_SIDE}×${PHASH_SIDE}가 아닙니다`)
  const coef: number[] = []
  for (let v = 0; v < LOW; v++)
    for (let u = 0; u < LOW; u++) {
      let sum = 0
      for (let y = 0; y < PHASH_SIDE; y++) {
        const row = y * PHASH_SIDE
        let line = 0
        for (let x = 0; x < PHASH_SIDE; x++) line += gray[row + x] * COS[u][x]
        sum += line * COS[v][y]
      }
      coef.push(sum)
    }
  const sorted = coef.slice().sort((a, b) => a - b)
  const median = (sorted[31] + sorted[32]) / 2
  let hex = ''
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0
    for (let b = 0; b < 4; b++)
      nibble = (nibble << 1) | (coef[i + b] > median ? 1 : 0)
    hex += nibble.toString(16)
  }
  return hex
}

/** 32비트 수에서 1인 비트 수(SWAR) — 유사도는 짝마다 수십 번 부른다. */
export const popcount = (x: number): number => {
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24
}

/** 해시 → 32비트 수 둘(앞 8자리, 뒤 8자리) — BigInt 없이 거리를 재려고. */
export const hashWords = (hex: string): [number, number] => [
  parseInt(hex.slice(0, 8), 16) >>> 0,
  parseInt(hex.slice(8, 16), 16) >>> 0,
]

/** 두 해시가 다른 비트 수(0~64). */
export const hamming = (a: string, b: string): number => {
  const [a0, a1] = hashWords(a)
  const [b0, b1] = hashWords(b)
  return popcount((a0 ^ b0) >>> 0) + popcount((a1 ^ b1) >>> 0)
}
