// 젤리 슬라이더를 캔버스에 그리는 WebGL2 렌더러 — 패스 다섯:
//  1) 줄 거리장(256×128, 반정밀도 실수) 굽기  2) 젤리를 뺀 장면(선형 색, 밉맵 — 젤리가 굴절·반사로 읽는다)
//  3) 장면 레이마칭(흔들린 화면 창)  4) TAA(지난 결과와 섞기)  5) 캔버스 크기로 늘려 그리기.
// 원본 예제가 WebGPU로 하던 순서를 그대로 따른다(계산 셰이더 → 그리기 패스).

import { JELLY_CAMERA, viewWindowFor, type ViewWindow } from './jelly-camera'
import { DIGITS_HEIGHT, DIGITS_WIDTH, drawPercent } from './jelly-digits'
import type { JellyRope } from './jelly-rope'
import { BEZIER_FS, BLIT_FS, FULLSCREEN_VS, SCENE_FS, TAA_FS } from './jelly-shaders'

/** 견본에서 하나씩 끄고 켜 보는 부품 */
export interface JellyLayers {
  /** 젤리 몸통(빼면 빈 홈만 남는다) */
  jelly: boolean
  /** 판 위로 길게 드리운 주황 그림자 */
  shadow: boolean
  /** 젤리가 솟은 자리 아래 홈 바닥이 밝아지는 빛 모임 */
  caustics: boolean
  /** 손잡이 둘레 바닥·벽에 번지는 주황 반사광 */
  bounce: boolean
  /** 홈 바닥에 새긴 숫자 */
  digits: boolean
}

export const ALL_LAYERS: JellyLayers = { jelly: true, shadow: true, caustics: true, bounce: true, digits: true }

/** 젤리 재질(셰이더 uMatA~E) */
export interface JellyMaterial {
  /** 흡수 계수 RGB(젤리 속 거리 1당) */
  absorb: readonly [number, number, number]
  /** 색이 짙어지기 시작·다 짙어지는 거리(고정점에서 줄을 따라) */
  colorFrom: number
  colorTo: number
  /** 고정점 쪽 최소 색 비율 */
  absorbMin: number
  scatter: number
  /** 뒤에서 든 빛이 젤리 속을 지나는 길이(빛 번짐의 색을 정한다) */
  glowPath: number
  /** 빛 번짐이 켜지기 시작·다 켜지는 높이(젤리 겉면 y) — 홈 안(벽 그늘)은 어둡게 */
  litFrom: number
  litTo: number
  /** 빛 번짐이 시작·다 차는 거리(고정점에서 줄을 따라) — 색이 짙어지는 자리보다 앞에서 노랗게 빛난다 */
  glowFrom: number
  glowTo: number
  /** 뿌연 정도(0 맑음 ~ 1 우윳빛)와 그 빛의 밝기 */
  milk: number
  milkLevel: number
  /** 굴절률 — 1이면 꺾지 않는다(영상의 옅은 쪽은 뒤가 곧게 비친다) */
  ior: number
  /** 겉면 반사 세기(프레넬에 곱함) */
  reflect: number
  /** 위로 튄 반사가 비치는 촬영장 빛 — 수평 쪽·위쪽 밝기 */
  skyLow: number
  skyHigh: number
  /** 날카로운 반짝임 세기·지수, 그 등의 높이각·좌우각(도, 0 = 젤리 뒤쪽) */
  spec: number
  shininess: number
  keyElevation: number
  keyAzimuth: number
  /** 가장자리 빛 세기·지수(둥근 끝 D의 빛나는 테) */
  rim: number
  rimPow: number
  /** 옅은 쪽 바탕 흡수 RGB — 살구·분홍 빛 */
  paleTint: readonly [number, number, number]
  /** 젖빛 — 젤리 너머를 읽는 밉맵 단계(0 또렷 ~ 4 16배 흐림) */
  frost: number
  /** 짙은 쪽 반사 비율(1이면 옅은 쪽과 같게) */
  reflectDeep: number
  /** 빛 번짐 색을 정하는 흡수 RGB */
  glowAbsorb: readonly [number, number, number]
  /** 빛 번짐이 사라지기 시작하는 높이(젤리 겉면 y, 0.12 위에서 다 꺼짐) — 높이 솟은 혹 꼭대기는 옅게 */
  glowCeil: number
  /** 가장자리 선 세기·폭 */
  outline: number
  outlineWidth: number
  /** 빛 모임 세기(바닥 밝기 배율) · 시작·다 차는 뜬 높이 */
  caustic: number
  causticFrom: number
  causticTo: number
}

/**
 * 영상에 맞춘 재질 — 되짚은 모양으로 영상 6프레임(F40·F53·F60·F66·F75·F90)을 그려, 젤리 안에서 색뿐 아니라
 * 구조(밝기 기울기·국소 대비), 밝은 점 수, 옅은 쪽 색상·채도·매끈함, F53 노란 속 색을 함께 본 점수로 골랐다
 * (평균 색 차이만 보면 젤리가 흐린 평균색으로 뭉개져 윤기와 투명함이 사라진다). 시작점 대비 점수 131 → 88,
 * 옅은 쪽 색상 차 28° → 9°, F53 노란 속 색 차 45 → 8, 밝은 점 164 → 1481개(영상 1303).
 *  · 옅은 쪽: 젖빛 유리 — 뒤를 흐리게 비추고(frost 4단계 밉맵) 살짝 뿌옇고(0.35) 분홍 살구빛, 꺾지 않는다
 *    (ior 1 — 1.2~1.42로 꺾으면 평균 색은 조금 낫지만 F53 노란 속이 흐려져 점수가 4~7 나빠졌다)
 *  · 색은 고정점에서 0.6~1.25 사이에서 짙어지고, 뒤에서 든 빛으로 노랗게·주황으로 빛난다. 빛은 0.4 높이부터
 *    0.52까지 꺼진다 — 0.22에서 끄면 젤리 안 밝기 기울기는 영상에 더 가깝지만(0.82 대 0.72) 높이 솟은 혹의
 *    오른 어깨가 짙은 밤색 띠가 된다(영상 F66 그 자리는 밝은 주황 (208,151,98), 0.22는 (162,108,60), 0.4는
 *    (230,178,98)). 실시간으로 끌면 혹이 더 높이 솟아 그 띠가 거의 검게(57,17,10) 보였다
 *  · 윤기: 위로 튄 반사는 밝은 촬영장 빛, 아래는 실제 판·홈 — 프레넬로 가장자리만 밝고 짙은 쪽은 0.1배.
 *    날카로운 반짝임은 낮은 등(10°)에 지수 800으로 가는 선만, 스치는 테두리는 0.35만큼 어둡게
 *  · 젤리가 높이 뜬 아래 홈 바닥은 하얗게(빛 모임, 0.16~0.35 뜬 높이에서 차오름)
 */
export const JELLY_MATERIAL: JellyMaterial = {
  absorb: [15.26, 29.89, 59.76],
  colorFrom: 0.6,
  colorTo: 1.251,
  absorbMin: 0.0165,
  scatter: 6,
  glowPath: 0.105,
  litFrom: -0.05,
  litTo: 0.229,
  glowFrom: 0.624,
  glowTo: 1.043,
  milk: 0.35,
  milkLevel: 0.95,
  ior: 1,
  reflect: 1.6,
  skyLow: 0.925,
  skyHigh: 1.95,
  spec: 1.5,
  shininess: 800,
  keyElevation: 10,
  keyAzimuth: 12,
  rim: 1.5,
  rimPow: 3.7,
  paleTint: [0, 0.8, 0.25],
  frost: 4,
  reflectDeep: 0.1,
  glowAbsorb: [12, 30, 60],
  glowCeil: 0.4,
  outline: 0.35,
  outlineWidth: 0.2,
  caustic: 0.9,
  causticFrom: 0.16,
  causticTo: 0.35,
}

/** 젤리 색 — 원본 기본값(선형 RGB, 감마 없이 그대로 쓴다) */
export const JELLY_COLOR: readonly [number, number, number] = [1.0, 0.45, 0.075]

// 빛 방향 — 원본 'Light dir' 조절의 처음 값(0)이 정하는 방향. 뒤쪽 위에서 앞(+z)·오른쪽으로 비춰
// 그림자가 화면 아래로, 살짝 오른쪽으로 드리운다.
const LIGHT = (() => {
  const x = 0.18
  const y = -0.3
  const z = 0.64
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as const
})()

// 줄 거리장이 덮는 범위 — 홈 왼쪽 벽 속(-1.12)부터 끝 오른쪽 1.09, 위로 0.65까지. 원본은 고정점(-1)
// 바로 왼쪽(-1.019)에서 잘라, 그 바깥은 가장자리 값이 이어져 젤리가 왼쪽으로 끝없이 늘어나 보였다.
const BBOX = { left: -1.12, right: 0.9 + 1.9 * 0.1, bottom: -0.3, top: 0.65 } as const
const BEZIER_W = 256
const BEZIER_H = 128

const halton = (index: number, base: number) => {
  let result = 0
  let f = 1 / base
  let i = index
  while (i > 0) {
    result += f * (i % base)
    i = Math.floor(i / base)
    f /= base
  }
  return result
}

type Uniforms = Record<string, WebGLUniformLocation | null>

interface Program {
  program: WebGLProgram
  u: Uniforms
}

interface Target {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
}

export interface JellyRenderOptions {
  /** 바닥에 새길 숫자(0~100) */
  percent: number
  layers?: JellyLayers
  /** TAA용 반 픽셀 흔들기 — 정지 화면 한 장만 그릴 때는 끈다 */
  jitter?: boolean
}

export class JellyRenderer {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  readonly #gl: WebGL2RenderingContext
  readonly #vao: WebGLVertexArrayObject
  readonly #bezier: Program
  readonly #scene: Program
  /** 배경 패스(젤리 없이 판·홈만) — 같은 셰이더를 BG_PASS로 한 번 더 */
  readonly #sceneBg: Program
  readonly #taa: Program
  readonly #blit: Program
  readonly #bezierTarget: Target
  readonly #digitsTex: WebGLTexture
  readonly #digitsCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  #sceneTarget: Target | null = null
  /** 젤리를 뺀 장면(선형 색, 반정밀도, 밉맵) — 젤리 너머를 흐려 읽는다 */
  #bgTarget: Target | null = null
  #taaTargets: Target[] = []
  #renderW = 0
  #renderH = 0
  #view: ViewWindow = viewWindowFor(4 / 3)
  #fixedView: ViewWindow | null = null
  #digitsValue = -1
  #history = 0
  #haltonIndex = 1
  #material: JellyMaterial = JELLY_MATERIAL

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null
    if (!gl) throw new Error('WebGL2를 쓸 수 없어요')
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
      throw new Error('반정밀도 실수 텍스처에 그릴 수 없어요')
    }
    this.#gl = gl
    this.#vao = gl.createVertexArray()
    this.#bezier = this.#link(BEZIER_FS, ['uPts', 'uCtl', 'uBBox'])
    const sceneUniforms = [
      'uBezier', 'uDigits', 'uEndCap', 'uAnchorX', 'uBBox', 'uJellyColor', 'uLightDir', 'uCamPos', 'uCamRight', 'uCamUp',
      'uCamForward', 'uTanHalf', 'uView', 'uJitter', 'uResolution', 'uLayers', 'uDigitsOn', 'uMatA', 'uMatB', 'uMatC', 'uMatD', 'uMatE', 'uMatF', 'uMatG', 'uMatH', 'uMatI', 'uMatJ', 'uRopeLen', 'uBg', 'uFrost', 'uKeyDir', 'uOutline',
    ]
    this.#scene = this.#link(SCENE_FS, sceneUniforms)
    this.#sceneBg = this.#link(SCENE_FS.replace('\n', '\n#define BG_PASS\n'), sceneUniforms)
    this.#taa = this.#link(TAA_FS, ['uCurrent', 'uHistory', 'uHasHistory'])
    this.#blit = this.#link(BLIT_FS, ['uTex', 'uSize'])
    this.#bezierTarget = this.#target(BEZIER_W, BEZIER_H, gl.RGBA16F, gl.HALF_FLOAT, gl.LINEAR)

    this.#digitsTex = this.#texture(gl.LINEAR)
    const digits =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(DIGITS_WIDTH, DIGITS_HEIGHT)
        : Object.assign(document.createElement('canvas'), { width: DIGITS_WIDTH, height: DIGITS_HEIGHT })
    const ctx = digits.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) throw new Error('숫자 캔버스를 만들 수 없어요')
    this.#digitsCtx = ctx

    // 바뀌지 않는 값은 한 번만
    gl.useProgram(this.#bezier.program)
    gl.uniform4f(this.#bezier.u.uBBox, BBOX.left, BBOX.right, BBOX.bottom, BBOX.top)
    const c = JELLY_CAMERA
    for (const prog of [this.#scene, this.#sceneBg]) {
      const s = prog.u
      gl.useProgram(prog.program)
      gl.uniform1i(s.uBezier, 0)
      gl.uniform1i(s.uDigits, 1)
      gl.uniform1i(s.uBg, 2)
      gl.uniform4f(s.uBBox, BBOX.left, BBOX.right, BBOX.bottom, BBOX.top)
      gl.uniform3f(s.uLightDir, LIGHT[0], LIGHT[1], LIGHT[2])
      gl.uniform3f(s.uJellyColor, JELLY_COLOR[0], JELLY_COLOR[1], JELLY_COLOR[2])
      gl.uniform3f(s.uCamPos, c.eye.x, c.eye.y, c.eye.z)
      gl.uniform3f(s.uCamRight, c.right.x, c.right.y, c.right.z)
      gl.uniform3f(s.uCamUp, c.up.x, c.up.y, c.up.z)
      gl.uniform3f(s.uCamForward, c.forward.x, c.forward.y, c.forward.z)
      gl.uniform1f(s.uTanHalf, c.tanHalf)
    }
    this.#applyMaterial()
    gl.useProgram(this.#taa.program)
    gl.uniform1i(this.#taa.u.uCurrent, 0)
    gl.uniform1i(this.#taa.u.uHistory, 1)
    gl.useProgram(this.#blit.program)
    gl.uniform1i(this.#blit.u.uTex, 0)
  }

  get view() {
    return this.#view
  }

  /** 재질을 바꾼다(영상 색 맞출 때 개발 서버에서만 쓴다) — 다음 장부터 */
  setMaterial(material: Partial<JellyMaterial>) {
    this.#material = { ...this.#material, ...material }
    this.#applyMaterial()
    this.#history = 0
  }

  #applyMaterial() {
    const gl = this.#gl
    const m = this.#material
    for (const prog of [this.#scene, this.#sceneBg]) {
      const s = prog.u
      gl.useProgram(prog.program)
      gl.uniform4f(s.uMatA, m.absorb[0], m.absorb[1], m.absorb[2], 0)
      gl.uniform4f(s.uMatB, m.scatter, m.ior, 0, 0)
      gl.uniform4f(s.uMatC, m.caustic, m.causticFrom, m.causticTo, m.absorbMin)
      gl.uniform4f(s.uMatD, m.colorFrom, m.colorTo, m.glowPath, 0)
      gl.uniform4f(s.uMatE, m.litFrom, m.litTo, m.glowFrom, m.glowTo)
      gl.uniform4f(s.uMatF, m.milk, m.milkLevel, 0, 0)
      gl.uniform4f(s.uMatG, m.spec, m.shininess, m.rim, m.rimPow)
      gl.uniform4f(s.uMatH, m.paleTint[0], m.paleTint[1], m.paleTint[2], m.reflect)
      gl.uniform4f(s.uMatI, m.skyLow, m.skyHigh, 0, m.reflectDeep)
      gl.uniform4f(s.uMatJ, m.glowAbsorb[0], m.glowAbsorb[1], m.glowAbsorb[2], m.glowCeil)
      gl.uniform1f(s.uFrost, m.frost)
      gl.uniform2f(s.uOutline, m.outline, m.outlineWidth)
      const el = (m.keyElevation * Math.PI) / 180
      const az = (m.keyAzimuth * Math.PI) / 180
      gl.uniform3f(s.uKeyDir, Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az))
    }
  }

  get contextLost() {
    return this.#gl.isContextLost()
  }

  /**
   * 크기 — 캔버스는 화면 픽셀(width × height), 레이마칭은 renderWidth × renderHeight로 하고
   * 마지막에 늘린다(원본도 0.3~1배 해상도로 그린 뒤 TAA로 다듬는다).
   */
  resize(width: number, height: number, renderWidth: number, renderHeight: number) {
    const gl = this.#gl
    this.canvas.width = Math.max(1, Math.round(width))
    this.canvas.height = Math.max(1, Math.round(height))
    const rw = Math.max(1, Math.round(renderWidth))
    const rh = Math.max(1, Math.round(renderHeight))
    this.#view = this.#fixedView ?? viewWindowFor(rw / rh)
    if (rw === this.#renderW && rh === this.#renderH && this.#sceneTarget) return
    this.#renderW = rw
    this.#renderH = rh
    this.#freeTargets()
    this.#sceneTarget = this.#target(rw, rh, gl.RGBA8, gl.UNSIGNED_BYTE, gl.NEAREST)
    this.#bgTarget = this.#target(rw, rh, gl.RGBA16F, gl.HALF_FLOAT, gl.LINEAR_MIPMAP_LINEAR)
    this.#taaTargets = [0, 1].map(() => this.#target(rw, rh, gl.RGBA8, gl.UNSIGNED_BYTE, gl.LINEAR))
    this.#history = 0
  }

  /** 화면 창을 직접 정한다(견본 정지 화면이 홈 둘레만 크게 보이게) — null이면 캔버스 비율대로 */
  setView(view: ViewWindow | null) {
    this.#fixedView = view
    this.#view = view ?? viewWindowFor(this.#renderW / Math.max(this.#renderH, 1))
    this.#history = 0
  }

  /** TAA 기록을 버린다(다음 장은 섞지 않고 그대로) */
  resetHistory() {
    this.#history = 0
  }

  /** 글꼴이 늦게 도착하면 숫자를 다시 그리게 */
  invalidateDigits() {
    this.#digitsValue = -1
  }

  render(rope: JellyRope, { percent, layers = ALL_LAYERS, jitter = true }: JellyRenderOptions) {
    const gl = this.#gl
    const scene = this.#sceneTarget
    if (!scene || gl.isContextLost()) return
    gl.bindVertexArray(this.#vao)
    gl.disable(gl.BLEND)

    // 1) 줄 거리장
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#bezierTarget.fbo)
    gl.viewport(0, 0, BEZIER_W, BEZIER_H)
    gl.useProgram(this.#bezier.program)
    gl.uniform2fv(this.#bezier.u.uPts, rope.pos)
    gl.uniform2fv(this.#bezier.u.uCtl, rope.controls)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // 숫자가 바뀐 때만 다시 올린다
    if (percent !== this.#digitsValue) {
      drawPercent(this.#digitsCtx, percent)
      gl.bindTexture(gl.TEXTURE_2D, this.#digitsTex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#digitsCtx.canvas)
      this.#digitsValue = percent
    }

    // 2) 장면
    const w = this.#renderW
    const h = this.#renderH
    const v = this.#view
    let jx = 0
    let jy = 0
    if (jitter) {
      jx = ((halton(this.#haltonIndex, 2) - 0.5) * (v.right - v.left)) / w
      jy = ((halton(this.#haltonIndex, 3) - 0.5) * (v.top - v.bottom)) / h
      this.#haltonIndex++
    }
    const n = rope.pos.length
    let len = 0
    for (let i = 2; i < n; i += 2) len += Math.hypot(rope.pos[i] - rope.pos[i - 2], rope.pos[i + 1] - rope.pos[i - 1])
    const bgTarget = this.#bgTarget
    if (!bgTarget) return
    gl.viewport(0, 0, w, h)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.#bezierTarget.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.#digitsTex)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, null)
    // 2a) 배경(젤리 없이) → 밉맵  2b) 젤리 — 너머는 배경을 흐려 읽는다
    for (const [prog, target] of [
      [this.#sceneBg, bgTarget],
      [this.#scene, scene],
    ] as const) {
      const s = prog.u
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.useProgram(prog.program)
      gl.uniform4f(s.uEndCap, rope.pos[n - 4], rope.pos[n - 3], rope.pos[n - 2], rope.pos[n - 1])
      gl.uniform1f(s.uAnchorX, rope.pos[0])
      gl.uniform1f(s.uRopeLen, len)
      gl.uniform4f(s.uView, v.left, v.bottom, v.right, v.top)
      gl.uniform2f(s.uJitter, jx, jy)
      gl.uniform2f(s.uResolution, w, h)
      gl.uniform4f(s.uLayers, +layers.jelly, +layers.shadow, +layers.caustics, +layers.bounce)
      gl.uniform1f(s.uDigitsOn, +layers.digits)
      if (prog === this.#scene) {
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, bgTarget.tex)
        gl.generateMipmap(gl.TEXTURE_2D)
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, null)

    // 3) TAA — 두 장을 번갈아 쓴다
    const cur = this.#taaTargets[this.#history % 2]
    const prev = this.#taaTargets[(this.#history + 1) % 2]
    gl.bindFramebuffer(gl.FRAMEBUFFER, cur.fbo)
    gl.useProgram(this.#taa.program)
    gl.uniform1f(this.#taa.u.uHasHistory, this.#history > 0 ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, scene.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, prev.tex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.#history++

    // 4) 캔버스로
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.#blit.program)
    gl.uniform2f(this.#blit.u.uSize, this.canvas.width, this.canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, cur.tex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.#gl
    this.#freeTargets()
    gl.deleteFramebuffer(this.#bezierTarget.fbo)
    gl.deleteTexture(this.#bezierTarget.tex)
    gl.deleteTexture(this.#digitsTex)
    for (const p of [this.#bezier, this.#scene, this.#sceneBg, this.#taa, this.#blit]) gl.deleteProgram(p.program)
    gl.deleteVertexArray(this.#vao)
  }

  #freeTargets() {
    const gl = this.#gl
    for (const t of [this.#sceneTarget, this.#bgTarget, ...this.#taaTargets]) {
      if (!t) continue
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
    }
    this.#sceneTarget = null
    this.#bgTarget = null
    this.#taaTargets = []
  }

  #texture(filter: number) {
    const gl = this.#gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    // 밉맵 거르기는 줄일 때만 — 키울 때는 선형
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  #target(w: number, h: number, internal: number, type: number, filter: number): Target {
    const gl = this.#gl
    const tex = this.#texture(filter)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('그림판(framebuffer)을 만들 수 없어요')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { tex, fbo }
  }

  #link(fragment: string, names: string[]): Program {
    const gl = this.#gl
    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)
      if (!sh) throw new Error('셰이더를 만들 수 없어요')
      gl.shaderSource(sh, source)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`셰이더 컴파일 실패: ${gl.getShaderInfoLog(sh)}`)
      }
      return sh
    }
    const program = gl.createProgram()
    const vs = compile(gl.VERTEX_SHADER, FULLSCREEN_VS)
    const fs = compile(gl.FRAGMENT_SHADER, fragment)
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`셰이더 연결 실패: ${gl.getProgramInfoLog(program)}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    const u: Uniforms = {}
    for (const name of names) u[name] = gl.getUniformLocation(program, name)
    return { program, u }
  }
}
