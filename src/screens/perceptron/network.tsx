import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { COLUMNS, WARN, type NodeDef } from './data'
import { useEngine, type Engine, type Snapshot } from './engine'
import {
  HEADER_Y,
  MAX_ROWS,
  MIN_ROWS,
  ROW_STRIDE,
  WORLD_W,
  Y0,
  colWidth,
  colX,
  pointAt,
  rng,
  rowY,
  spineX,
  type Cubic,
  type Layout,
  type Path,
  type Pt,
  type Rect,
  type Strand,
} from './geometry'
import { useModel, type Model } from './model'
import { FADE_END, FADE_START, smoothstep, type CaseTimeline } from './timeline'

// ── 색 ──────────────────────────────────────────────────────────────────

const rgba = (hex: string, a: number) => {
  const v = parseInt(hex.slice(1), 16)
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`
}
const mixWhite = (hex: string, k: number) => {
  const v = parseInt(hex.slice(1), 16)
  const ch = (s: number) => Math.round(((v >> s) & 255) * (1 - k) + 255 * k)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** 빛 점·입자용 둥근 빛 — 색·크기마다 한 번만 만든다. */
const spriteCache = new Map<string, HTMLCanvasElement>()
const glow = (color: string, size: number, core = 0.12) => {
  const key = `${color}:${size}:${core}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const h = size / 2
  const grd = g.createRadialGradient(h, h, 0, h, h, h)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(core, 'rgba(255,255,255,0.95)')
  grd.addColorStop(Math.min(0.9, core * 2.4), rgba(color, 0.85))
  grd.addColorStop(0.45, rgba(color, 0.22))
  grd.addColorStop(1, rgba(color, 0))
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  spriteCache.set(key, c)
  return c
}

const strokeCubic = (ctx: CanvasRenderingContext2D, c: Cubic) => {
  ctx.beginPath()
  ctx.moveTo(c.p0.x, c.p0.y)
  ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p3.x, c.p3.y)
  ctx.stroke()
}

const strokePath = (ctx: CanvasRenderingContext2D, path: Path) => {
  const { pts } = path
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

// ── 정적 층 ─────────────────────────────────────────────────────────────

/** 바닥 — 작은 색 눈금과 먼지 같은 점(격자 선은 .pn-grid). */
const drawBackground = (ctx: CanvasRenderingContext2D, layout: Layout) => {
  const r = rng(77)
  ctx.clearRect(0, 0, WORLD_W, layout.worldH)
  const dashColors = [
    '#ff5f8f',
    '#f2cf5b',
    '#55d6e2',
    '#9d8cff',
    '#c9ef6a',
    '#ffffff',
  ]
  for (let i = 0; i < 190; i++) {
    const x = r() * WORLD_W
    const y = rowY(0) - 40 + r() * (layout.rows * ROW_STRIDE + 40)
    ctx.fillStyle = rgba(
      dashColors[Math.floor(r() * dashColors.length)],
      0.35 + r() * 0.5,
    )
    ctx.fillRect(x, y, 5 + r() * 15, 1.6)
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.3})`
    const s = r() < 0.85 ? 1 : 1.8
    ctx.fillRect(r() * WORLD_W, r() * layout.worldH, s, s)
  }
}

/** 섬유 — 번짐 한 번, 가는 선 한 번. 기둥 사이 세로줄에 옅은 안개. */
const drawFibers = (ctx: CanvasRenderingContext2D, layout: Layout) => {
  const { fibers } = layout
  ctx.clearRect(0, 0, WORLD_W, layout.worldH)
  ctx.globalCompositeOperation = 'lighter'
  for (let gap = 0; gap < 4; gap++) {
    const x = spineX(gap)
    const grd = ctx.createLinearGradient(x - 26, 0, x + 26, 0)
    grd.addColorStop(0, 'rgba(160,190,255,0)')
    grd.addColorStop(0.5, 'rgba(170,200,255,0.06)')
    grd.addColorStop(1, 'rgba(160,190,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(x - 26, rowY(0) - 30, 52, layout.rows * ROW_STRIDE + 20)
  }
  const pass = (list: Strand[], widthK: number, alphaK: number) => {
    for (const s of list) {
      ctx.strokeStyle = rgba(s.color, Math.min(1, s.alpha * alphaK))
      ctx.lineWidth = s.width * widthK
      strokePath(ctx, s.path)
    }
  }
  pass(fibers.strands, 4, 0.22)
  pass(fibers.wisps, 3.5, 0.2)
  pass(fibers.strands, 1, 1)
  pass(fibers.wisps, 1, 1)
  const knot = glow('#9fd8ff', 24)
  for (const k of fibers.knots) {
    ctx.globalAlpha = k.alpha * 0.8
    ctx.drawImage(knot, k.x - 12 * k.r, k.y - 12 * k.r, 24 * k.r, 24 * k.r)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

// ── 빛 점 ───────────────────────────────────────────────────────────────

const ENTER = 0.08

const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2

/** 마지막 카드에서 빛 점이 머무는 곳(카드 안쪽 오른편). */
const restOf = (layout: Layout, id: string): Pt => {
  const r = layout.nodeRect(id)
  return { x: r.x + r.w * 0.72, y: r.y + r.h * 0.42 }
}

/** 빛 점의 자리 — 첫 카드 왼쪽 끝에서 나타나 카드를 가로지르고, 연결선을
 * 따라 다음 카드로 건너간다. 마지막 카드에선 안쪽에 머문다. */
const pulsePos = (layout: Layout, tl: CaseTimeline, tau: number): Pt => {
  const ids = tl.steps.map((s) => s.id)
  const last = ids.length - 1
  for (const h of tl.hops) {
    if (tau >= h.start && tau < h.end) {
      const u = easeInOut((tau - h.start) / (h.end - h.start))
      return pointAt(layout.pathOf(ids[h.from], ids[h.to]), u)
    }
  }
  let i = 0
  for (let k = 0; k < tl.at.length; k++) if (tau >= tl.at[k]) i = k
  const from = layout.portIn(ids[i])
  const to = i < last ? layout.portOut(ids[i]) : restOf(layout, ids[i])
  const t0 = i === 0 ? ENTER : tl.at[i]
  const t1 = i < last ? tl.hops[i].start : tl.at[i] + 0.3
  const u = easeInOut(Math.min(1, Math.max(0, (tau - t0) / (t1 - t0))))
  return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }
}

const pulseAlpha = (tau: number) =>
  smoothstep(ENTER, ENTER + 0.15, tau) *
  (1 - smoothstep(FADE_START, FADE_END, tau))

/** 기둥 사이 gap의 빛기둥 세기(0~1) — 빛 점이 왼쪽 카드에 닿으면 켜지고,
 * 다음 카드에 닿은 뒤 천천히 꺼진다(마지막 사이는 케이스가 끝날 때까지). */
const beamOf = (tl: CaseTimeline, gap: number, tau: number) => {
  let v = 0
  tl.hops.forEach((h, i) => {
    if (tl.steps[h.from].col !== gap) return
    // 영상: 카드가 켜지는 순간 그 오른쪽 기둥 사이도 같이 켜진다(0.1초 안에).
    const on = tl.at[h.from] - 0.04
    const off =
      i === tl.hops.length - 1
        ? 1
        : 1 - smoothstep(h.end + 0.35, h.end + 1.1, tau)
    v = Math.max(v, smoothstep(on, on + 0.12, tau) * off)
  })
  return v * (1 - smoothstep(FADE_START, FADE_END, tau))
}

interface Particle {
  path: Path
  gap: number
  t: number
  speed: number
  size: number
}

const makeParticles = (layout: Layout) => {
  const r = rng(4242)
  const pool = [
    ...layout.fibers.strands,
    ...layout.fibers.wisps.filter((w) => w.gap >= 0),
  ]
  return Array.from({ length: 220 }, (): Particle => {
    const s = pool[Math.floor(r() * pool.length)]
    return {
      path: s.path,
      gap: s.gap,
      t: r(),
      speed: (0.08 + r() * 0.3) * (r() < 0.5 ? -1 : 1),
      size: 6 + r() * 9,
    }
  })
}

const FLOATERS = (() => {
  const r = rng(99)
  const h = Y0 + MIN_ROWS * ROW_STRIDE + 80
  return Array.from({ length: 90 }, () => ({
    x: r() * WORLD_W,
    y: r() * h,
    phase: r() * Math.PI * 2,
    amp: 4 + r() * 10,
    size: 5 + r() * 6,
  }))
})()

// ── 카메라 ──────────────────────────────────────────────────────────────

interface Pose {
  /** 좌우로 돈 각도(도) — +면 왼쪽이, -면 오른쪽이 가깝다. */
  yaw: number
  /** 위아래로 숙인 각도(도) — +면 아래쪽이 가깝다. */
  pitch: number
  /** 기본 배율(카드 8줄이 화면 높이에 맞는 배율) 대비. */
  zoom: number
}

/** 케이스마다 카메라 자세 [시작, 끝] — 영상의 카드 폭·간격 변화에서 잰 값.
 * 케이스 사이(꺼지는 동안)엔 평평하게 물러난다(IDLE). */
const POSES: [Pose, Pose][] = [
  [
    { yaw: 0, pitch: 3, zoom: 1 },
    { yaw: 3, pitch: 4, zoom: 0.95 },
  ],
  [
    { yaw: -2, pitch: 3, zoom: 1.02 },
    { yaw: -12, pitch: 4, zoom: 1.18 },
  ],
  [
    { yaw: -15, pitch: 4, zoom: 1.34 },
    { yaw: -13, pitch: 4, zoom: 1.2 },
  ],
  [
    { yaw: 9, pitch: 3, zoom: 1.18 },
    { yaw: 20, pitch: 5, zoom: 0.92 },
  ],
  [
    { yaw: 2, pitch: 3, zoom: 1.05 },
    { yaw: -5, pitch: 4, zoom: 1.1 },
  ],
  [
    { yaw: 0, pitch: 3, zoom: 1.27 },
    { yaw: 7, pitch: 8, zoom: 0.95 },
  ],
]
const IDLE: Pose = { yaw: 0, pitch: 3, zoom: 1 }
/** 고르는 중 — 그 노드를 평평하게, 조금 당겨서. */
const FOCUS: Pose = { yaw: 0, pitch: 2, zoom: 1.2 }

/** 카메라 모드 — auto는 빛 점을 따라가며 보여 주고, free는 손으로 옮기고
 * 확대·축소한다. */
export type CameraMode = 'auto' | 'free'

/** 프리 모드의 카메라(평면 좌표와 기본 배율 대비 배율). */
interface FreeView {
  x: number
  y: number
  zoom: number
}

/** 망 전체가 들어오게(기둥 제목부터 "노드 추가" 줄까지). */
const fitView = (
  layout: Layout,
  vw: number,
  vh: number,
  base: number,
): FreeView => {
  const top = HEADER_Y - 30
  const s = Math.min(vw / (WORLD_W + 40), vh / (layout.worldH - 20 - top))
  return { x: WORLD_W / 2, y: top + (vh * 0.45) / s, zoom: s / base }
}

/** 프리 모드 카메라는 화면 가운데가 망 안에 있는 동안만 움직인다 — 배율과
 * 상관없이 두 축이 같이 움직인다(가운데에 묶지 않는다). */
const keepInside = (free: FreeView, worldH: number) => {
  free.x = Math.min(WORLD_W, Math.max(0, free.x))
  free.y = Math.min(worldH, Math.max(0, free.y))
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 1.25

/** 세로 구도 — 영상은 케이스가 시작될 때 기둥 제목과 0~5번째 줄이 보이고,
 * 빛 점이 아래로 내려가면 절반쯤만 따라 내려간다. */
const MID_Y = rowY(0) + ROW_STRIDE * 1.9

/** 카메라가 볼 곳과 자세 — 빛 점을 따라가되 처음엔 앞(오른쪽)을 넉넉히 두고
 * (빛 점이 화면 왼쪽 12%쯤), 끝에선 도착한 노드가 오른쪽 3/4쯤에 오게 한다.
 * 케이스가 끝나면 다음 케이스 입구로 물러난다. halfW는 보이는 폭의 절반(평면 px). */
const cameraTarget = (
  model: Model,
  slot: number,
  tau: number,
  halfW: number,
) => {
  const { layout } = model
  const aim = (p: Pt, progress: number) => ({
    x: p.x + halfW * (0.76 - 1.26 * progress),
    y: MID_Y + (p.y - MID_Y) * 0.45,
  })
  if (tau >= FADE_START + 0.15) {
    const next = model.cases[(slot + 1) % model.cases.length].timeline
    return { ...aim(layout.portIn(next.steps[0].id), 0), ...IDLE }
  }
  const tl = model.cases[slot].timeline
  const lastAt = tl.at[tl.at.length - 1]
  const progress = smoothstep(0.25, lastAt + 0.3, tau)
  const [a, b] = POSES[slot % POSES.length]
  const mix = (k: keyof Pose) => a[k] + (b[k] - a[k]) * progress
  return {
    ...aim(pulsePos(layout, tl, Math.max(tau, ENTER)), progress),
    yaw: mix('yaw'),
    pitch: mix('pitch'),
    zoom: tau >= FADE_START ? IDLE.zoom : mix('zoom'),
  }
}

/** 화면 밖 빈 곳을 덜 보이게 — 보이는 폭이 평면보다 넓으면 가운데에 둔다. */
const clampAxis = (
  v: number,
  before: number,
  after: number,
  size: number,
  pad: number,
) => {
  if (before + after >= size + pad * 2) return (size + before - after) / 2
  return Math.min(size + pad - after, Math.max(-pad + before, v))
}

// ── 카드 ────────────────────────────────────────────────────────────────

type CardState = 'off' | 'on' | 'warn' | 'built'

/** 지금 이 카드의 상태 — 지난 경로면 켜짐(게이트 미달 이후는 경고), 출력
 * 노드의 칸은 위에서부터 차례로 조립된다(미달이면 멈춘다). */
const cardState = (
  model: Model,
  id: string,
  s: Snapshot,
  section?: number,
): CardState => {
  if (s.fading) return 'off'
  const view = model.cases[s.slot]
  const tl = view.timeline
  const i = tl.steps.findIndex((st) => st.id === id)
  if (i >= 0 && i < s.stepOn)
    return view.hold && tl.steps[i].col >= 3 ? 'warn' : 'on'
  if (section === undefined) return 'off'
  if (section === 0 && s.stepOn >= tl.steps.length) {
    if (view.hold) return 'warn'
    return s.assembled >= model.graph.layers[4].length ? 'on' : 'built'
  }
  return !view.hold && s.assembled > section ? 'built' : 'off'
}

/** 카드 아래 짧은 색 막대의 자리 — 카드마다 조금씩 다르게(고정). */
const barLeft = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 24 + (h % 40)
}

const Card = ({
  engine,
  node,
  col,
  rect,
  section,
  selected,
  onSelect,
}: {
  engine: Engine
  node: NodeDef
  col: number
  rect: Rect
  /** 출력 노드의 칸이면 위에서부터 몇 번째인지. */
  section?: number
  selected: boolean
  onSelect: (id: string) => void
}) => {
  const state = useEngine(engine, (s) =>
    cardState(engine.model, node.id, s, section),
  )
  const result = useEngine(
    engine,
    (s) => engine.model.cases[s.slot].results[node.id] ?? '',
  )
  const shown = (state === 'on' || state === 'warn') && result !== ''
  return (
    <div
      className={`pn-card is-${state}${shown ? ' has-result' : ''}${selected ? ' is-selected' : ''}`}
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          '--col': COLUMNS[col].color,
          '--bar': `${barLeft(node.id)}%`,
        } as CSSProperties
      }
      role="button"
      aria-label={`${node.title} 편집`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
    >
      <div className="pn-card__title">
        <i />
        {node.title}
      </div>
      <div className="pn-card__rows">
        {node.rows.map(([k, v, tone], i) => (
          <div key={i} className="pn-card__row">
            <span>{k}</span>
            <b className={tone === 'accent' ? 'is-accent' : undefined}>{v}</b>
          </div>
        ))}
      </div>
      <span className="pn-card__bar" />
      <div className="pn-card__result">{shown ? result : ''}</div>
    </div>
  )
}

/** 출력 노드(PROMPT) 전체 틀 — 프롬프트가 다 만들어지면 테두리가 빛난다. */
const OutputFrame = ({ engine, rect }: { engine: Engine; rect: Rect }) => {
  const state = useEngine(engine, (s) => {
    const view = engine.model.cases[s.slot]
    if (s.fading || s.stepOn < view.timeline.steps.length) return 'off'
    if (view.hold) return 'warn'
    return s.assembled >= engine.model.graph.layers[4].length ? 'on' : 'off'
  })
  return (
    <div
      className={`pn-out is-${state}`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    />
  )
}

// ── 망 ──────────────────────────────────────────────────────────────────

/** 바닥 격자가 평면 밖으로 이어지는 폭 — 카메라가 크게 돌면 가장자리가 보인다. */
const GRID_PAD = 700

/**
 * 가운데 신경망 — 기울어진 평면(카드·섬유·빛)을 카메라가 빛 점을 따라 움직인다.
 * 카드는 글자가 선명하게 DOM으로, 섬유는 배치가 바뀔 때만 그리는 캔버스, 빛 점·
 * 빛기둥·부채꼴·링·입자는 프레임마다 그리는 캔버스에. 카드를 누르면 그 노드를
 * 고르고(카메라가 그쪽으로 간다), 빈 곳을 누르면 고르기를 푼다. 카메라는 두 모드 —
 * AUTO는 빛 점을 따라가고, FREE는 끌어서 옮기고 핀치(⌘·Ctrl+휠)나 +/−로 확대한다.
 */
export function Network({
  engine,
  mode,
  onMode,
  selectedId,
  onSelect,
  onAdd,
  inspectorRef,
}: {
  engine: Engine
  mode: CameraMode
  onMode: (mode: CameraMode) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (col: number) => void
  /** 편집 패널 — 열려 있으면 그만큼 비켜서 노드를 가운데 둔다. */
  inspectorRef: RefObject<HTMLElement | null>
}) {
  const model = useModel()
  const { layout } = model
  const viewRef = useRef<HTMLElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const fiberRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef(model)
  const focusRef = useRef(selectedId)
  const particlesRef = useRef<Particle[]>([])
  // vx·vy는 화면에 실제로 놓인 자리(가장자리에서 막힌 뒤) — 프리 모드가 여기서 시작.
  const camRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    s: 1,
    yaw: 0,
    pitch: 3,
    ready: false,
  })
  const sizeRef = useRef({ vw: 0, vh: 0, base: 1 })
  const freeRef = useRef<FreeView | null>(null)
  // 휠·핀치를 받은 다음 프레임은 부드럽게 따라가지 않고 바로 그 자리로.
  const snapRef = useRef(false)
  const modeRef = useRef(mode)
  const [zoomPct, setZoomPct] = useState(100)
  const dragRef = useRef<{
    id: number
    x: number
    y: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    modelRef.current = model
  }, [model])
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    focusRef.current = selectedId
  }, [selectedId])

  // 정적 층 — 배치가 바뀔 때만(노드를 더하거나 지우면) 다시 그린다.
  useEffect(() => {
    const setup = (c: HTMLCanvasElement, scale: number) => {
      c.width = Math.round(WORLD_W * scale)
      c.height = Math.round(layout.worldH * scale)
      const ctx = c.getContext('2d')!
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      return ctx
    }
    drawBackground(setup(bgRef.current!, 1), layout)
    drawFibers(
      setup(fiberRef.current!, Math.min(1.5, window.devicePixelRatio || 1)),
      layout,
    )
    setup(fxRef.current!, 1)
    particlesRef.current = makeParticles(layout)
  }, [layout])

  // 프레임마다 — 카메라와 빛.
  useEffect(() => {
    const viewEl = viewRef.current!
    const plane = planeRef.current!
    const ctx = fxRef.current!.getContext('2d')!

    const size = sizeRef.current
    const measure = () => {
      size.vw = viewEl.clientWidth
      size.vh = viewEl.clientHeight
      // 기본 배율 — 영상(720 폭)에서 카드가 140px쯤 되는 배율. 넓은 화면에선
      // 높이가 배율을 정한다(여섯 줄 남짓이 보이고, 기둥은 다 보인다).
      size.base = Math.min(
        1.2,
        Math.max(0.36, Math.min(size.vw / 1290, size.vh / 780)),
      )
      viewEl.style.perspective = `${Math.round(Math.max(size.vw, size.vh * 1.2))}px`
      viewEl.style.perspectiveOrigin = `${size.vw * 0.5}px ${size.vh * 0.45}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(viewEl)

    const cam = camRef.current
    const dust = glow('#cfe6ff', 16, 0.14)
    let shownPct = 100

    const off = engine.onFrame(({ slot, tau, dt, clock }) => {
      const model = modelRef.current
      const { layout } = model
      const view = model.cases[slot]
      const tl = view.timeline
      const accent = view.def.color
      const worldH = layout.worldH
      const { vw, vh, base } = size

      // 카메라 — 목표를 부드럽게 따라간다(자리는 빠르게, 자세는 조금 느리게).
      // 노드를 고르는 중이면 그 노드를 편집 패널 왼쪽 빈 곳 가운데로, 프리
      // 모드면 손으로 옮긴 자리를, 오토 모드면 빛 점을.
      const focus = focusRef.current
      const hasFocus = !!focus && model.nodes.has(focus)
      if (modeRef.current !== 'free') freeRef.current = null
      else if (!freeRef.current)
        // 프리 모드에 들어오면 지금 보이는 자리에서 시작한다(튀지 않게).
        freeRef.current = cam.ready
          ? { x: cam.vx, y: cam.vy, zoom: cam.s / base }
          : fitView(layout, vw, vh, base)
      const free = hasFocus ? null : freeRef.current
      const inspW = hasFocus ? (inspectorRef.current?.offsetWidth ?? 0) : 0
      const s0 = cam.ready ? cam.s : base
      let target: Pt & Pose
      if (hasFocus) {
        const r = layout.nodeRect(focus)
        target = {
          x: r.x + r.w / 2 + (inspW * 0.5) / s0,
          y: r.y + r.h / 2,
          ...FOCUS,
        }
      } else if (free) {
        target = { x: free.x, y: free.y, yaw: 0, pitch: 0, zoom: free.zoom }
      } else {
        target = cameraTarget(model, slot, tau, (vw * 0.5) / s0)
      }
      const zoom = base * target.zoom
      if (!cam.ready) {
        Object.assign(cam, { ...target, s: zoom, ready: true })
      } else {
        // 끌기·휠·핀치는 바로 그 자리로(따라가는 부드러움 없이). 프리 모드의
        // 버튼(+/−·전체)은 빠르게, 오토 카메라와 노드로 다가가는 움직임은 부드럽게.
        const snap = !!dragRef.current?.moved || snapRef.current
        snapRef.current = false
        const follow = free ? 3 : 1
        const k = snap ? 1 : 1 - Math.exp(-dt * 4 * follow)
        const kp = snap ? 1 : 1 - Math.exp(-dt * 2.6 * follow)
        cam.x += (target.x - cam.x) * k
        cam.y += (target.y - cam.y) * k
        cam.s += (zoom - cam.s) * kp
        cam.yaw += (target.yaw - cam.yaw) * kp
        cam.pitch += (target.pitch - cam.pitch) * kp
      }
      // 프리 모드는 손으로 옮긴 자리 그대로(망 안에 있게는 휠·끌기에서 막는다),
      // 나머지는 화면 밖 빈 곳이 덜 보이게 가장자리에서 막는다.
      const halfW = (vw * 0.5) / cam.s
      const x = free
        ? cam.x
        : clampAxis(cam.x, halfW, (vw * 0.5 - inspW) / cam.s, WORLD_W, 60)
      const y = free
        ? cam.y
        : clampAxis(cam.y, (vh * 0.45) / cam.s, (vh * 0.55) / cam.s, worldH, 20)
      cam.vx = x
      cam.vy = y
      // 프리 모드에서 편집하는 동안 옮겨 간 자리를 기억 — 패널을 닫아도 거기 있다.
      if (hasFocus && freeRef.current)
        Object.assign(freeRef.current, { x, y, zoom: cam.s / base })
      if (freeRef.current) {
        const pct = Math.round(freeRef.current.zoom * 100)
        if (pct !== shownPct) {
          shownPct = pct
          setZoomPct(pct)
        }
      }
      // 손으로 볼 때는 흔들지 않는다.
      const sway = free || hasFocus ? 0 : 1
      const yaw = cam.yaw + Math.sin(clock * 0.35) * 1.2 * sway
      const pitch = cam.pitch + Math.sin(clock * 0.27 + 1) * 0.8 * sway
      plane.style.transform =
        `translate3d(${vw * 0.5}px, ${vh * 0.45}px, 0) rotateX(${pitch}deg) rotateY(${yaw}deg) ` +
        `scale(${cam.s}) translate3d(${-x}px, ${-y}px, 0)`

      // 빛.
      ctx.clearRect(0, 0, WORLD_W, worldH)
      ctx.globalCompositeOperation = 'lighter'
      const fade = 1 - smoothstep(FADE_START, FADE_END, tau)

      // 떠다니는 먼지.
      for (const f of FLOATERS) {
        const dx = Math.sin(clock * 0.4 + f.phase) * f.amp
        const dy = Math.cos(clock * 0.3 + f.phase) * f.amp
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(clock * 1.3 + f.phase)
        ctx.drawImage(
          dust,
          f.x + dx - f.size / 2,
          f.y + dy - f.size / 2,
          f.size,
          f.size,
        )
      }

      // 빛기둥 — 지나는 기둥 사이를 케이스 색으로, 그 사이 섬유도 같이.
      for (let gap = 0; gap < 4; gap++) {
        const v = beamOf(tl, gap, tau)
        if (v < 0.01) continue
        const bx = spineX(gap)
        const top = rowY(0) - 60
        const h = layout.rows * ROW_STRIDE + 60
        const grd = ctx.createLinearGradient(bx - 70, 0, bx + 70, 0)
        grd.addColorStop(0, rgba(accent, 0))
        grd.addColorStop(0.5, rgba(accent, 0.34 * v))
        grd.addColorStop(1, rgba(accent, 0))
        ctx.globalAlpha = 1
        ctx.fillStyle = grd
        ctx.fillRect(bx - 70, top, 140, h)
        ctx.lineWidth = 1.1
        ctx.strokeStyle = rgba(accent, 0.5 * v)
        for (const s of layout.strandsByGap[gap]) strokePath(ctx, s.path)
        ctx.fillStyle = rgba(accent, 0.7 * v)
        ctx.fillRect(bx - 1.5, top, 3, h)
      }

      // 부채꼴 — 카드가 켜진 동안 다음 기둥 전체로 옅은 선.
      for (const h of tl.hops) {
        const step = tl.steps[h.from]
        const v =
          smoothstep(tl.at[h.from], tl.at[h.from] + 0.25, tau) *
          (1 - smoothstep(h.end + 0.1, h.end + 0.8, tau)) *
          fade
        if (v < 0.01 || step.col >= 4) continue
        ctx.lineWidth = 1
        ctx.strokeStyle = rgba(accent, 0.55 * v)
        for (const cu of layout.fanOf(step.id)) strokeCubic(ctx, cu)
      }

      // 입자 — 섬유를 따라 흐른다(켜진 기둥 사이에선 케이스 색).
      const lit = glow(accent, 16, 0.14)
      for (const p of particlesRef.current) {
        p.t += p.speed * Math.min(dt, 0.05)
        if (p.t > 1) p.t -= 1
        if (p.t < 0) p.t += 1
        const pt = pointAt(p.path, p.t)
        const on = p.gap >= 0 && beamOf(tl, p.gap, tau) > 0.3
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock * 3 + p.size)
        ctx.drawImage(
          on ? lit : dust,
          pt.x - p.size / 2,
          pt.y - p.size / 2,
          p.size,
          p.size,
        )
      }
      ctx.globalAlpha = 1

      // 켜진 경로의 연결선 — 빛 점이 지난 만큼.
      for (const h of tl.hops) {
        if (tau < h.start) continue
        const u = easeInOut(Math.min(1, (tau - h.start) / (h.end - h.start)))
        const path = layout.pathOf(tl.steps[h.from].id, tl.steps[h.to].id)
        const reach = u * path.total
        const color = view.hold && tl.steps[h.to].col >= 3 ? WARN : accent
        for (const [w, a] of [
          [18, 0.08],
          [8, 0.24],
          [3.4, 0.95],
        ] as const) {
          ctx.lineWidth = w
          ctx.lineJoin = 'round'
          ctx.globalAlpha = w < 4 ? a * fade : 1
          ctx.strokeStyle =
            w < 4 ? mixWhite(color, 0.35) : rgba(color, a * fade)
          ctx.beginPath()
          ctx.moveTo(path.pts[0].x, path.pts[0].y)
          for (let i = 1; i < path.pts.length && path.len[i - 1] < reach; i++) {
            const p =
              path.len[i] <= reach
                ? path.pts[i]
                : pointAt(path, reach / path.total)
            ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // 링 — 은닉 인코더와 마지막 노드에서 퍼진다.
      for (const ring of tl.rings) {
        const k = (tau - ring.at) / 0.9
        if (k < 0 || k > 1) continue
        const p = restOf(layout, tl.steps[ring.step].id)
        const radius = 105 + 55 * (1 - (1 - k) ** 3)
        const a = (1 - k) * fade
        ctx.beginPath()
        ctx.arc(p.x - 30, p.y + 6, radius, 0, Math.PI * 2)
        ctx.lineWidth = 9
        ctx.strokeStyle = rgba(accent, 0.12 * a)
        ctx.stroke()
        ctx.lineWidth = 1.8
        ctx.strokeStyle = rgba(accent, 0.9 * a)
        ctx.stroke()
      }

      // 닿는 순간 번쩍.
      tl.at.forEach((a, i) => {
        const k = (tau - a) / 0.45
        if (k < 0 || k > 1) return
        const color = view.hold && tl.steps[i].col >= 3 ? WARN : accent
        const p = layout.portIn(tl.steps[i].id)
        const size = 120 + 90 * k
        ctx.globalAlpha = (1 - k) * 0.7 * fade
        ctx.drawImage(
          glow(color, 128, 0.06),
          p.x - size / 2,
          p.y - size / 2,
          size,
          size,
        )
      })

      // 마지막 노드에 머무는 큰 빛.
      const lastStep = tl.steps.length - 1
      const lastAt = tl.at[lastStep]
      if (tau >= lastAt) {
        const p = restOf(layout, tl.steps[lastStep].id)
        const size = 300 + 30 * Math.sin(clock * 2.4)
        ctx.globalAlpha = 0.4 * smoothstep(lastAt, lastAt + 0.4, tau) * fade
        ctx.drawImage(
          glow(accent, 256, 0.04),
          p.x - size / 2,
          p.y - size / 2,
          size,
          size,
        )
      }

      // 빛 점.
      const alpha = pulseAlpha(tau)
      if (alpha > 0) {
        const p = pulsePos(layout, tl, tau)
        const big = 150 * (1 + 0.08 * Math.sin(clock * 9))
        const core = 46
        ctx.globalAlpha = alpha
        ctx.drawImage(
          glow(accent, 192, 0.05),
          p.x - big / 2,
          p.y - big / 2,
          big,
          big,
        )
        ctx.drawImage(
          glow(accent, 64, 0.16),
          p.x - core / 2,
          p.y - core / 2,
          core,
          core,
        )
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    })
    return () => {
      off()
      ro.disconnect()
    }
  }, [engine, inspectorRef])

  // 휠 — 프리 모드에서만: 두 손가락·휠은 옮기기, 핀치(⌘·Ctrl+휠)는 커서 쪽으로
  // 확대·축소. 페이지가 같이 굴러가지 않게 passive를 끈다.
  useEffect(() => {
    const el = viewRef.current!
    const onWheel = (e: WheelEvent) => {
      const free = freeRef.current
      if (!free || focusRef.current) return
      e.preventDefault()
      const cam = camRef.current
      if (e.ctrlKey || e.metaKey) {
        const { vw, vh } = sizeRef.current
        const r = el.getBoundingClientRect()
        const next = Math.min(
          ZOOM_MAX,
          // 마우스 휠 한 칸(100 안팎)이 너무 크게 튀지 않게 한 번에 ±40까지만.
          Math.max(
            ZOOM_MIN,
            free.zoom * Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.01),
          ),
        )
        const s1 = cam.s * (next / free.zoom)
        const cx = e.clientX - r.left - vw * 0.5
        const cy = e.clientY - r.top - vh * 0.45
        free.x += cx / cam.s - cx / s1
        free.y += cy / cam.s - cy / s1
        free.zoom = next
      } else {
        free.x += e.deltaX / cam.s
        free.y += e.deltaY / cam.s
      }
      keepInside(free, modelRef.current.layout.worldH)
      snapRef.current = true
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /** 화면 가운데를 기준으로 확대·축소(+/− 버튼·키). */
  const zoomBy = (k: number) => {
    const free = freeRef.current
    if (!free) return
    free.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, free.zoom * k))
  }

  /** 다시 망 전체로. */
  const fit = () => {
    if (!freeRef.current) return
    const { vw, vh, base } = sizeRef.current
    freeRef.current = fitView(layout, vw, vh, base)
  }

  // 프리 모드 키 — + / − 확대·축소, 0 전체 보기.
  const zoomKeys = useRef({ zoomBy, fit })
  useEffect(() => {
    zoomKeys.current = { zoomBy, fit }
  })
  useEffect(() => {
    if (mode !== 'free') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      )
        return
      if (e.key === '+' || e.key === '=') zoomKeys.current.zoomBy(ZOOM_STEP)
      else if (e.key === '-' || e.key === '_')
        zoomKeys.current.zoomBy(1 / ZOOM_STEP)
      else if (e.key === '0') zoomKeys.current.fit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const isFloor = (t: EventTarget) =>
    t === viewRef.current || t === planeRef.current

  return (
    <section
      className={`pn-net${mode === 'free' ? ' is-free' : ''}`}
      ref={viewRef}
      onPointerDown={(e) => {
        if (!isFloor(e.target)) return
        dragRef.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d || d.id !== e.pointerId) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved && Math.hypot(dx, dy) < 4) return
        d.moved = true
        d.x = e.clientX
        d.y = e.clientY
        // 프리 모드이고 편집 중이 아닐 때만 끌어서 옮긴다.
        const free = freeRef.current
        if (!free || focusRef.current) return
        free.x -= dx / camRef.current.s
        free.y -= dy / camRef.current.s
        keepInside(free, modelRef.current.layout.worldH)
      }}
      onPointerUp={() => {
        const d = dragRef.current
        dragRef.current = null
        // 빈 곳을 눌렀다 떼면(끌지 않았으면) 고르기를 푼다.
        if (d && !d.moved) onSelect(null)
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
      onDoubleClick={(e) => {
        // 빈 곳을 두 번 누르면 다시 망 전체로.
        if (isFloor(e.target)) fit()
      }}
    >
      <div
        className="pn-plane"
        ref={planeRef}
        style={{ width: WORLD_W, height: layout.worldH }}
      >
        <div
          className="pn-grid"
          style={{
            left: -GRID_PAD,
            top: -GRID_PAD,
            width: WORLD_W + GRID_PAD * 2,
            height: layout.worldH + GRID_PAD * 2,
          }}
        />
        <canvas className="pn-layer" ref={bgRef} />
        <canvas className="pn-layer pn-layer--fibers" ref={fiberRef} />
        {COLUMNS.map((c, i) => (
          <div
            key={c.num}
            className="pn-colhead"
            style={
              {
                left: colX(i),
                top: HEADER_Y,
                width: colWidth(i),
                '--col': c.color,
              } as CSSProperties
            }
          >
            <span>{c.num}</span>
            {c.title}
          </div>
        ))}
        <OutputFrame engine={engine} rect={layout.outRect} />
        {model.graph.layers.map((layer, col) =>
          layer.map((node, row) => (
            <Card
              key={node.id}
              engine={engine}
              node={node}
              col={col}
              rect={layout.nodeRect(node.id)}
              section={col === 4 ? row : undefined}
              selected={node.id === selectedId}
              onSelect={onSelect}
            />
          )),
        )}
        {model.graph.layers.map((layer, col) =>
          layer.length < MAX_ROWS ? (
            <button
              key={`add-${col}`}
              type="button"
              className="pn-add"
              style={
                {
                  left: colX(col),
                  top: rowY(layer.length) + 6,
                  width: colWidth(col),
                  '--col': COLUMNS[col].color,
                } as CSSProperties
              }
              onClick={(e) => {
                e.stopPropagation()
                onAdd(col)
              }}
            >
              + {col === 4 ? '칸 추가' : '노드 추가'}
            </button>
          ) : null,
        )}
        <canvas className="pn-layer pn-layer--fx" ref={fxRef} />
      </div>
      <div className="pn-cam" onPointerDown={(e) => e.stopPropagation()}>
        <div className="pn-cam__group" role="group" aria-label="카메라 모드">
          <button
            type="button"
            className={mode === 'auto' ? 'is-on' : undefined}
            title="빛 점을 따라가며 보여 줍니다 (A)"
            onClick={() => onMode('auto')}
          >
            AUTO
          </button>
          <button
            type="button"
            className={mode === 'free' ? 'is-on' : undefined}
            title="직접 옮기고 확대·축소합니다 (F)"
            onClick={() => onMode('free')}
          >
            FREE
          </button>
        </div>
        {mode === 'free' && (
          <div className="pn-cam__group pn-cam__zoom">
            <button
              type="button"
              aria-label="축소"
              title="축소 (−)"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
            >
              −
            </button>
            <span>{zoomPct}%</span>
            <button
              type="button"
              aria-label="확대"
              title="확대 (+)"
              onClick={() => zoomBy(ZOOM_STEP)}
            >
              +
            </button>
            <button
              type="button"
              className="pn-cam__fit"
              title="망 전체 보기 (0)"
              onClick={fit}
            >
              전체
            </button>
          </div>
        )}
      </div>
      {mode === 'free' && !selectedId && (
        <p className="pn-net__hint">
          FREE · 끌어서 이동 · 핀치(⌘+휠)·+/−로 확대 · 빈 곳 두 번 눌러 전체
          보기 · 카드를 눌러 편집
        </p>
      )}
    </section>
  )
}
