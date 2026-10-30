type Point = readonly [number, number]

const r2 = (n: number): number => Math.round(n * 100) / 100

/** 꼭짓점마다 반지름이 다른 둥근 다각형 path — 모서리는 2차 베지어로 굴린다.
 * CSS clip-path: path()와 SVG 외곽선이 같은 문자열을 쓴다. */
export function roundedPolygon(points: readonly Point[], radii: readonly number[]): string {
  const n = points.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n]
    const [cx, cy] = points[i]
    const [nx, ny] = points[(i + 1) % n]
    const inLen = Math.hypot(cx - px, cy - py)
    const outLen = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(radii[i], inLen / 2, outLen / 2)
    const ax = cx + ((px - cx) / inLen) * r
    const ay = cy + ((py - cy) / inLen) * r
    const bx = cx + ((nx - cx) / outLen) * r
    const by = cy + ((ny - cy) / outLen) * r
    d += `${i === 0 ? 'M' : 'L'}${r2(ax)} ${r2(ay)} Q${r2(cx)} ${r2(cy)} ${r2(bx)} ${r2(by)} `
  }
  return `${d}Z`
}

/** 모서리 조각(직각삼각형) 상자 한 변 — 둘이 가운데서 만나면 이 크기의 정사각형이 된다. */
export const PIECE = 56
/** 카드 모서리를 비스듬히 잘라낸 길이 — 조각 빗변과 잘린 면 사이에 ~10px 틈이 남는다. */
export const CHAMFER = 66

/** 로그인 카드 외곽 — 왼쪽 위·오른쪽 아래를 비스듬히 잘라낸 판(그 자리에 조각이 들어간다). */
export function cardPath(width: number, height: number): string {
  return roundedPolygon(
    [
      [CHAMFER, 0],
      [width, 0],
      [width, height - CHAMFER],
      [width - CHAMFER, height],
      [0, height],
      [0, CHAMFER],
    ],
    [12, 22, 12, 12, 22, 12],
  )
}

/** 두 조각 — 같은 상자에 겹치면 빗변 사이에 얇은 대각선 틈이 남는 정사각형(◩)이 된다. */
export const PIECE_PATH = {
  tl: roundedPolygon(
    [
      [0, 0],
      [PIECE - 4, 0],
      [0, PIECE - 4],
    ],
    [10, 6, 6],
  ),
  br: roundedPolygon(
    [
      [PIECE, 4],
      [PIECE, PIECE],
      [4, PIECE],
    ],
    [6, 10, 6],
  ),
} as const
