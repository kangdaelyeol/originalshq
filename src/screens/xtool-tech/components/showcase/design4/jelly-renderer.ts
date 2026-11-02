// 젤리 슬라이더를 캔버스에 그리는 WebGL2 렌더러 — 패스 넷:
//  1) 줄 거리장(256×128, 반정밀도 실수) 굽기  2) 장면 레이마칭(흔들린 화면 창)
//  3) TAA(지난 결과와 섞기)  4) 캔버스 크기로 늘려 그리기.
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

// 줄 거리장이 덮는 범위 — 고정점 왼쪽으로 줄 길이의 1%, 끝 오른쪽으로 10%, 위로 0.65까지
const BBOX = { left: -1 - 1.9 * 0.01, right: 0.9 + 1.9 * 0.1, bottom: -0.3, top: 0.65 } as const
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
  readonly #taa: Program
  readonly #blit: Program
  readonly #bezierTarget: Target
  readonly #digitsTex: WebGLTexture
  readonly #digitsCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  #sceneTarget: Target | null = null
  #taaTargets: Target[] = []
  #renderW = 0
  #renderH = 0
  #view: ViewWindow = viewWindowFor(4 / 3)
  #fixedView: ViewWindow | null = null
  #digitsValue = -1
  #history = 0
  #haltonIndex = 1

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
    this.#scene = this.#link(SCENE_FS, [
      'uBezier', 'uDigits', 'uEndCap', 'uBBox', 'uJellyColor', 'uLightDir', 'uCamPos', 'uCamRight', 'uCamUp',
      'uCamForward', 'uTanHalf', 'uView', 'uJitter', 'uResolution', 'uLayers', 'uDigitsOn',
    ])
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
    const s = this.#scene.u
    gl.useProgram(this.#scene.program)
    gl.uniform1i(s.uBezier, 0)
    gl.uniform1i(s.uDigits, 1)
    gl.uniform4f(s.uBBox, BBOX.left, BBOX.right, BBOX.bottom, BBOX.top)
    gl.uniform3f(s.uLightDir, LIGHT[0], LIGHT[1], LIGHT[2])
    gl.uniform3f(s.uJellyColor, JELLY_COLOR[0], JELLY_COLOR[1], JELLY_COLOR[2])
    const c = JELLY_CAMERA
    gl.uniform3f(s.uCamPos, c.eye.x, c.eye.y, c.eye.z)
    gl.uniform3f(s.uCamRight, c.right.x, c.right.y, c.right.z)
    gl.uniform3f(s.uCamUp, c.up.x, c.up.y, c.up.z)
    gl.uniform3f(s.uCamForward, c.forward.x, c.forward.y, c.forward.z)
    gl.uniform1f(s.uTanHalf, c.tanHalf)
    gl.useProgram(this.#taa.program)
    gl.uniform1i(this.#taa.u.uCurrent, 0)
    gl.uniform1i(this.#taa.u.uHistory, 1)
    gl.useProgram(this.#blit.program)
    gl.uniform1i(this.#blit.u.uTex, 0)
  }

  get view() {
    return this.#view
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
    const s = this.#scene.u
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo)
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.#scene.program)
    gl.uniform4f(s.uEndCap, rope.pos[n - 4], rope.pos[n - 3], rope.pos[n - 2], rope.pos[n - 1])
    gl.uniform4f(s.uView, v.left, v.bottom, v.right, v.top)
    gl.uniform2f(s.uJitter, jx, jy)
    gl.uniform2f(s.uResolution, w, h)
    gl.uniform4f(s.uLayers, +layers.jelly, +layers.shadow, +layers.caustics, +layers.bounce)
    gl.uniform1f(s.uDigitsOn, +layers.digits)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.#bezierTarget.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.#digitsTex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

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
    for (const p of [this.#bezier, this.#scene, this.#taa, this.#blit]) gl.deleteProgram(p.program)
    gl.deleteVertexArray(this.#vao)
  }

  #freeTargets() {
    const gl = this.#gl
    for (const t of [this.#sceneTarget, ...this.#taaTargets]) {
      if (!t) continue
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
    }
    this.#sceneTarget = null
    this.#taaTargets = []
  }

  #texture(filter: number) {
    const gl = this.#gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
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
