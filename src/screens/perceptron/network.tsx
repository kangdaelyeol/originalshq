import { useEffect, useRef, type CSSProperties } from 'react'
import {
  COLUMNS,
  GATE,
  LOOP,
  NODES,
  SECTIONS,
  WARN,
  type NodeRow,
} from './data'
import {
  FADE_END,
  FADE_START,
  TIMELINES,
  smoothstep,
  useEngine,
  type CaseTimeline,
  type Engine,
  type Snapshot,
} from './engine'
import {
  FIBERS,
  HEADER_Y,
  OUT_RECT,
  ROWS,
  ROW_STRIDE,
  STRANDS_BY_GAP,
  WORLD_H,
  WORLD_W,
  colWidth,
  colX,
  columnIds,
  nodeRect,
  pathOf,
  pointAt,
  portIn,
  portOut,
  rng,
  rowY,
  spineX,
  type Cubic,
  type Path,
  type Pt,
  type Strand,
} from './geometry'

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
const drawBackground = (ctx: CanvasRenderingContext2D) => {
  const r = rng(77)
  ctx.clearRect(0, 0, WORLD_W, WORLD_H)
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
    const y = rowY(0) - 40 + r() * (ROWS * ROW_STRIDE + 40)
    ctx.fillStyle = rgba(
      dashColors[Math.floor(r() * dashColors.length)],
      0.35 + r() * 0.5,
    )
    ctx.fillRect(x, y, 5 + r() * 15, 1.6)
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.3})`
    const s = r() < 0.85 ? 1 : 1.8
    ctx.fillRect(r() * WORLD_W, r() * WORLD_H, s, s)
  }
}

/** 섬유 — 번짐 한 번, 가는 선 한 번. 기둥 사이 세로줄에 옅은 안개. */
const drawFibers = (ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H)
  ctx.globalCompositeOperation = 'lighter'
  for (let gap = 0; gap < 4; gap++) {
    const x = spineX(gap)
    const grd = ctx.createLinearGradient(x - 26, 0, x + 26, 0)
    grd.addColorStop(0, 'rgba(160,190,255,0)')
    grd.addColorStop(0.5, 'rgba(170,200,255,0.06)')
    grd.addColorStop(1, 'rgba(160,190,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(x - 26, rowY(0) - 30, 52, ROWS * ROW_STRIDE + 20)
  }
  const pass = (list: Strand[], widthK: number, alphaK: number) => {
    for (const s of list) {
      ctx.strokeStyle = rgba(s.color, Math.min(1, s.alpha * alphaK))
      ctx.lineWidth = s.width * widthK
      strokePath(ctx, s.path)
    }
  }
  pass(FIBERS.strands, 4, 0.22)
  pass(FIBERS.wisps, 3.5, 0.2)
  pass(FIBERS.strands, 1, 1)
  pass(FIBERS.wisps, 1, 1)
  const knot = glow('#9fd8ff', 24)
  for (const k of FIBERS.knots) {
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
const restOf = (id: string): Pt => {
  const r = nodeRect(id)
  return { x: r.x + r.w * 0.72, y: r.y + r.h * 0.42 }
}

/** 빛 점의 자리 — 첫 카드 왼쪽 끝에서 나타나 카드를 가로지르고, 연결선을
 * 따라 다음 카드로 건너간다. 마지막 카드에선 안쪽에 머문다. */
const pulsePos = (tl: CaseTimeline, tau: number): Pt => {
  const ids = tl.steps.map((s) => s.id)
  const last = ids.length - 1
  for (const h of tl.hops) {
    if (tau >= h.start && tau < h.end) {
      const u = easeInOut((tau - h.start) / (h.end - h.start))
      return pointAt(pathOf(ids[h.from], ids[h.to]), u)
    }
  }
  let i = 0
  for (let k = 0; k < tl.at.length; k++) if (tau >= tl.at[k]) i = k
  const from = portIn(ids[i])
  const to = i < last ? portOut(ids[i]) : restOf(ids[i])
  const t0 = i === 0 ? ENTER : tl.at[i]
  const t1 = i < last ? tl.hops[i].start : tl.at[i] + 0.3
  const u = easeInOut(Math.min(1, Math.max(0, (tau - t0) / (t1 - t0))))
  return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }
}

const pulseAlpha = (tau: number) =>
  smoothstep(ENTER, ENTER + 0.15, tau) *
  (1 - smoothstep(FADE_START, FADE_END, tau))

/** 게이트 미달 케이스에서 빨갛게 바뀌는 단계(게이트·출력). */
const warnStep = (slot: number, col: number) =>
  LOOP[slot].confidence < GATE && col >= 3

/** 기둥 사이 gap의 빛기둥 세기(0~1) — 빛 점이 왼쪽 카드에 닿으면 켜지고,
 * 다음 카드에 닿은 뒤 천천히 꺼진다(마지막 사이는 케이스가 끝날 때까지). */
const beamOf = (tl: CaseTimeline, gap: number, tau: number) => {
  let v = 0
  tl.hops.forEach((h, i) => {
    const c0 = tl.steps[h.from].col
    const c1 = tl.steps[h.to].col
    if (gap < c0 || gap >= c1) return
    // 기둥을 건너뛰면 지나는 차례대로 켜진다.
    const k = (gap - c0) / (c1 - c0)
    // 영상: 카드가 켜지는 순간 그 오른쪽 기둥 사이도 같이 켜진다(0.1초 안에).
    const on =
      k === 0 ? tl.at[h.from] - 0.04 : h.start + (h.end - h.start) * k - 0.1
    const off =
      i === tl.hops.length - 1
        ? 1
        : 1 - smoothstep(h.end + 0.35, h.end + 1.1, tau)
    v = Math.max(v, smoothstep(on, on + 0.12, tau) * off)
  })
  return v * (1 - smoothstep(FADE_START, FADE_END, tau))
}

/** 부채꼴 — 켜진 카드에서 다음 기둥 전체(와 그 너머 몇 개)로. */
const fanCache = new Map<string, Cubic[]>()
const fanOf = (id: string, col: number) => {
  const hit = fanCache.get(id)
  if (hit) return hit
  const r = rng(id.length * 7919 + col * 104729 + id.charCodeAt(3) * 31)
  const from = portOut(id)
  const near = columnIds(col + 1).map((b) => {
    const to = portIn(b)
    const m = spineX(col) + (r() - 0.5) * 30
    return {
      p0: from,
      c1: { x: m + (r() - 0.5) * 40, y: from.y + (r() - 0.5) * 60 },
      c2: { x: m + (r() - 0.5) * 40, y: to.y + (r() - 0.5) * 60 },
      p3: to,
    }
  })
  const far =
    col + 2 <= 4
      ? columnIds(col + 2)
          .filter(() => r() < 0.45)
          .map((b) => {
            const to = portIn(b)
            return {
              p0: from,
              c1: { x: from.x + 160, y: from.y + (r() - 0.5) * 200 },
              c2: { x: to.x - 200, y: to.y + (r() - 0.5) * 200 },
              p3: to,
            }
          })
      : []
  const list = [...near, ...far]
  fanCache.set(id, list)
  return list
}

interface Particle {
  path: Path
  gap: number
  t: number
  speed: number
  size: number
}

const makeParticles = () => {
  const r = rng(4242)
  const pool = [...FIBERS.strands, ...FIBERS.wisps.filter((w) => w.gap >= 0)]
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
  return Array.from({ length: 90 }, () => ({
    x: r() * WORLD_W,
    y: r() * WORLD_H,
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

/** 세로 구도 — 영상은 케이스가 시작될 때 기둥 제목과 0~5번째 줄이 보이고,
 * 빛 점이 아래로 내려가면 절반쯤만 따라 내려간다. */
const MID_Y = rowY(0) + ROW_STRIDE * 1.9

/** 카메라가 볼 곳과 자세 — 빛 점을 따라가되 처음엔 앞(오른쪽)을 넉넉히 두고
 * (빛 점이 화면 왼쪽 12%쯤), 끝에선 도착한 노드가 오른쪽 3/4쯤에 오게 한다.
 * 케이스가 끝나면 다음 케이스 입구로 물러난다. halfW는 보이는 폭의 절반(평면 px). */
const cameraTarget = (slot: number, tau: number, halfW: number) => {
  const aim = (p: Pt, progress: number) => ({
    x: p.x + halfW * (0.76 - 1.26 * progress),
    y: MID_Y + (p.y - MID_Y) * 0.45,
  })
  if (tau >= FADE_START + 0.15) {
    const next = TIMELINES[(slot + 1) % LOOP.length]
    return { ...aim(portIn(next.steps[0].id), 0), ...IDLE }
  }
  const tl = TIMELINES[slot]
  const lastAt = tl.at[tl.at.length - 1]
  const progress = smoothstep(0.25, lastAt + 0.3, tau)
  const [a, b] = POSES[slot]
  const mix = (k: keyof Pose) => a[k] + (b[k] - a[k]) * progress
  return {
    ...aim(pulsePos(tl, Math.max(tau, ENTER)), progress),
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
const cardState = (id: string, s: Snapshot, section?: number): CardState => {
  if (s.fading) return 'off'
  const tl = TIMELINES[s.slot]
  const i = tl.steps.findIndex((st) => st.id === id)
  if (i >= 0 && i < s.stepOn)
    return warnStep(s.slot, tl.steps[i].col) ? 'warn' : 'on'
  if (section === undefined) return 'off'
  const hold = LOOP[s.slot].confidence < GATE
  const arrived = s.stepOn >= tl.steps.length
  if (section === 0 && arrived) {
    if (hold) return 'warn'
    return s.assembled >= 8 ? 'on' : 'built'
  }
  return !hold && s.assembled > section ? 'built' : 'off'
}

/** 카드 아래 짧은 색 막대의 자리 — 카드마다 조금씩 다르게(고정). */
const barLeft = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 24 + (h % 40)
}

const Card = ({
  engine,
  id,
  col,
  title,
  rows,
  style,
  section,
}: {
  engine: Engine
  id: string
  col: number
  title: string
  rows: NodeRow[]
  style: CSSProperties
  section?: number
}) => {
  const state = useEngine(engine, (s) => cardState(id, s, section))
  const result = useEngine(engine, (s) => LOOP[s.slot].results[id] ?? '')
  const shown = (state === 'on' || state === 'warn') && result !== ''
  return (
    <div
      className={`pn-card is-${state}${shown ? ' has-result' : ''}`}
      style={
        {
          ...style,
          '--col': COLUMNS[col].color,
          '--bar': `${barLeft(id)}%`,
        } as CSSProperties
      }
    >
      <div className="pn-card__title">
        <i />
        {title}
      </div>
      <div className="pn-card__rows">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="pn-card__row">
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
const OutputFrame = ({ engine }: { engine: Engine }) => {
  const state = useEngine(engine, (s) => {
    if (s.fading) return 'off'
    if (s.stepOn < TIMELINES[s.slot].steps.length) return 'off'
    if (LOOP[s.slot].confidence < GATE) return 'warn'
    return s.assembled >= 8 ? 'on' : 'off'
  })
  return (
    <div
      className={`pn-out is-${state}`}
      style={{
        left: OUT_RECT.x,
        top: OUT_RECT.y,
        width: OUT_RECT.w,
        height: OUT_RECT.h,
      }}
    />
  )
}

// ── 망 ──────────────────────────────────────────────────────────────────

/** 바닥 격자가 평면 밖으로 이어지는 폭 — 카메라가 크게 돌면 가장자리가 보인다. */
const GRID_PAD = 700

/**
 * 가운데 신경망 — 기울어진 평면(카드·섬유·빛)을 카메라가 빛 점을 따라 움직인다.
 * 카드는 글자가 선명하게 DOM으로, 섬유는 한 번 그린 캔버스, 빛 점·빛기둥·
 * 부채꼴·링·입자는 프레임마다 그리는 캔버스에.
 */
export function Network({ engine }: { engine: Engine }) {
  const viewRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const fiberRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)

  // 정적 층 — 처음 한 번.
  useEffect(() => {
    const setup = (c: HTMLCanvasElement, scale: number) => {
      c.width = Math.round(WORLD_W * scale)
      c.height = Math.round(WORLD_H * scale)
      const ctx = c.getContext('2d')!
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      return ctx
    }
    drawBackground(setup(bgRef.current!, 1))
    drawFibers(
      setup(fiberRef.current!, Math.min(1.5, window.devicePixelRatio || 1)),
    )
  }, [])

  // 프레임마다 — 카메라와 빛.
  useEffect(() => {
    const view = viewRef.current!
    const plane = planeRef.current!
    const fx = fxRef.current!
    fx.width = WORLD_W
    fx.height = WORLD_H
    const ctx = fx.getContext('2d')!

    let vw = 0
    let vh = 0
    let base = 1
    const measure = () => {
      vw = view.clientWidth
      vh = view.clientHeight
      // 기본 배율 — 영상(720 폭)에서 카드가 140px쯤 되는 배율. 넓은 화면에선
      // 높이가 배율을 정한다(여섯 줄 남짓이 보이고, 기둥은 다 보인다).
      base = Math.min(1.2, Math.max(0.36, Math.min(vw / 1290, vh / 780)))
      view.style.perspective = `${Math.round(Math.max(vw, vh * 1.2))}px`
      view.style.perspectiveOrigin = `${vw * 0.5}px ${vh * 0.45}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(view)

    const cam = { x: 0, y: 0, s: 1, yaw: 0, pitch: 3, ready: false }
    const particles = makeParticles()
    const dust = glow('#cfe6ff', 16, 0.14)

    const off = engine.onFrame(({ slot, tau, t, dt }) => {
      const tl = TIMELINES[slot]
      const accent = LOOP[slot].color

      // 카메라 — 목표를 부드럽게 따라간다(자리는 빠르게, 자세는 조금 느리게).
      const target = cameraTarget(
        slot,
        tau,
        (vw * 0.5) / (cam.ready ? cam.s : base),
      )
      const zoom = base * target.zoom
      if (!cam.ready) {
        Object.assign(cam, { ...target, s: zoom, ready: true })
      } else {
        const k = 1 - Math.exp(-dt * 4)
        const kp = 1 - Math.exp(-dt * 2.6)
        cam.x += (target.x - cam.x) * k
        cam.y += (target.y - cam.y) * k
        cam.s += (zoom - cam.s) * kp
        cam.yaw += (target.yaw - cam.yaw) * kp
        cam.pitch += (target.pitch - cam.pitch) * kp
      }
      const halfW = (vw * 0.5) / cam.s
      const x = clampAxis(cam.x, halfW, halfW, WORLD_W, 60)
      const y = clampAxis(
        cam.y,
        (vh * 0.45) / cam.s,
        (vh * 0.55) / cam.s,
        WORLD_H,
        20,
      )
      const yaw = cam.yaw + Math.sin(t * 0.35) * 1.2
      const pitch = cam.pitch + Math.sin(t * 0.27 + 1) * 0.8
      plane.style.transform =
        `translate3d(${vw * 0.5}px, ${vh * 0.45}px, 0) rotateX(${pitch}deg) rotateY(${yaw}deg) ` +
        `scale(${cam.s}) translate3d(${-x}px, ${-y}px, 0)`

      // 빛.
      ctx.clearRect(0, 0, WORLD_W, WORLD_H)
      ctx.globalCompositeOperation = 'lighter'
      const fade = 1 - smoothstep(FADE_START, FADE_END, tau)

      // 떠다니는 먼지.
      for (const f of FLOATERS) {
        const dx = Math.sin(t * 0.4 + f.phase) * f.amp
        const dy = Math.cos(t * 0.3 + f.phase) * f.amp
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.3 + f.phase)
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
        const h = ROWS * ROW_STRIDE + 60
        const grd = ctx.createLinearGradient(bx - 70, 0, bx + 70, 0)
        grd.addColorStop(0, rgba(accent, 0))
        grd.addColorStop(0.5, rgba(accent, 0.34 * v))
        grd.addColorStop(1, rgba(accent, 0))
        ctx.globalAlpha = 1
        ctx.fillStyle = grd
        ctx.fillRect(bx - 70, top, 140, h)
        ctx.lineWidth = 1.1
        ctx.strokeStyle = rgba(accent, 0.5 * v)
        for (const s of STRANDS_BY_GAP[gap]) strokePath(ctx, s.path)
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
        for (const cu of fanOf(step.id, step.col)) strokeCubic(ctx, cu)
      }

      // 입자 — 섬유를 따라 흐른다(켜진 기둥 사이에선 케이스 색).
      const lit = glow(accent, 16, 0.14)
      for (const p of particles) {
        p.t += p.speed * Math.min(dt, 0.05)
        if (p.t > 1) p.t -= 1
        if (p.t < 0) p.t += 1
        const pt = pointAt(p.path, p.t)
        const on = p.gap >= 0 && beamOf(tl, p.gap, tau) > 0.3
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + p.size)
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
        const path = pathOf(tl.steps[h.from].id, tl.steps[h.to].id)
        const reach = u * path.total
        const color = warnStep(slot, tl.steps[h.to].col) ? WARN : accent
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
        const p = restOf(tl.steps[ring.step].id)
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
        const color = warnStep(slot, tl.steps[i].col) ? WARN : accent
        const p = portIn(tl.steps[i].id)
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
        const p = restOf(tl.steps[lastStep].id)
        const size = 300 + 30 * Math.sin(t * 2.4)
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
        const p = pulsePos(tl, tau)
        const big = 150 * (1 + 0.08 * Math.sin(t * 9))
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
  }, [engine])

  return (
    <section className="pn-net" ref={viewRef}>
      <div
        className="pn-plane"
        ref={planeRef}
        style={{ width: WORLD_W, height: WORLD_H }}
      >
        <div
          className="pn-grid"
          style={{
            left: -GRID_PAD,
            top: -GRID_PAD,
            width: WORLD_W + GRID_PAD * 2,
            height: WORLD_H + GRID_PAD * 2,
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
        <OutputFrame engine={engine} />
        {NODES.map((nd) => {
          const r = nodeRect(nd.id)
          return (
            <Card
              key={nd.id}
              engine={engine}
              id={nd.id}
              col={nd.col}
              title={nd.title}
              rows={nd.rows}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            />
          )
        })}
        {SECTIONS.map((sc) => {
          const r = nodeRect(sc.id)
          return (
            <Card
              key={sc.id}
              engine={engine}
              id={sc.id}
              col={4}
              title={sc.title}
              rows={sc.rows}
              section={sc.row}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            />
          )
        })}
        <canvas className="pn-layer pn-layer--fx" ref={fxRef} />
      </div>
    </section>
  )
}
