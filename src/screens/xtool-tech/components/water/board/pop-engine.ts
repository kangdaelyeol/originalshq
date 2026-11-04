import {
  WATER_REVEAL,
  WATER_SPRING,
  clamp01,
  mix,
  round3,
  since,
  smooth,
  spring,
  waterClock,
} from '@/ohq-ui/water/motion'

// 유리 팝오버(여러 개 고르는 드롭다운)의 펼침·접힘 — D7 메뉴(lab/showcase/design7/liquid-menu-data.ts의
// openPose·closePose)를 세로로 옮겼다. 단추 = D7 둥근 버튼, 팝오버 유리 = 알약.
//   펼침: 알약 끝(아래 끝)이 단추에서 extend 스프링으로 뻗고(15% 넘침), 0.165s 늦게 붙은 쪽(위 끝)이 detach
//         스프링으로 떨어져 틈이 생긴다. 내용은 0.247s부터 21ms 간격으로 55ms씩(F82 → F86).
//   접힘: 내용은 곧바로(0.015 → 0.045s) 사라지고, 위 끝이 gather 스프링으로 단추에 다시 붙은 뒤(0.188s),
//         아래 끝이 extend 스프링으로 단추 속으로 빨려 들고 위 끝은 trail(임계 감쇠)로 끌려간다. 유리는
//         그 뒤 0.17 → 0.30s에 걷힌다(D7 pillOn).
// 움직이는 동안(펼침은 목이 끊기고 틈이 다 벌어질 때까지 ≈0.25s, 접힘 내내)은 칸과 유리를 SVG 한 장의 물
// 모양(기반 WaterGooShapeFilter → WaterGlassFilter gooShape 두 겹 — 빨강 = 칸, 초록 = 팝오버, 한 장으로
// σ10k 흐려 30x−14.5)으로 그려 D7처럼 붙어 있다가 목이 가늘어지며 끊기고, 접힐 때 다시 붙어 빨려 든다.
// 떨어져 있을 때는 CSS 유리(같은 k·lift)로 한 프레임에 바꿔 끼워 필터를 끈다(파랑 = 팝오버 참 모양이 떨어진
// 모양을 CSS와 같게 만든다).
// 좌표는 px — 0 = 단추 아래 끝, 단추에서 멀어지는 쪽이 +.

/** D7 시간표(초) */
export const POP_TIMING = {
  /** 붙은 쪽이 떨어지기 시작 — 알약 왼끝이 0.165s 늦게(F81 목) */
  detach: 0.165,
  /** 내용이 나오기 시작 — 아이콘 0.247s(F82 Activity 20%) */
  reveal: 0.247,
  /** 접힘 1단계 — 알약이 버튼에 다시 붙는 동안(F22.5 클릭 → F28.3 이동 시작) */
  gather: 0.188,
  /** 다시 누르면 지금 모양에서 새 움직임으로 넘어가는 시간(D7 mixPose) */
  blend: 0.15,
  /** 이 수 뒤의 항목은 같은 시각에 나온다(긴 목록이 늦게 끝나지 않게) */
  staggerCap: 8,
} as const

export interface PopGeometry {
  /** 단추와 유리 사이 틈(떨어진 뒤) */
  gap: number
  /** 유리 높이 */
  height: number
  /** 붙어 있을 때 유리 위 끝이 단추 속으로 들어가 있는 깊이(둥근 모서리가 안 보이게) */
  overlap: number
  /** 차례로 나타날 항목 수 */
  count: number
}

/** 한 순간의 모양 */
export interface PopPose {
  /** 단추 쪽 끝 */
  near: number
  /** 먼 끝 */
  far: number
  /** 유리 불투명도(D7 pillOn) */
  on: number
  items: number[]
}

const items = (g: PopGeometry, v: (i: number) => number) =>
  Array.from({ length: g.count }, (_, i) => v(i))

export function popRestPose(open: boolean, g: PopGeometry): PopPose {
  return open
    ? { near: g.gap, far: g.gap + g.height, on: 1, items: items(g, () => 1) }
    : { near: -g.overlap, far: 0, on: 0, items: items(g, () => 0) }
}

export function popOpenPose(t: number, g: PopGeometry): PopPose {
  const { detach, reveal, staggerCap } = POP_TIMING
  return {
    // D7 ext = CLOSED_R + (pillExt − CLOSED_R)·spring(t, 0.5, 34) — 단추 끝에서 뻗어 나간다
    far: (g.gap + g.height) * spring(t, WATER_SPRING.extend),
    // D7 lRel — 0.165s까지 단추 속에 있다가 detach 스프링(ζ0.45·ω36)으로 떨어져 나간다
    near:
      t < detach
        ? -g.overlap
        : -g.overlap +
          (g.gap + g.overlap) * spring(t - detach, WATER_SPRING.detach),
    on: 1,
    items: items(g, (i) =>
      clamp01(
        (t - reveal - Math.min(i, staggerCap) * WATER_REVEAL.stagger) /
          WATER_REVEAL.fade,
      ),
    ),
  }
}

export function popClosePose(t: number, g: PopGeometry): PopPose {
  // 내용은 곧바로 — D7 fade = (t − 0.015) / 0.03
  const fade = clamp01((t - 0.015) / WATER_REVEAL.out)
  const shown = items(g, () => 1 - fade)
  // 1단계: 떨어진 쪽이 gather 스프링(ζ0.6·ω47)으로 단추에 다시 붙는다(목표는 단추 속 −overlap, 9.5% 넘침)
  const nearA = (u: number) =>
    g.gap + (-g.overlap - g.gap) * spring(u, WATER_SPRING.gather)
  const open = g.gap + g.height
  if (t < POP_TIMING.gather)
    return { near: nearA(t), far: open, on: 1, items: shown }
  // 2단계: 먼 끝은 extend 스프링으로 단추 끝 0.5px 안쪽까지 빨려 들고(D7 목표 60 = 반지름 60.5 안쪽),
  // 붙은 쪽은 trail(임계 감쇠)로 끌려간다. 유리는 0.17 → 0.30s에 걷힌다.
  const tb = t - POP_TIMING.gather
  const n0 = nearA(POP_TIMING.gather)
  return {
    near: n0 + (-g.overlap - n0) * spring(tb, WATER_SPRING.trail),
    far: open + (-0.5 - open) * spring(tb, WATER_SPRING.extend),
    on: 1 - smooth((tb - 0.17) / 0.13),
    items: shown,
  }
}

/** 접힘이 다 끝나는 시각 — 유리가 걷히면(0.188 + 0.30) 내려도 된다 */
export const POP_CLOSE_END = POP_TIMING.gather + 0.3
/** 펼침이 끝나는 시각 — 가장 느린 detach 스프링이 0.1px 안으로(0.165 + 0.45) */
export const POP_OPEN_END = 0.62

export function mixPopPose(a: PopPose, b: PopPose, k: number): PopPose {
  return {
    near: mix(a.near, b.near, k),
    far: mix(a.far, b.far, k),
    on: mix(a.on, b.on, k),
    items: b.items.map((v, i) => mix(a.items[i] ?? v, v, k)),
  }
}

/** 펼칠 때 CSS 유리로 돌아가는 가장 이른 시각 — 목이 끊기고(0.219s) 내용이 나오기 시작할 때(0.247s) */
const GOO_OPEN_OUT = POP_TIMING.reveal
/**
 * 팝오버 참 모양(파랑)을 켜는 거리 — 칸과 7px 넘게 떨어지면 켜기 시작해 틈(10px)에서 다 켠다. 목이 이어진
 * 동안(σ 4.6px — 틈 6.5px 아래)은 꺼 둬야 물 모양의 둥근 목이 참 사각형에 덮이지 않는다
 */
const TRUE_FROM = 7
/**
 * 옅은 그림자(멈춘 팝오버에만) — 바꿔 낀 뒤 0.12초에 들어오고, 접힐 때는 칸에 다가오는 만큼(틈 10 → 6.5px, 목이
 * 생기는 거리) 빠져 목이 보일 때는 없다. 펼칠 때 거리로 정하지 않는 건 detach 넘침(15 → 8.9px)에 깜박이지 않게
 */
const SHADE_IN = 0.12
const SHADE_NECK = 6.5

/** 움직이는 동안 그리는 물 모양 — 없으면(동작 줄이기) CSS 유리만 */
export interface PopGooDom {
  svg: SVGSVGElement
  /** 초록 채널 — 팝오버 물 모양(밝기 = 물에 보태는 정도, D7 pillFill) */
  body: SVGRectElement
  /** 파랑 채널 — 팝오버 참 모양(떨어져 있을 때만, 멈춘 모양을 CSS와 같게) */
  trueBody: SVGRectElement
  /** 불투명 속 — 칸 밖에만(유리 무늬 아래) */
  fill: SVGRectElement
  /** 필터(바깥 유리 · 안 물 모양) — 세로 영역을 프레임마다 지금 모양만큼만 잡는다 */
  filters: SVGFilterElement[]
  /** 칸 높이·여백(필터 영역 계산) */
  box: { th: number; m: number }
  /** 칸의 CSS 유리 층 — SVG가 칸 유리까지 그리는 동안 숨긴다 */
  triggerGlass: HTMLElement
}

export interface PopDom {
  /** 유리(높이·자리를 엔진이 쓴다) */
  glass: HTMLElement
  /** 차례로 나타날 항목 */
  items: HTMLElement[]
  /** 내용 묶음 — 접히는 동안 누르지 못하게 */
  content: HTMLElement
  goo?: PopGooDom | null
  /** 다 펼쳐진 팝오버의 옅은 그림자 층(CSS 유리와 같은 자리, 진하기는 엔진이 쓴다) — 물 모양 동안은 0 */
  float?: HTMLElement | null
}

/**
 * 팝오버 움직임 엔진 — 유리의 자리·높이·불투명도와 항목 불투명도를 rAF로 바로 쓴다(React는 열림 상태만).
 * dir이 -1이면 단추 위로 펼친다(아래 자리가 모자랄 때). 움직임이 끝나면 rAF도 멈춘다.
 *
 * 물 모양(goo)은 칸과 유리가 붙어 있거나 목으로 이어진 동안만 쓴다 — 펼침은 처음부터 목이 끊기고 틈이 다 벌어질
 * 때(0.247s 뒤 첫 프레임)까지, 접힘은 내내. 기반 필터가 떨어져 멈춘 모양을 CSS 유리와 같게 그려서(참 모양 —
 * 칸 빨강·팝오버 파랑) 한 프레임에 바꿔 끼운다.
 */
export class WaterPopEngine {
  private dom: PopDom
  private geo: PopGeometry
  private dir: 1 | -1
  private open = false
  private start = -Infinity
  private from: PopPose | null = null
  private pose: PopPose
  private stop: (() => void) | null = null
  private onClosed: (() => void) | null = null
  private reduced: boolean
  private written = { near: NaN, size: NaN, on: NaN, items: [] as number[] }
  /** 지금 그리는 쪽 — css: CSS 유리 · svg: 물 모양 */
  private layer: 'css' | 'svg' = 'css'
  private gooWritten = {
    y: NaN,
    h: NaN,
    g: NaN,
    u: NaN,
    fy: NaN,
    fh: NaN,
    fo: NaN,
    ry: NaN,
    rh: NaN,
  }
  /** 옅은 그림자 진하기 · 접힘을 시작할 때의 값 · 펼칠 때 들어오기 시작한 시각(아직이면 NaN) */
  private shade = 0
  private shadeFrom = 0
  private shadeAt = NaN
  private shadeWritten = NaN
  /** 장치 화소 배율 — 떨어진 모양(CSS 유리 · 참 모양을 켠 물 모양)의 끝을 화소에 붙인다 */
  private dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

  constructor(dom: PopDom, geo: PopGeometry, dir: 1 | -1, reduced: boolean) {
    this.dom = dom
    this.geo = geo
    this.dir = dir
    this.reduced = reduced
    this.pose = popRestPose(false, geo)
    this.draw(this.pose)
  }

  /** 열고 닫기 — at은 누른 시각(waterClock). 닫힘이 끝나면 onClosed */
  setOpen(open: boolean, at?: number, onClosed?: () => void) {
    if (open === this.open) return
    const now = since(at)
    this.from =
      now - this.start < (this.open ? POP_OPEN_END : POP_CLOSE_END)
        ? this.pose
        : null
    this.open = open
    this.start = now
    this.onClosed = onClosed ?? null
    this.dom.content.style.pointerEvents = open ? '' : 'none'
    // 옅은 그림자 — 펼칠 때는 CSS 유리로 바꿔 낄 때부터(물 모양이 없으면 내용이 나올 때부터), 접힐 때는 지금 값에서
    this.shadeFrom = this.shade
    this.shadeAt = open && !this.dom.goo ? POP_TIMING.reveal : NaN
    this.stop?.()
    // 움직이는 동안은 물 모양(SVG)으로 — 칠하기 전에 바꾼다(레이아웃 효과에서 불린다)
    if (!this.reduced && this.dom.goo) this.setLayer('svg')
    this.stop = this.reduced ? this.runReduced() : this.run()
  }

  destroy() {
    this.stop?.()
    this.stop = null
    const goo = this.dom.goo
    if (goo) {
      goo.triggerGlass.style.opacity = ''
      goo.svg.style.display = ''
    }
  }

  /** 물 모양(SVG) ↔ CSS 유리 — 한 프레임에 바꾼다. 칸 유리도 같이 넘긴다 */
  private setLayer(layer: 'css' | 'svg') {
    const goo = this.dom.goo
    if (!goo || layer === this.layer) return
    this.layer = layer
    const css = this.dom.glass.style
    if (layer === 'svg') {
      this.gooWritten = {
        y: NaN,
        h: NaN,
        g: NaN,
        u: NaN,
        fy: NaN,
        fh: NaN,
        fo: NaN,
        ry: NaN,
        rh: NaN,
      }
      goo.svg.style.display = 'block'
      goo.triggerGlass.style.opacity = '0'
      css.visibility = 'hidden'
    } else {
      goo.svg.style.display = ''
      goo.triggerGlass.style.opacity = ''
      css.visibility = ''
      this.written = { ...this.written, near: NaN, size: NaN, on: NaN }
    }
    this.draw(this.pose)
  }

  private run() {
    return this.loop((t) => {
      const end = this.open ? POP_OPEN_END : POP_CLOSE_END
      let pose = this.open
        ? popOpenPose(t, this.geo)
        : popClosePose(t, this.geo)
      if (this.from && t < POP_TIMING.blend)
        pose = mixPopPose(this.from, pose, smooth(t / POP_TIMING.blend))
      if (t >= end) pose = popRestPose(this.open, this.geo)
      return { pose, done: t >= end }
    })
  }

  /** 동작 줄이기 — 모양은 그대로 두고 0.1초 동안 흐리게만 바꾼다 */
  private runReduced() {
    const rest = popRestPose(true, this.geo)
    const from = this.pose.on
    return this.loop((t) => {
      const k = clamp01(t / 0.1)
      const on = this.open ? mix(from, 1, k) : mix(from, 0, k)
      return {
        pose: { ...rest, on, items: rest.items.map(() => on) },
        done: k >= 1,
      }
    })
  }

  private loop(step: (t: number) => { pose: PopPose; done: boolean }) {
    let raf = 0
    const tick = () => {
      const t = waterClock() - this.start
      const { pose, done } = step(t)
      this.pose = pose
      // 펼칠 때 — 목이 끊기고 틈이 다 벌어지면(참 모양이 다 켜지면) CSS 유리로. 그 뒤 옅은 그림자가 들어온다
      if (
        this.open &&
        this.layer === 'svg' &&
        t >= GOO_OPEN_OUT &&
        pose.near >= this.geo.gap
      ) {
        this.setLayer('css')
        this.shadeAt = t
      }
      this.shade = this.shadeFor(t, pose)
      this.draw(pose)
      // 펼침은 그림자가 다 들어올 때까지(바꿔 끼우기가 늦었던 때 — 숨은 탭 등)
      if (done && (!this.open || this.shade >= 1)) {
        raf = 0
        this.from = null
        if (!this.open) {
          // 접힘 끝 — 남은 칸 유리를 CSS로 돌려주고 내린다
          this.shade = 0
          this.setLayer('css')
          const cb = this.onClosed
          this.onClosed = null
          cb?.()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
  }

  private snap(v: number) {
    return Math.round(v * this.dpr) / this.dpr
  }

  /** 옅은 그림자 진하기 — 동작 줄이기면 유리와 같이 */
  private shadeFor(t: number, p: PopPose) {
    if (this.reduced) return clamp01(p.on)
    if (this.open) {
      if (t >= POP_OPEN_END + SHADE_IN) return 1
      return Number.isNaN(this.shadeAt)
        ? 0
        : smooth((t - this.shadeAt) / SHADE_IN)
    }
    return (
      this.shadeFrom *
      smooth((p.near - SHADE_NECK) / (this.geo.gap - SHADE_NECK))
    )
  }

  /**
   * 모양 → style. 바뀐 값만 쓴다(같은 값을 다시 써서 스타일 계산을 부르지 않게). 물 모양을 그리는 동안은 CSS
   * 유리를 건드리지 않는다(숨은 상자의 높이를 바꿔 레이아웃을 부르지 않게)
   */
  private draw(p: PopPose) {
    const w = this.written
    const on = round3(clamp01(p.on))
    if (this.layer === 'svg' && this.dom.goo) {
      this.drawGoo(p, on)
    } else {
      // 끝을 장치 화소에 붙인다 — 크롬은 CSS 상자 높이는 화소에 붙이고 transform은 소수 그대로 흐리게 옮겨, 그대로
      // 두면 물 모양(소수 자리 그대로 그린다)과 바꿔 끼울 때 테두리가 반 화소 어긋난다
      const near = this.snap(p.near)
      const far = this.snap(p.far)
      const size = Math.max(0, far - near)
      // 아래로 펼치면 위 끝 = near, 위로 펼치면 위 끝 = −far
      const top = this.dir === 1 ? near : -far
      const st = this.dom.glass.style
      if (top !== w.near) {
        st.transform = `translate3d(0, ${top}px, 0)`
        if (this.dom.float) this.dom.float.style.transform = st.transform
      }
      if (size !== w.size) {
        st.height = `${size}px`
        if (this.dom.float) this.dom.float.style.height = st.height
      }
      if (on !== w.on) st.opacity = String(on)
      w.near = top
      w.size = size
      w.on = on
    }
    const shade = round3(this.shade)
    if (this.dom.float && shade !== this.shadeWritten)
      this.dom.float.style.opacity = String(shade)
    this.shadeWritten = shade
    this.dom.items.forEach((node, i) => {
      const v = round3(clamp01(p.items[i] ?? 0))
      if (v !== w.items[i]) node.style.opacity = String(v)
      w.items[i] = v
    })
  }

  /**
   * 물 모양 — 초록(물 모양)·파랑(참 모양) 팝오버의 자리·높이, 그 아래 불투명 속, 필터 세로 영역. 파랑은 칸과
   * 7 → 10px 떨어지는 동안 켜진다(목이 이어진 동안은 꺼 둔다)
   */
  private drawGoo(p: PopPose, on: number) {
    const { body, trueBody, fill, filters, box } = this.dom.goo!
    const gw = this.gooWritten
    // D7 pillFill — 알약이 물에 보태는 정도를 초록 밝기로(걷힐 때 모양이 매끄럽게 줄어든다)
    const g = Math.round(255 * on)
    const u = round3(
      on * smooth((p.near - TRUE_FROM) / (this.geo.gap - TRUE_FROM)),
    )
    // 떨어져 참 모양을 켜는 동안은 끝을 CSS 유리처럼 화소에 붙인다(바꿔 끼울 때 같은 자리). 붙어 있는 동안은 소수
    // 자리 그대로(목이 매끄럽게)
    const near = u > 0 ? this.snap(p.near) : round3(p.near)
    const far = u > 0 ? this.snap(p.far) : round3(p.far)
    const h = round3(Math.max(0, far - near))
    const y = this.dir === 1 ? near : -far
    if (y !== gw.y) {
      body.setAttribute('y', String(y))
      trueBody.setAttribute('y', String(y))
    }
    if (h !== gw.h) {
      body.setAttribute('height', String(h))
      trueBody.setAttribute('height', String(h))
    }
    if (g !== gw.g) body.setAttribute('fill', `rgb(0,${g},0)`)
    if (u !== gw.u) trueBody.setAttribute('fill-opacity', String(u))
    // 속은 칸 바깥만 — 칸 속으로 들어간 부분은 칸 글자를 가리지 않게 자른다
    const inner = Math.max(0, near)
    const fh = round3(Math.max(0, far - inner))
    const fy = this.dir === 1 ? inner : -far
    if (fy !== gw.fy) fill.setAttribute('y', String(fy))
    if (fh !== gw.fh) fill.setAttribute('height', String(fh))
    if (on !== gw.fo) fill.setAttribute('opacity', String(on))
    // 필터 세로 영역 — 칸 + 지금 뻗은 데까지(여백 포함). 패스마다 칠하는 넓이를 줄인다(비용은 주로 패스 수라
    // 효과는 작다). 영역의 위 끝(흐림이 반으로 줄여 흐리는 격자의 기준)은 움직이지 않게 — 위로 펼치면 짝수 장치
    // 화소 단위로만 옮긴다
    const reach = Math.max(0, far)
    const q = (2 * Math.ceil(this.dpr)) / this.dpr
    const ry =
      this.dir === 1 ? -box.th - box.m : -q * Math.ceil((reach + box.m) / q)
    const rh = round3(
      this.dir === 1 ? box.th + reach + 2 * box.m : box.th + box.m - ry,
    )
    for (const f of filters) {
      if (ry !== gw.ry) f.setAttribute('y', String(ry))
      if (rh !== gw.rh) f.setAttribute('height', String(rh))
    }
    this.gooWritten = { y, h, g, u, fy, fh, fo: on, ry, rh }
  }
}
