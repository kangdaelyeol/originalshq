import {
  approach,
  localFrame,
  onFrame,
  placeAt,
  project,
  rad,
  seeded,
  solveLocal,
  wrapPi,
  type CameraPose,
  type LocalFrame,
  type Projected,
  type Vec3,
  type Viewport,
} from './brain-camera'
import type { BrainFocus, BrainStop, BrainWorld } from './brain-map'
import {
  CAMERA_D,
  CAMERA_TAU,
  IDLE_SPIN,
  LOOK_FOCUS,
  LOOK_OVERVIEW,
  LOOK_VOICE,
  SIGNAL_SPEED,
  SIGNALS_PER_MIN,
  SPHERE_R,
  STATS_MS,
  ZOOM_FOCUS,
  ZOOM_OVERVIEW,
} from './design14-data'

export type { BrainFocus }
/** map = 지도(걷기·전체 보기), voice = 음성 모드 화면(전체 보기 확대로 말하는 쪽을 정면에, 초점 밖은 사라진다) */
export type BrainMode = 'map' | 'voice'

/** 엔진이 직접 고치는 DOM — 매 프레임 React를 다시 그리지 않으려고 */
export interface BrainDom {
  /** 장면 뿌리 — 글자 크기(1em = 10w)·크기를 잰다 */
  root: HTMLElement
  /** 먼지·선·신호 */
  canvas: HTMLCanvasElement
  /** 둥근 테두리 — 화면 가운데에 붙어 확대만 따라간다 */
  ring: HTMLElement
  /** 구 안 노을빛 — 코어를 따라간다 */
  haze: HTMLElement
  /** data-d14-node 자식들(부서·자리·코어·YOU) */
  nodes: HTMLElement
  /** 초점 부서의 머리 자리에 붙는 칸(음성 모드) */
  headAnchor: HTMLElement | null
  /** YOU에 붙는 칸 */
  youAnchor: HTMLElement | null
}

type PathKind = 'streak' | 'dot' | 'white' | 'gold'
/** 허브 id 또는 'core'·'you' */
type Owner = string

interface SignalPath {
  a: Vec3
  b: Vec3
  len: number
  kind: PathKind
  owner: Owner
  weight: number
  /** YOU 주제 줄 */
  topic?: boolean
  /** 코어에 닿는 줄(코어 ↔ 부서·YOU·노란 점) — 음성 모드에서는 구슬 아래라 그리지 않는다(F330·F480에 없다) */
  core?: boolean
  /** 부서 ↔ 머리 자리 */
  head?: boolean
}

interface Signal {
  path: SignalPath
  start: number
  dur: number
  /** 1 = a→b, −1 = b→a */
  dir: 1 | -1
}

interface NodeRef {
  el: HTMLElement
  /** 부서·코어·YOU 이름표 — 뒤로 돌아가면 사라진다 */
  label: HTMLElement | null
  pos: Vec3
  owner: Owner
  /** 부서 머리 자리 */
  head?: boolean
  z: number
}

// ── 먼지(구 안 입자) ──────────────────────────────────────────────────────────
// t=0 F1: 테두리 안 국소 최댓값 2,643개(겹친 것은 하나로 세진다), 가운데 밀도가 가장자리의 5배(31 → 6 /1000px²).
// 색은 주황·살구가 대부분, 흐린 회분홍과 흰빛이 조금(무작위 2,000개 표본 중 밝은 것: 주황 #e55f1b·#c45223,
// 살구 #d2885e·#b66f5e, 회분홍 #a29999·#886c5d, 흰빛 #dfd2cb).
const DUST_COUNT = 3800
const DUST_COLORS: readonly (readonly [number, string])[] = [
  [0.36, '232,104,56'],
  [0.3, '208,138,108'],
  [0.24, '184,150,140'],
  [0.1, '236,222,214'],
]
/** 초점일 때 먼지 밝기 — F218 구 안 밝기 중앙값 44 → 28, 입자가 거의 사라진다 */
const DUST_FOCUS = 0.16
const ALPHA_STEPS = 8

interface Dust {
  x: Float32Array
  y: Float32Array
  z: Float32Array
  size: Float32Array
  alpha: Float32Array
  color: Uint8Array
}

function makeDust(): Dust {
  const rnd = seeded(1404)
  const d: Dust = {
    x: new Float32Array(DUST_COUNT),
    y: new Float32Array(DUST_COUNT),
    z: new Float32Array(DUST_COUNT),
    size: new Float32Array(DUST_COUNT),
    alpha: new Float32Array(DUST_COUNT),
    color: new Uint8Array(DUST_COUNT),
  }
  for (let i = 0; i < DUST_COUNT; i++) {
    // 반은 공 안에 고르게, 반은 코어 둘레로 몰리게(t=1~5 코어 둘레가 짙은 붉은 안개)
    const core = rnd() < 0.5
    const r = SPHERE_R * (core ? 0.88 * Math.pow(rnd(), 2.1) : 0.97 * Math.cbrt(rnd()))
    const u = rnd() * 2 - 1
    const t = rnd() * Math.PI * 2
    const q = Math.sqrt(1 - u * u)
    d.x[i] = r * q * Math.cos(t)
    d.y[i] = r * u
    d.z[i] = r * q * Math.sin(t)
    d.size[i] = 1.3 + rnd() * rnd() * 2.7
    d.alpha[i] = 0.2 + rnd() * 0.6
    const pick = rnd()
    let acc = 0
    for (let c = 0; c < DUST_COLORS.length; c++) {
      acc += DUST_COLORS[c][0]
      if (pick <= acc) {
        d.color[i] = c
        break
      }
    }
  }
  return d
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** YOU 칸 배율의 기준 — 음성 화면 정면 = 확대 0.76 × 원근 1.125 */
const YOU_SLOT_UNIT = 0.855

/** 깊이로 흐려지기 — 뒤쪽 부서 고리는 앞쪽의 약 0.4배 밝기(t=47.8 SALES·STRATEGY) */
const depthFade = (depth: number) => 0.38 + 0.62 * smooth(-300, 260, depth)
/**
 * 이름표는 더 빨리 사라진다 — t=0: 옆에 선 STRATEGY 이름은 흐리게 보이고, 뒤쪽 FINANCE·SALES는 고리만 보인다
 */
const labelFade = (depth: number) => smooth(-190, 40, depth)

// ── 신호 그리기(부품 견본 SignalLine도 같이 쓴다) ──────────────────────────────
/**
 * 줄 위를 가는 신호 하나 — 머리가 밝고 꼬리가 사라지는 선. p는 0~1 진행, tail은 꼬리 길이(px).
 * 코어 ↔ 부서 줄의 신호는 길이 약 70w의 꼬리(t=1.9~2.1 F58~F65, t=51.1 o100~o106).
 */
export function drawSignal(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  p: number,
  tail: number,
  width: number,
  rgb: string,
  alpha: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const hx = ax + dx * p
  const hy = ay + dy * p
  const back = Math.min(tail, len * p)
  const tx = hx - (dx / len) * back
  const ty = hy - (dy / len) * back
  if (back > 0.5) {
    const g = ctx.createLinearGradient(tx, ty, hx, hy)
    g.addColorStop(0, `rgba(${rgb},0)`)
    g.addColorStop(1, `rgba(${rgb},${alpha.toFixed(3)})`)
    ctx.strokeStyle = g
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(hx, hy)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(255,236,220,${Math.min(1, alpha * 1.1).toFixed(3)})`
  ctx.beginPath()
  ctx.arc(hx, hy, width * 0.95, 0, Math.PI * 2)
  ctx.fill()
}

/** 줄 종류마다 신호 모양 — 분당 2,000개 × 평균 약 1.5초 = 날아가는 중 약 50개(영상 47~56) */
const SIGNAL_STYLE: Record<PathKind, { speed: number; tail: number; width: number; rgb: string; alpha: number }> = {
  streak: { speed: SIGNAL_SPEED, tail: 84, width: 1.8, rgb: '255,118,52', alpha: 0.95 },
  dot: { speed: 60, tail: 16, width: 1.4, rgb: '255,130,70', alpha: 0.85 },
  white: { speed: 190, tail: 34, width: 1.3, rgb: '246,240,232', alpha: 0.85 },
  gold: { speed: 60, tail: 10, width: 1.3, rgb: '242,190,80', alpha: 0.8 },
}

// ── 엔진 ───────────────────────────────────────────────────────────────────
interface Stats {
  signals: number
  inFlight: number
}

export interface BrainEngineOptions {
  /** 움직임 줄이기 — 돌지 않고, 신호가 멈추고, 카메라가 바로 옮겨 간다 */
  reduced: boolean
  /** 처음 카메라 방위각(도) — 0이면 영상 첫 장면(t=0)과 같은 자세. 기본 7°: 화면이 뜨고 2.4초 뒤에 그 자세 */
  theta?: number
}

export class BrainEngine {
  readonly #dom: BrainDom
  readonly #reduced: boolean
  /** 허브·자리·YOU 자리 — setWorld로 바뀐다(데이터가 실시간으로 바뀌는 화면) */
  #world: BrainWorld
  readonly #ctx: CanvasRenderingContext2D | null
  readonly #dust = makeDust()
  /** 먼지 투영 자리(매 프레임 새로 만들지 않게) */
  readonly #dx = new Float32Array(DUST_COUNT)
  readonly #dy = new Float32Array(DUST_COUNT)
  readonly #dw = new Float32Array(DUST_COUNT)
  /** 입자마다 묶음 번호(255 = 안 그림) → 묶음 순서로 늘어놓은 입자 번호 */
  readonly #group = new Uint8Array(DUST_COUNT)
  readonly #sorted = new Int32Array(DUST_COUNT)
  readonly #groupN = new Int32Array(DUST_COLORS.length * ALPHA_STEPS + 1)
  readonly #frames = new Map<Owner, LocalFrame>()
  #satellites: Vec3[] = []
  #topics: { pos: Vec3; waiting: boolean }[] = []
  /** YOU 주제 점 그리기 — 음성 모드 FounderConstellation이 대신 그릴 때 끈다 */
  #topicsOn = true
  #headHidden = false
  #nodes: NodeRef[] = []
  #paths: SignalPath[] = []
  #weightSum = 0
  #signals: Signal[] = []
  /** 최근 신호들이 생긴 시각(분당 수 세기) */
  #spawned: number[] = []
  #nextSpawn = 0
  #focus: BrainFocus = 'overview'
  #mode: BrainMode = 'map'
  #pose: CameraPose
  #target: CameraPose
  #dustLevel = 1
  /** 부서마다 선·신호 밝기(초점 부서 1, 나머지 흐리게) */
  #vis = new Map<Owner, number>()
  #vp: Viewport = { cx: 0, cy: 0, k: 1 }
  #w = 0
  #h = 0
  #dpr = 1
  #raf = 0
  #last = 0
  #visible = true
  #statsAt = 0
  /** 엔진을 만든 시각 — 처음 6초는 지난 시간으로 나눠 분당 수를 센다 */
  #born = performance.now() / 1000 - 1.6
  #stats: Stats = { signals: SIGNALS_PER_MIN, inFlight: 0 }
  readonly #resize: ResizeObserver
  readonly #intersect: IntersectionObserver
  readonly #p: Projected = { x: 0, y: 0, s: 1, depth: 0 }
  readonly #q: Projected = { x: 0, y: 0, s: 1, depth: 0 }
  /** 지난 프레임 깊이 순서 — 바뀔 때만 z-index를 쓴다 */
  #zOrder: NodeRef[] = []

  constructor(dom: BrainDom, opts: BrainEngineOptions, world: BrainWorld) {
    this.#dom = dom
    this.#reduced = opts.reduced
    this.#world = world
    this.#ctx = dom.canvas.getContext('2d')
    const theta = rad(opts.theta ?? 7)
    this.#pose = { theta, zoom: ZOOM_OVERVIEW, look: LOOK_OVERVIEW }
    this.#target = { ...this.#pose }
    this.#buildWorld()
    this.collectNodes()
    this.#resize = new ResizeObserver(() => this.#measure())
    this.#resize.observe(dom.root)
    this.#intersect = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting
      if (this.#visible) this.#kick()
    })
    this.#intersect.observe(dom.root)
    document.addEventListener('visibilitychange', this.#onVisibility)
    this.#measure()
    if (!this.#reduced) this.#warmUp()
    this.#kick()
  }

  dispose() {
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    this.#resize.disconnect()
    this.#intersect.disconnect()
    document.removeEventListener('visibilitychange', this.#onVisibility)
  }

  get focus() {
    return this.#focus
  }

  /** 허브·자리가 바뀌었을 때 — 선·신호 자리를 다시 짓고 노드를 다시 읽는다(React가 노드를 그린 뒤에 부른다) */
  setWorld(world: BrainWorld) {
    this.#world = world
    this.#buildWorld()
    this.#applyVis()
    this.collectNodes()
    this.#render(performance.now() / 1000)
  }

  /** 멈춤의 방위각(도) — 없는 허브면 null */
  #azOf(stop: BrainStop) {
    if (stop === 'you') return this.#world.you.az
    return this.#world.hubs.find((d) => d.id === stop)?.az ?? null
  }

  /** 초점 바꾸기 — 카메라 방위각·확대·세로를 지수 감쇠로 옮긴다(시간 상수 0.195초) */
  setFocus(focus: BrainFocus) {
    this.#focus = focus
    const az = focus === 'overview' ? null : this.#azOf(focus)
    if (az === null) this.#target.theta = this.#pose.theta
    else this.#target.theta = this.#pose.theta + wrapPi(rad(az) - this.#pose.theta)
    this.#retarget()
  }

  /** 지도 ↔ 음성 모드 화면 — 음성 모드는 확대·세로가 전체 보기와 같고(F330·F480) 방위각만 말하는 쪽으로 돈다 */
  setMode(mode: BrainMode) {
    this.#mode = mode
    this.#retarget()
  }

  #retarget() {
    const voice = this.#mode === 'voice'
    const overview = this.#focus === 'overview'
    this.#target.zoom = voice || overview ? ZOOM_OVERVIEW : ZOOM_FOCUS
    this.#target.look = voice ? LOOK_VOICE : overview ? LOOK_OVERVIEW : LOOK_FOCUS
    this.#kick()
  }

  /** 초점 부서의 머리 자리를 다른 것이 대신할 때(headSlot) — 그 줄·신호도 숨긴다 */
  setHeadHidden(on: boolean) {
    if (this.#headHidden === on) return
    this.#headHidden = on
    this.#kick()
  }

  /** 그리지 않을 줄 — 꺼진 YOU 주제, 음성 모드의 코어 줄, 대신 그려진 머리 자리 줄 */
  #skip(path: SignalPath) {
    if (path.topic && !this.#topicsOn) return true
    if (this.#mode === 'voice' && path.core) return true
    return !!path.head && path.owner === this.#focus && (this.#headHidden || this.#mode === 'voice')
  }

  /** YOU 주제 점(과 그 줄·신호)을 보이거나 숨긴다 */
  showYouTopics(on: boolean) {
    if (this.#topicsOn === on) return
    this.#topicsOn = on
    this.#kick()
  }

  /** 정면에 가장 가까운 멈춤 — 전체 보기에서 ← → 를 누르면 여기서 시작한다 */
  nearestStop(): BrainStop {
    let best: BrainStop = this.#world.walk[0] ?? 'you'
    let bestD = Infinity
    for (const stop of this.#world.walk) {
      const deg = this.#azOf(stop)
      if (deg === null) continue
      const d = Math.abs(wrapPi(rad(deg) - this.#pose.theta))
      if (d < bestD) {
        bestD = d
        best = stop
      }
    }
    return best
  }

  /** 노드 DOM을 다시 읽는다(React가 노드를 새로 그렸을 때) */
  collectNodes() {
    const list: NodeRef[] = []
    const { you, hubs } = this.#world
    for (const el of this.#dom.nodes.querySelectorAll<HTMLElement>('[data-d14-node]')) {
      const key = el.dataset.d14Node ?? ''
      const [kind, id, index] = key.split(':')
      const label = kind === 'seat' ? null : el.querySelector<HTMLElement>('.d14-hub__label, .d14-you__label')
      if (kind === 'core') list.push({ el, label: null, pos: { x: 0, y: 0, z: 0 }, owner: 'core', z: 0 })
      else if (kind === 'you') list.push({ el, label, pos: placeAt(you.az, you.rho, you.h), owner: 'you', z: 0 })
      else {
        const dept = hubs.find((d) => d.id === id)
        if (!dept) continue
        if (kind === 'hub') list.push({ el, label, pos: placeAt(dept.az, dept.rho, dept.h), owner: dept.id, z: 0 })
        else if (kind === 'seat') {
          const i = Number(index)
          const at = dept.points[i]?.at
          if (!at) continue
          const f = this.#frames.get(dept.id)!
          const [u, v] = solveLocal(f, at)
          list.push({ el, label: null, pos: onFrame(f, u, v), owner: dept.id, head: i === 0, z: 0 })
        }
      }
    }
    this.#nodes = list
    this.#zOrder = []
    this.#kick()
  }

  // ── 세계 ─────────────────────────────────────────────────────────────────
  #buildWorld() {
    const world = this.#world
    this.#frames.clear()
    this.#vis = new Map()
    const paths: SignalPath[] = []
    const origin = { x: 0, y: 0, z: 0 }
    const add = (a: Vec3, b: Vec3, kind: PathKind, owner: Owner, weight: number) =>
      paths.push({
        a,
        b,
        len: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
        kind,
        owner,
        weight,
        core: a === origin || b === origin,
      })
    for (const dept of world.hubs) {
      const f = localFrame(dept.az, dept.rho, dept.h)
      this.#frames.set(dept.id, f)
      this.#vis.set(dept.id, 1)
      const hub = f.origin
      add(origin, hub, 'streak', dept.id, 3)
      // 0번이 머리 자리
      dept.points.forEach(({ at, line }, i) => {
        if (!line) return
        const [u, v] = solveLocal(f, at)
        add(hub, onFrame(f, u, v), 'dot', dept.id, 1)
        if (i === 0) paths[paths.length - 1].head = true
      })
    }
    const you = localFrame(world.you.az, world.you.rho, world.you.h)
    this.#frames.set('you', you)
    this.#vis.set('you', 1)
    this.#vis.set('core', 1)
    add(you.origin, origin, 'white', 'you', 2)
    this.#topics = world.topics.map((t) => {
      const [u, v] = solveLocal(you, t.at)
      return { pos: onFrame(you, u, v), waiting: !!t.waiting }
    })
    for (const t of this.#topics) {
      add(you.origin, t.pos, 'white', 'you', 0.3)
      paths[paths.length - 1].topic = true
    }
    // 코어 곁 노란 점 — 코어 둘레 작은 구에 놓여 같이 돈다
    this.#satellites = world.satellites.map((at) => ({ x: at[0], y: -at[1], z: 18 - Math.abs(at[0]) * 0.4 }))
    for (const sat of this.#satellites) add(origin, sat, 'gold', 'core', 0.5)
    this.#paths = paths
    this.#weightSum = paths.reduce((n, p) => n + p.weight, 0)
  }

  // ── 시계 ─────────────────────────────────────────────────────────────────
  readonly #onVisibility = () => {
    if (!document.hidden) this.#kick()
  }

  #kick() {
    if (this.#raf) return
    this.#last = 0
    this.#raf = requestAnimationFrame(this.#tick)
  }

  /** 처음 열 때 신호가 이미 날아가는 중이게 — 1.6초 미리 돌린다 */
  #warmUp() {
    this.#spawn(performance.now() / 1000)
  }

  readonly #tick = (time: number) => {
    this.#raf = 0
    const now = time / 1000
    const dt = this.#last ? Math.min(0.1, now - this.#last) : 1 / 60
    this.#last = now
    const moving = this.#step(now, dt)
    this.#render(now)
    if (!this.#visible || document.hidden) return
    if (moving || !this.#reduced) this.#raf = requestAnimationFrame(this.#tick)
  }

  /** 카메라·밝기를 한 걸음 — 아직 움직이는 중이면 true */
  #step(now: number, dt: number) {
    const tau = this.#reduced ? 0 : CAMERA_TAU
    if (this.#focus === 'overview' && this.#mode === 'map' && !this.#reduced) this.#target.theta -= IDLE_SPIN * dt
    const p = this.#pose
    const t = this.#target
    p.theta = approach(p.theta, t.theta, dt, tau)
    p.zoom = approach(p.zoom, t.zoom, dt, tau)
    p.look = approach(p.look, t.look, dt, tau)
    const overview = this.#focus === 'overview' && this.#mode === 'map'
    this.#dustLevel = approach(this.#dustLevel, overview ? 1 : DUST_FOCUS, dt, this.#reduced ? 0 : 0.18)
    const moving = Math.abs(p.theta - t.theta) > 1e-4 || Math.abs(p.zoom - t.zoom) > 1e-4
    this.#applyVis()
    if (!this.#reduced) this.#spawn(now)
    return moving
  }

  /** 초점 밖 무리는 그 프레임에 흐려진다(t=11.567) — 음성 모드에서는 거의 사라진다(F330 YOU 화면) */
  #applyVis() {
    const voice = this.#mode === 'voice'
    const overview = this.#focus === 'overview' && !voice
    for (const owner of this.#vis.keys()) {
      const goal = overview || owner === this.#focus ? 1 : voice ? 0.08 : owner === 'core' ? 0.45 : 0.28
      this.#vis.set(owner, goal)
    }
  }

  #spawn(now: number) {
    const rate = SIGNALS_PER_MIN / 60
    // 처음이거나 오래 멈췄다 돌아오면(화면 밖·다른 탭) 몰아서 만들지 않고 1.6초 전부터 다시
    if (this.#nextSpawn === 0 || now - this.#nextSpawn > 2) this.#nextSpawn = now - 1.6
    while (this.#nextSpawn <= now) {
      let pick = Math.random() * this.#weightSum
      let path = this.#paths[0]
      for (const p of this.#paths) {
        pick -= p.weight
        if (pick <= 0) {
          path = p
          break
        }
      }
      const dur = path.len / SIGNAL_STYLE[path.kind].speed
      this.#signals.push({ path, start: this.#nextSpawn, dur, dir: Math.random() < 0.5 ? 1 : -1 })
      this.#spawned.push(this.#nextSpawn)
      this.#nextSpawn += -Math.log(1 - Math.random()) / rate
    }
    this.#signals = this.#signals.filter((s) => now - s.start < s.dur)
    const cut = now - 6
    while (this.#spawned.length && this.#spawned[0] < cut) this.#spawned.shift()
  }

  #measure() {
    const box = this.#dom.root.getBoundingClientRect()
    this.#w = box.width
    this.#h = box.height
    this.#dpr = Math.min(2, window.devicePixelRatio || 1)
    const c = this.#dom.canvas
    c.width = Math.max(1, Math.round(this.#w * this.#dpr))
    c.height = Math.max(1, Math.round(this.#h * this.#dpr))
    const em = parseFloat(getComputedStyle(this.#dom.root).fontSize) || 10
    this.#vp = { cx: this.#w / 2, cy: this.#h / 2, k: em / 10 }
    this.#render(performance.now() / 1000)
  }

  // ── 그리기 ────────────────────────────────────────────────────────────────
  #render(now: number) {
    const { ring, haze, headAnchor, youAnchor } = this.#dom
    const pose = this.#pose
    const vp = this.#vp
    const p = this.#p

    // 둥근 테두리는 화면 가운데, 노을빛은 코어를 따라간다
    ring.style.transform = `translate(-50%, -50%) scale(${pose.zoom.toFixed(4)})`
    project({ x: 0, y: 0, z: 0 }, pose, vp, p)
    haze.style.transform = `translate(${(p.x - vp.cx).toFixed(1)}px, ${(p.y - vp.cy).toFixed(1)}px) translate(-50%, -50%) scale(${pose.zoom.toFixed(4)})`

    // 노드 — 자리·배율·깊이 흐림, 깊이 순서(초점 부서는 늘 위)
    for (const n of this.#nodes) {
      project(n.pos, pose, vp, p)
      n.z = p.depth + (n.owner === this.#focus ? 2000 : 0)
      n.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) scale(${p.s.toFixed(4)})`
      // YOU는 구 밖에 떠 있어 깊이로 흐려지지 않는다(t=47.8 뒤쪽인데도 흰 원·이름이 보인다)
      const you = n.owner === 'you'
      n.el.style.opacity = (you ? 1 : depthFade(p.depth)).toFixed(3)
      if (n.label) {
        // 이름표는 원근으로 줄지 않는다(t=0 뒤쪽 YOU·STRATEGY 이름도 ADMIN과 같은 크기) — 확대만 따라간다
        n.label.style.opacity = (you ? 0.55 + 0.45 * labelFade(p.depth) : labelFade(p.depth)).toFixed(3)
        n.label.style.scale = (pose.zoom / p.s).toFixed(4)
      }
      if (n.head && n.owner === this.#focus && headAnchor) {
        headAnchor.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
        this.#writeScale(headAnchor, p.s)
      }
      // YOU 칸은 배율까지 transform으로 — 음성 화면 정면(0.855)에서 1배. 글자 크기를 바꾸면 매 프레임 다시 배치된다
      if (n.owner === 'you' && youAnchor) {
        youAnchor.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) scale(${(p.s / YOU_SLOT_UNIT).toFixed(4)})`
        this.#writeScale(youAnchor, p.s)
      }
    }
    const order = [...this.#nodes].sort((a, b) => a.z - b.z)
    if (order.some((n, i) => this.#zOrder[i] !== n)) {
      this.#zOrder = order
      order.forEach((n, i) => (n.el.style.zIndex = String(i + 1)))
    }

    this.#draw(now)
    this.#updateStats(now)
  }

  /** --d14-s는 0.005 넘게 바뀔 때만 쓴다 — 상속되는 변수라 쓸 때마다 칸 안 전체 스타일을 다시 계산한다 */
  #writeScale(el: HTMLElement, s: number) {
    const last = Number(el.dataset.d14S ?? NaN)
    if (Math.abs(last - s) < 0.005) return
    el.dataset.d14S = s.toFixed(3)
    el.style.setProperty('--d14-s', s.toFixed(3))
  }

  #draw(now: number) {
    const ctx = this.#ctx
    if (!ctx) return
    const pose = this.#pose
    const vp = this.#vp
    const k = vp.k
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0)
    ctx.clearRect(0, 0, this.#w, this.#h)

    // 먼지 — 색·밝기 단계로 묶어 fillStyle을 몇 번만 바꾼다
    const d = this.#dust
    const level = this.#dustLevel
    if (level > 0.01) {
      const c = Math.cos(pose.theta)
      const s = Math.sin(pose.theta)
      const lookY = pose.look * SPHERE_R * pose.zoom
      const xs = this.#dx
      const ys = this.#dy
      const ws = this.#dw
      const group = this.#group
      const sorted = this.#sorted
      const start = this.#groupN
      start.fill(0)
      for (let i = 0; i < DUST_COUNT; i++) {
        const x = d.x[i] * c - d.z[i] * s
        const z = d.x[i] * s + d.z[i] * c
        const sc = (CAMERA_D / (CAMERA_D - z)) * pose.zoom
        xs[i] = vp.cx + x * sc * k
        ys[i] = vp.cy + (lookY - d.y[i] * sc) * k
        ws[i] = Math.max(0.8, d.size[i] * sc * k * 0.8)
        const a = d.alpha[i] * (0.5 + 0.5 * depthFade(z)) * level
        if (a < 0.04) {
          group[i] = 255
          continue
        }
        const g = d.color[i] * ALPHA_STEPS + Math.min(ALPHA_STEPS - 1, Math.floor(a * ALPHA_STEPS))
        group[i] = g
        start[g + 1]++
      }
      // 묶음별 시작 자리(누적) → 묶음 순서로 늘어놓기
      for (let g = 1; g < start.length; g++) start[g] += start[g - 1]
      const fill = start.slice(0, -1)
      for (let i = 0; i < DUST_COUNT; i++) if (group[i] !== 255) sorted[fill[group[i]]++] = i
      for (let g = 0; g < start.length - 1; g++) {
        const from = start[g]
        const to = start[g + 1]
        if (from === to) continue
        const color = DUST_COLORS[Math.floor(g / ALPHA_STEPS)][1]
        const alpha = ((g % ALPHA_STEPS) + 0.5) / ALPHA_STEPS
        ctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`
        for (let j = from; j < to; j++) {
          const i = sorted[j]
          ctx.fillRect(xs[i] - ws[i] / 2, ys[i] - ws[i] / 2, ws[i], ws[i])
        }
      }
    }

    // 선 — 코어 ↔ 부서, 부서 ↔ 자리, YOU ↔ 코어(점선), 코어 ↔ 노란 점
    const a = this.#p
    const b = this.#q
    ctx.lineCap = 'round'
    for (const path of this.#paths) {
      if (this.#skip(path)) continue
      project(path.a, pose, vp, a)
      project(path.b, pose, vp, b)
      const vis = this.#vis.get(path.owner) ?? 1
      const focused = this.#focus !== 'overview' && path.owner === this.#focus
      const fade = depthFade((a.depth + b.depth) / 2)
      const sc = (a.s + b.s) / 2
      let rgb = '255,112,52'
      let alpha = 0.2
      let width = 1.1
      if (path.kind === 'dot') alpha = focused ? 0.5 : 0.13
      else if (path.kind === 'streak') alpha = focused ? 0.42 : 0.2
      else if (path.kind === 'white') {
        rgb = '236,228,220'
        alpha = path.weight > 1 ? 0.16 : 0.1
        width = 1
      } else {
        rgb = '242,190,80'
        alpha = 0.22
        width = 0.9
      }
      ctx.strokeStyle = `rgba(${rgb},${(alpha * vis * fade).toFixed(3)})`
      ctx.lineWidth = Math.max(0.6, width * sc * k)
      ctx.setLineDash(path.kind === 'white' && path.weight > 1 ? [4 * sc * k, 7 * sc * k] : [])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // 코어 곁 노란 점·YOU 주제 점(작은 점은 캔버스로)
    for (const sat of this.#mode === 'voice' ? [] : this.#satellites) {
      project(sat, pose, vp, a)
      const vis = (this.#vis.get('core') ?? 1) * depthFade(a.depth)
      ctx.fillStyle = `rgba(242,180,60,${(0.9 * vis).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(a.x, a.y, 3.6 * a.s * k, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(242,180,60,${(0.45 * vis).toFixed(3)})`
      ctx.lineWidth = Math.max(0.6, 1 * a.s * k)
      ctx.beginPath()
      ctx.arc(a.x, a.y, 6.4 * a.s * k, 0, Math.PI * 2)
      ctx.stroke()
    }
    const youVis = this.#vis.get('you') ?? 1
    for (const t of this.#topicsOn ? this.#topics : []) {
      project(t.pos, pose, vp, a)
      const vis = youVis
      if (t.waiting) {
        ctx.strokeStyle = `rgba(214,44,52,${(0.55 * vis).toFixed(3)})`
        ctx.lineWidth = Math.max(0.6, 1.3 * a.s * k)
        ctx.beginPath()
        ctx.arc(a.x, a.y, 9 * a.s * k, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = t.waiting
        ? `rgba(255,92,44,${(0.95 * vis).toFixed(3)})`
        : `rgba(236,230,222,${(0.85 * vis).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(a.x, a.y, (t.waiting ? 3.6 : 3) * a.s * k, 0, Math.PI * 2)
      ctx.fill()
    }

    // 신호
    for (const sig of this.#signals) {
      if (this.#skip(sig.path)) continue
      const st = SIGNAL_STYLE[sig.path.kind]
      const prog = Math.min(1, Math.max(0, (now - sig.start) / sig.dur))
      const from = sig.dir === 1 ? sig.path.a : sig.path.b
      const to = sig.dir === 1 ? sig.path.b : sig.path.a
      project(from, pose, vp, a)
      project(to, pose, vp, b)
      const vis = (this.#vis.get(sig.path.owner) ?? 1) * depthFade((a.depth + b.depth) / 2)
      // 끝에 닿기 전후로 살짝 사라진다
      const ends = Math.min(1, prog / 0.08, (1 - prog) / 0.12)
      const sc = (a.s + b.s) / 2
      drawSignal(
        ctx,
        a.x,
        a.y,
        b.x,
        b.y,
        prog,
        st.tail * sc * k,
        Math.max(0.8, st.width * sc * k),
        st.rgb,
        st.alpha * vis * ends,
      )
    }
  }

  #updateStats(now: number) {
    if (now * 1000 - this.#statsAt < STATS_MS) return
    this.#statsAt = now * 1000
    // 최근 6초 동안 생긴 수 × 10 — 영상처럼 ±7% 오르내린다
    const span = Math.min(6, Math.max(1, now - this.#born))
    this.#stats = {
      signals: this.#reduced ? SIGNALS_PER_MIN : Math.round((this.#spawned.length / span) * 60),
      inFlight: this.#reduced ? 56 : this.#signals.length,
    }
    const root = this.#dom.root
    const sig = root.querySelector<HTMLElement>('[data-d14-signals]')
    const fly = root.querySelector<HTMLElement>('[data-d14-flight]')
    if (sig) sig.textContent = this.#stats.signals.toLocaleString('en-US')
    if (fly) fly.textContent = this.#stats.inFlight.toLocaleString('en-US')
  }
}
