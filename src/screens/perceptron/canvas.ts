/**
 * 작은 패널 캔버스 — 보이는 크기 × 화면 배율로 맞추고, 크기는 ResizeObserver로만
 * 잰다(프레임마다 레이아웃을 읽지 않는다). 크기가 바뀌면 dirty가 켜진다.
 */
export class FitCanvas {
  w = 0
  h = 0
  dirty = true
  readonly ctx: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement
  private readonly ro: ResizeObserver

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ro = new ResizeObserver(() => this.fit())
    this.ro.observe(canvas)
    this.fit()
  }

  private fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = this.canvas.clientWidth
    this.h = this.canvas.clientHeight
    this.canvas.width = Math.max(1, Math.round(this.w * dpr))
    this.canvas.height = Math.max(1, Math.round(this.h * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.dirty = true
  }

  dispose() {
    this.ro.disconnect()
  }
}
