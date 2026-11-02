// 견본 정지 화면 — 렌더러 하나(화면 밖 캔버스)를 같이 써서 여러 장을 그린 뒤 각 캔버스에 옮겨 담는다.
// WebGL 문맥은 브라우저마다 개수 제한이 있어, 정지 화면이 몇 장이든 문맥은 하나만 쓴다.

import type { ViewWindow } from './jelly-camera'
import { DEMO_FIRST_FRAME, demoPercentAt } from './jelly-demo'
import { demoRopeAt } from './jelly-engine'
import { JellyRenderer, type JellyLayers } from './jelly-renderer'

/** 홈 둘레만 — 영상 장면 px (40, 120)~(680, 400) */
export const STILL_VIEW: ViewWindow = {
  left: (40 - 354.49) / 308.61,
  right: (680 - 354.49) / 308.61,
  bottom: (282.51 - 400) / 308.61,
  top: (282.51 - 120) / 308.61,
}

let shared: { canvas: HTMLCanvasElement; renderer: JellyRenderer } | null = null

/** 영상 프레임의 젤리를 그려 target 캔버스(픽셀 크기는 미리 정해 둔다)에 담는다 */
export function renderJellyStill(target: HTMLCanvasElement, frame: number, layers: JellyLayers, view = STILL_VIEW) {
  if (!shared || shared.renderer.contextLost) {
    const canvas = document.createElement('canvas')
    shared = { canvas, renderer: new JellyRenderer(canvas) }
  }
  const { canvas, renderer } = shared
  renderer.resize(target.width, target.height, target.width, target.height)
  renderer.setView(view)
  const rope = demoRopeAt(Math.max(frame, DEMO_FIRST_FRAME))
  // 멈춘 장면이라 같은 상태를 흔들며 16번 — TAA가 가라앉아 가장자리가 매끈해진다
  for (let i = 0; i < 16; i++) renderer.render(rope, { percent: demoPercentAt(frame), layers })
  target.getContext('2d')?.drawImage(canvas, 0, 0)
}
