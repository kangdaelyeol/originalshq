// 홈 바닥에 새기는 숫자(48%) — 512×256 캔버스에 그려 홈 바닥의 0.38 × 0.33 칸(가운데 x = 0.76)에
// 펴 바른다. 가로가 0.58배로 눌려 길쭉한 숫자가 된다. 글자 자리는 영상(F150)의 "48%" 테두리 상자를
// 바닥으로 되비춰 잰 값이다: 숫자는 높이 135 · 폭 85 · 간격 98px, %는 79 × 91px로 작고 숫자 밑선에
// 맞춰 바로 뒤에 붙는다. 글꼴 크기와 상관없이 그 상자에 들어가게 글자마다 늘이고 줄인다.

export const DIGITS_WIDTH = 512
export const DIGITS_HEIGHT = 256

const DIGIT_FONT = '180px "Reddit Mono", monospace'
const PERCENT_FONT = '140px "JetBrains Mono", monospace'
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Reddit+Mono&display=swap'

let fontsReady: Promise<void> | null = null

/** 글꼴을 한 번만 불러온다(실패해도 고정폭 기본 글꼴로 그린다) */
export function loadJellyFonts(): Promise<void> {
  if (fontsReady) return fontsReady
  if (!document.head.querySelector(`link[href="${FONT_HREF}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.append(link)
  }
  fontsReady = Promise.all([document.fonts.load(DIGIT_FONT), document.fonts.load(PERCENT_FONT)]).then(
    () => undefined,
    () => undefined,
  )
  return fontsReady
}

// 텍스처 px — 숫자 밑선 154, 마지막 숫자 오른쪽 끝 403, % 상자 416~494 × 62~153
const BASELINE = 154
const DIGIT_HEIGHT = 135
const DIGIT_ADVANCE = 98
const DIGIT_INK_WIDTH = 85
const LAST_DIGIT_RIGHT = 403
const PERCENT_BOX = { left: 416, right: 494, top: 62, bottom: 153 }

/** 숫자 한 장(흰 글자 · 투명 바탕)을 그린다 */
export function drawPercent(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, percent: number) {
  ctx.clearRect(0, 0, DIGITS_WIDTH, DIGITS_HEIGHT)
  ctx.fillStyle = 'white'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // 숫자 — '8'의 잉크 상자(85 × 135)로 배율을 정하고, 한 자씩 고정폭 칸 가운데에 그린다
  ctx.font = DIGIT_FONT
  const ref = ctx.measureText('8')
  const sx = DIGIT_INK_WIDTH / Math.max(ref.actualBoundingBoxLeft + ref.actualBoundingBoxRight, 1)
  const sy = DIGIT_HEIGHT / Math.max(ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent, 1)
  ctx.textAlign = 'center'
  const digits = String(percent)
  for (let i = 0; i < digits.length; i++) {
    const center = LAST_DIGIT_RIGHT - DIGIT_INK_WIDTH / 2 - i * DIGIT_ADVANCE
    ctx.save()
    ctx.translate(center, BASELINE - ref.actualBoundingBoxDescent * sy)
    ctx.scale(sx, sy)
    ctx.fillText(digits[digits.length - 1 - i], 0, 0)
    ctx.restore()
  }
  ctx.textAlign = 'left'

  // % — 작게, 숫자 밑선에 맞춰
  ctx.font = PERCENT_FONT
  const m = ctx.measureText('%')
  const px = (PERCENT_BOX.right - PERCENT_BOX.left) / Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1)
  const py = (PERCENT_BOX.bottom - PERCENT_BOX.top) / Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1)
  ctx.save()
  ctx.translate(PERCENT_BOX.left, PERCENT_BOX.bottom - m.actualBoundingBoxDescent * py)
  ctx.scale(px, py)
  ctx.fillText('%', m.actualBoundingBoxLeft, 0)
  ctx.restore()
}
