import { animate, round3, since } from './motion'

// 물결 두 겹(D7) — 반지름 22에서 초속 525px로 퍼지고 22px 간격, 0.3초 동안 1-u²로 흐려진다. 어두운 고리는 밝은
// 고리 11px 안쪽(F426~F432, lab/showcase/design7/liquid-menu-data.ts RIPPLE). 물방울이 닿을 때(fx.ts
// WaterFxEngine)와 누르자마자(WaterRipple)가 같은 고리 그리기(drawRipple)를 쓴다. 값은 영상 px — 작은 부품은
// 배율(k = 부품 높이 / 50.5)로 줄인다.

/** 물결 시간표(D7 RIPPLE) — fx.ts WATER_DROP.ripple이 이것을 가리킨다 */
export const WATER_RIPPLE = { r0: 22, speed: 525, gap: 22, life: 0.3, inner: 11 } as const

/** 물결이 보일 유리 영역(층 좌표 px) — 이 밖으로는 안 퍼진다 */
export interface RippleClip {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const NS = 'http://www.w3.org/2000/svg'
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

/** 물결 고리 SVG 한 벌 — defs(잘라 낼 사각형·흐림)와 고리 무리. 고리는 [어두운, 밝은] 두 겹 */
export interface RippleLayer {
  defs: SVGDefsElement
  group: SVGGElement
  rings: (readonly [SVGCircleElement, SVGCircleElement])[]
  clipRect: SVGRectElement
  blur: SVGFEGaussianBlurElement
}

/**
 * 고리 SVG를 만든다(svg에 붙이는 건 부르는 쪽) — 무리는 처음에 숨겨 두고 class="water-fx__rings"를 단다.
 * 흐림 σ2.2 · 어두운 고리 13%·굵기 8 · 밝은 고리 34%·굵기 7(D7 liquid-glass.tsx)
 */
export function createRippleLayer(id: string): RippleLayer {
  const defs = el('defs', {})
  const clip = el('clipPath', { id: `${id}-clip` })
  const clipRect = el('rect', { x: -9999, y: -9999, width: 19998, height: 19998 })
  clip.append(clipRect)
  const filter = el('filter', { id: `${id}-blur`, x: '-50%', y: '-50%', width: '200%', height: '200%' })
  const blur = el('feGaussianBlur', { stdDeviation: 2.2 })
  filter.append(blur)
  defs.append(clip, filter)
  const group = el('g', {
    class: 'water-fx__rings',
    'clip-path': `url(#${id}-clip)`,
    filter: `url(#${id}-blur)`,
    opacity: 0,
  })
  const rings = [0, 1].map(() => {
    const g = el('g', {})
    const dark = el('circle', { r: 1, fill: 'none', stroke: '#000', 'stroke-opacity': 0.13, 'stroke-width': 8 })
    const bright = el('circle', { r: 1, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.34, 'stroke-width': 7 })
    g.append(dark, bright)
    group.append(g)
    return [dark, bright] as const
  })
  return { defs, group, rings, clipRect, blur }
}

/** 크기 배율과 잘라 낼 영역 — 물결을 띄울 때 한 번. clip을 안 주면 앞의 영역을 그대로 둔다 */
export function sizeRipple(layer: RippleLayer, k: number, clip?: RippleClip) {
  if (clip) {
    for (const [a, v] of Object.entries({
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      rx: clip.radius,
    })) {
      layer.clipRect.setAttribute(a, String(round3(v)))
    }
  }
  layer.blur.setAttribute('stdDeviation', String(round3(2.2 * k)))
  for (const [dark, bright] of layer.rings) {
    dark.setAttribute('stroke-width', String(round3(8 * k)))
    bright.setAttribute('stroke-width', String(round3(7 * k)))
  }
}

/**
 * 한 프레임 — 퍼진 지 rho초인 물결 두 겹을 (x, y)에 그린다(바깥 고리가 앞서고 안쪽이 22px 뒤따른다, F428:
 * 60·72 / 81·93). 0.3초가 지났으면(또는 아직이면) 숨기고 false
 */
export function drawRipple(layer: RippleLayer, rho: number, k: number, x: number, y: number): boolean {
  const R = WATER_RIPPLE
  if (!(rho >= 0 && rho < R.life)) {
    layer.group.setAttribute('opacity', '0')
    return false
  }
  const fade = rho / R.life
  layer.group.setAttribute('opacity', String(round3(1 - fade * fade)))
  const lead = (R.r0 + R.speed * rho) * k
  layer.rings.forEach(([dark, bright], i) => {
    const r = lead - R.gap * k * i
    const show = r > 6 * k ? '1' : '0'
    for (const [node, rr] of [
      [bright, r],
      [dark, r - R.inner * k],
    ] as const) {
      node.setAttribute('cx', String(round3(x)))
      node.setAttribute('cy', String(round3(y)))
      node.setAttribute('r', String(round3(Math.max(1, rr))))
      node.setAttribute('opacity', show)
    }
  })
  return true
}

export interface RippleOptions {
  /** 물결 가운데(층 좌표 px) */
  x: number
  y: number
  /** 크기 배율 — 부품 높이 / 50.5(D7 표시 알약 높이) */
  scale: number
  /** 물결이 보일 유리 영역 — 이 밖으로는 안 퍼진다(없으면 어디로든) */
  clip?: RippleClip
  /** 누른 시각(waterClock) */
  at?: number
}

const EVERYWHERE: RippleClip = { x: -9999, y: -9999, width: 19998, height: 19998, radius: 0 }

let uid = 0

/**
 * 누르자마자 퍼지는 물결 두 겹 — D7 물결과 같은 모양·시간표(drawRipple)인데 물방울 없이 곧바로 시작한다(칩을
 * 켤 때·토스트가 성공할 때). WaterFxEngine은 물방울이 떨어진 뒤(0.15s+)에야 물결을 그린다. 부품 위에 겹친
 * SVG 한 장(px 단위, overflow visible)에 그리고, 끝나면 rAF를 멈춘다.
 */
export class WaterRipple {
  private svg: SVGSVGElement
  private layer: RippleLayer
  private stop: (() => void) | null = null

  constructor(svg: SVGSVGElement) {
    this.svg = svg
    this.layer = createRippleLayer(`ohq-water-ripple-${++uid}`)
    svg.append(this.layer.defs, this.layer.group)
  }

  play(o: RippleOptions) {
    this.stop?.()
    sizeRipple(this.layer, o.scale, o.clip ?? EVERYWHERE)
    this.stop = animate((rho) => {
      const busy = drawRipple(this.layer, Math.max(0, rho), o.scale, o.x, o.y)
      if (!busy) this.stop = null
      return busy
    }, since(o.at))
  }

  destroy() {
    this.stop?.()
    this.stop = null
    this.svg.replaceChildren()
  }
}

/**
 * 물결 층 좌표로 요소 자리(유리 영역)와 물결 가운데를 잰다 — 누른 순간(이벤트 처리기)에서만 부른다(레이아웃을
 * 읽는다). point(화면 좌표)를 주면 누른 자리에서, 없으면(키보드) 가운데에서 퍼진다.
 */
export function rippleAt(
  layer: Element,
  target: Element,
  opts: { radius?: number; point?: { x: number; y: number } | null } = {},
): RippleOptions {
  const a = layer.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const x = b.left - a.left
  const y = b.top - a.top
  const p = opts.point
  return {
    x: p ? p.x - a.left : x + b.width / 2,
    y: p ? p.y - a.top : y + b.height / 2,
    scale: b.height / 50.5,
    clip: { x, y, width: b.width, height: b.height, radius: opts.radius ?? b.height / 2 },
  }
}

/** 마우스로 눌렀으면 그 자리(키보드 Enter·Space는 detail 0 — 가운데) */
export const pressPoint = (e: { detail: number; clientX: number; clientY: number }) =>
  e.detail > 0 ? { x: e.clientX, y: e.clientY } : null
