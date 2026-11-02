import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useTween } from '../view-model/use-tween'

// 신호 그래프 — 프롬프트 퍼셉트론 영상(perceptron.mp4)의 신경망 화면을 옮긴
// 것(기울기·카메라 이동은 뺐다).
//   · 열: 위에 "02 JOBS / RUN" 같은 이름과 열 색 밑줄
//   · 카드: 진한 판, 열 색 네모 + 굵은 이름, 회색 이름 · 오른쪽 값 줄, 아래 열
//     색 짧은 막대. 고른 노드·이어진 노드·실패는 네온 테두리와 바깥 빛, 고른
//     노드·실패는 막대 대신 결과 띠
//   · 기둥: 열 사이 흰 빛 섬유 다발 — 카드로 휘어 뻗는 가지, 빛나는 매듭,
//     섬유를 따라 흐르는 빛 점. 켜진 선이 지나는 기둥은 그 색으로 물든다
//   · 선: 평소엔 가는 색 선(출발 열의 색) + 작은 빛 점. 고른 노드에 닿은 선은
//     카드 → 기둥 → 카드로 꺾어 가는 굵은 네온 세 겹 + 큰 빛 공
// 세 겹을 포갠다 — 뒤 SVG(격자·기둥·선: 한 번 그리면 끝), 빛 점 층(HTML 점마다
// 선을 따라 짚은 좌표로 transform 애니메이션 — 브라우저가 GPU 합성 단계에서
// 움직여서 매 프레임 다시 칠하지 않는다), 앞 SVG(숫자·카드). 빛나는 것은 흐림
// 필터 없이 반투명 겹으로.
// 데이터가 바뀌어 배치가 달라지면(기간·필터) 노드·선·높이가 이전 자리에서 새
// 자리로 미끄러지고, 새 노드는 떠오르고 빠지는 노드는 사라진다(useTween).

/** 노드·선의 상태 색 — 성공·주의·실패·실행 중·대기·탭 강조색. */
export type SignalTone = 'ok' | 'warn' | 'fail' | 'run' | 'idle' | 'accent'

/** 카드 한 줄 — 왼쪽 회색 이름, 오른쪽 값(tone이 있으면 그 색). */
export interface SignalRow {
  label: string
  value: string
  tone?: SignalTone
}

export interface SignalNode {
  id: string
  /** 노드 가운데 좌표(그림 좌표). */
  x: number
  y: number
  label: string
  /** 카드 줄 — 없으면 이름만 있는 낮은 카드. */
  rows?: SignalRow[]
  /** 이름 오른쪽 값(건수·횟수 등). */
  tag?: string
  tone: SignalTone
  /** 노드 너비 — 기본 168. */
  width?: number
  /** 노드 높이 — 기본은 줄 수로 정한다(cardHeight). */
  height?: number
  /** 고른 노드·실패일 때 카드 아래 결과 띠의 글자. */
  result?: string
  /** 고른 노드 — 네온 테두리와 결과 띠. */
  active?: boolean
  onClick?: () => void
}

export interface SignalEdge {
  from: string
  to: string
  tone: SignalTone
  /** 선 굵기 배율(1~4). */
  weight?: number
  dashed?: boolean
  /** 빛 점이 흐르는지 — 실제로 데이터가 오가는 선만. */
  flow?: boolean
  /** 선 가운데 작은 글씨. */
  label?: string
  /** arc — 세로로 늘어선 노드끼리 오른쪽으로 휘어 잇는 선(사용 흐름). */
  route?: 'auto' | 'arc' | 'bus'
  /** bus — 이 x에서 꺾어 도착 노드 높이로 가로로 곧게 들어간다(앞 열의 노드
   * 사이 틈을 지나가게). */
  turnX?: number
  /** 꺾은선 길(처음·끝 점 포함) — 주면 route 대신 이 점들을 둥근 모서리로
   * 잇는다(사용 흐름의 격자: 기둥과 카드 줄 사이 틈을 따라간다). 켜져도 같은
   * 길. 데이터가 바뀌어 넘어갈 때 점끼리 섞이도록 점 수는 늘 같게 준다. */
  via?: { x: number; y: number }[]
  /** 글씨 자리 — via 길의 처음(출발 카드 옆)·끝(도착 카드 옆). 없으면 가운데. */
  labelAt?: 'start' | 'end'
}

/** 기둥(열) — 위에 이름과 색 밑줄, 그 열 노드의 색 네모·막대 색. */
export interface SignalColumn {
  /** 열 가운데 x와 너비(그림 좌표). */
  x: number
  width: number
  label: string
  color: string
}

const NODE_W = 168
// 카드 치수 — 이름 줄, 줄 간격, 아래 막대 자리. 줄이 없으면 이름 + 막대만.
const TITLE_H = 30
const ROW_H = 12.5
const FOOT_H = 20
const SLIM_H = 40
// 열 머리가 있으면 그 높이만큼 그림 전체를 아래로 내린다.
const HEAD_H = 44
// 글자 크기 — styles/index.scss의 .sig-node__label·__key·__tag와 같게.
const TITLE_PX = 12
const ROW_PX = 9.5

const cardHeight = (rows: number) =>
  rows > 0 ? TITLE_H + rows * ROW_H + FOOT_H : SLIM_H

/** 늘 같은 배치가 나오는 난수(씨앗) — 섬유·가지·매듭·먼지. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** 노드 아래 짧은 막대의 위치 — 영상의 카드처럼 노드마다 조금씩 다르게. */
const barOffset = (id: string) => {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return 0.1 + (Math.abs(hash) % 55) / 100
}

/** 글자 폭 어림 — 고정폭 글꼴의 영문·숫자는 0.6em, 한글은 1em쯤. */
const textWidth = (text: string, size: number) => {
  let em = 0
  for (const ch of text) em += ch.charCodeAt(0) > 0x2e80 ? 0.98 : 0.6
  return em * size
}

/** 폭 안에 들어가게 뒤를 자른다. */
const fit = (text: string, maxWidth: number, size: number) => {
  if (textWidth(text, size) <= maxWidth) return text
  let out = ''
  let used = textWidth('…', size)
  for (const ch of text) {
    used += textWidth(ch, size)
    if (used > maxWidth) break
    out += ch
  }
  return `${out}…`
}

type Box = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }
type Route = { d: string; start: Point; end: Point; center: Point }

/** 가운데에서 상대 쪽으로 그은 선이 노드 테두리와 만나는 점. */
const anchor = (box: Box, toward: Point) => {
  const dx = toward.x - box.x
  const dy = toward.y - box.y
  if (dx === 0 && dy === 0) return { x: box.x, y: box.y }
  const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: box.x + dx * s, y: box.y + dy * s }
}

/** 선 하나의 길 — 가로로 흐르는 선은 부드러운 S자, 그 밖(같은 줄·되돌아가는
 * 선)은 한쪽으로 휜 곡선(오가는 두 선이 겹치지 않게). */
const edgePath = (
  a: Box,
  b: Box,
  route: SignalEdge['route'] = 'auto',
  turnX?: number,
): Route => {
  if (route === 'bus' && turnX !== undefined) {
    // 꺾어 들어가는 선 — 꺾는 곳까지는 S자, 그 뒤는 도착 높이로 곧게.
    const start = { x: a.x + a.w / 2, y: a.y }
    const end = { x: b.x - b.w / 2, y: b.y }
    const mid = (turnX - start.x) / 2
    return {
      start,
      end,
      d: `M${start.x},${start.y} C${start.x + mid},${start.y} ${turnX - mid},${end.y} ${turnX},${end.y} L${end.x},${end.y}`,
      center: { x: (turnX + end.x) / 2, y: end.y },
    }
  }
  if (route === 'arc') {
    // 두 노드의 오른쪽 끝을 잇고, 멀수록 크게 휜다. 아래로 가는 선과 위로
    // 가는 선은 휘는 정도를 달리해 겹치지 않게.
    const start = { x: a.x + a.w / 2, y: a.y + (b.y > a.y ? 6 : -6) }
    const end = { x: b.x + b.w / 2, y: b.y + (b.y > a.y ? -6 : 6) }
    const bulge = 26 + Math.abs(end.y - start.y) * 0.42 + (b.y < a.y ? 18 : 0)
    return {
      start,
      end,
      d: `M${start.x},${start.y} C${start.x + bulge},${start.y} ${end.x + bulge},${end.y} ${end.x},${end.y}`,
      center: { x: start.x + bulge * 0.76, y: (start.y + end.y) / 2 + 4 },
    }
  }
  const forward = b.x - a.x > (a.w + b.w) / 2
  if (forward) {
    const start = { x: a.x + a.w / 2, y: a.y }
    const end = { x: b.x - b.w / 2, y: b.y }
    const mid = (end.x - start.x) / 2
    return {
      start,
      end,
      d: `M${start.x},${start.y} C${start.x + mid},${start.y} ${end.x - mid},${end.y} ${end.x},${end.y}`,
      center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    }
  }
  const start = anchor(a, b)
  const end = anchor(b, a)
  const mx = (start.x + end.x) / 2
  const my = (start.y + end.y) / 2
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const bend = Math.min(60, length * 0.22)
  const cx = mx - (dy / length) * bend
  const cy = my + (dx / length) * bend
  return {
    start,
    end,
    d: `M${start.x},${start.y} Q${cx},${cy} ${end.x},${end.y}`,
    center: { x: (mx + cx) / 2, y: (my + cy) / 2 },
  }
}

/** 켜진 선의 길 — 영상처럼 카드에서 바로 옆 기둥까지 가로로, 기둥을 따라
 * 세로로, 다시 가로로 도착 카드에 들어간다(모서리는 둥글게). 사이에 기둥이
 * 없으면 null(평소 길로 그린다). */
const litPath = (a: Box, b: Box, spines: number[]) => {
  const sx = a.x + a.w / 2
  const ex = b.x - b.w / 2
  const spine = spines.find((x) => x > sx && x < ex)
  if (spine === undefined) return null
  const sy = a.y
  const ey = b.y
  const dir = Math.sign(ey - sy)
  const r = Math.min(12, Math.abs(ey - sy) / 2, spine - sx, ex - spine)
  const d =
    dir === 0
      ? `M${sx},${sy} H${ex}`
      : `M${sx},${sy} H${spine - r} Q${spine},${sy} ${spine},${sy + dir * r} V${ey - dir * r} Q${spine},${ey} ${spine + r},${ey} H${ex}`
  return {
    spine,
    route: {
      d,
      start: { x: sx, y: sy },
      end: { x: ex, y: ey },
      center: { x: (spine + ex) / 2, y: ey },
    },
  }
}

/** 꺾은선 길 — 같은 점·한 줄 위의 점은 빼고, 꺾이는 곳마다 둥글게. 세로로
 * 지나는 x(켜진 기둥 찾기)도 같이 돌려준다. */
const polyRoute = (
  via: Point[],
  labelAt?: SignalEdge['labelAt'],
): Route & { verticals: number[] } => {
  const points: Point[] = []
  for (const p of via) {
    const last = points[points.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) continue
    const prev = points[points.length - 2]
    // 앞의 두 점과 한 줄 위면 가운데 점을 버린다.
    if (
      prev &&
      Math.abs(
        (last.x - prev.x) * (p.y - last.y) - (last.y - prev.y) * (p.x - last.x),
      ) < 0.5
    )
      points.pop()
    points.push(p)
  }
  const f = (p: Point) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  let d = `M${f(points[0])}`
  for (let i = 1; i < points.length - 1; i++) {
    const [a, p, b] = [points[i - 1], points[i], points[i + 1]]
    const la = Math.hypot(p.x - a.x, p.y - a.y)
    const lb = Math.hypot(b.x - p.x, b.y - p.y)
    const r = Math.min(10, la / 2, lb / 2)
    const p1 = {
      x: p.x - ((p.x - a.x) / la) * r,
      y: p.y - ((p.y - a.y) / la) * r,
    }
    const p2 = {
      x: p.x + ((b.x - p.x) / lb) * r,
      y: p.y + ((b.y - p.y) / lb) * r,
    }
    d += ` L${f(p1)} Q${f(p)} ${f(p2)}`
  }
  const start = points[0]
  const end = points[points.length - 1]
  d += ` L${f(end)}`
  // 가운데 — 가장 긴 토막의 가운데.
  let center = start
  let longest = -1
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    )
    if (length > longest) {
      longest = length
      center = {
        x: (points[i].x + points[i - 1].x) / 2,
        y: (points[i].y + points[i - 1].y) / 2,
      }
    }
  }
  if (labelAt === 'start') center = { x: start.x + 15, y: start.y }
  if (labelAt === 'end') center = { x: end.x - 15, y: end.y }
  const verticals = points
    .slice(1)
    .filter((p, i) => Math.abs(p.x - points[i].x) < 0.5)
    .map((p) => p.x)
  return { d, start, end, center, verticals }
}

// ── 넘어가기(useTween) ── 배치(노드 상자·선의 꺾은점·그림 높이)만 섞는다. 글자·
// 상태는 늘 지금 값 — 빠지는 노드·선만 마지막 값을 들고 사라진다.
type Placed<T> = { item: T; alpha: number }
type Geometry = {
  height: number
  nodes: Map<string, Placed<SignalNode> & { box: Box }>
  edges: Map<string, Placed<SignalEdge> & { via: Point[] | null }>
}

const edgeKey = (edge: SignalEdge) => `${edge.from}>${edge.to}`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const geometryOf = (
  nodes: SignalNode[],
  edges: SignalEdge[],
  height: number,
): Geometry => ({
  height,
  nodes: new Map(
    nodes.map((node) => [
      node.id,
      {
        item: node,
        alpha: 1,
        box: {
          x: node.x,
          y: node.y,
          w: node.width ?? NODE_W,
          h: node.height ?? cardHeight(node.rows?.length ?? 0),
        },
      },
    ]),
  ),
  edges: new Map(
    edges.map((edge) => [
      edgeKey(edge),
      { item: edge, alpha: 1, via: edge.via ?? null },
    ]),
  ),
})

/** 배치가 같은지 — 다르면 넘어가기를 시작한다. */
const geometryKey = (geometry: Geometry) =>
  [
    geometry.height,
    [...geometry.nodes]
      .map(([id, { box }]) => `${id}@${box.x},${box.y},${box.w},${box.h}`)
      .join(';'),
    [...geometry.edges]
      .map(
        ([key, { via }]) =>
          `${key}${via ? via.map((p) => `${p.x},${p.y}`).join(' ') : ''}`,
      )
      .join(';'),
  ].join('|')

const mixGeometry = (from: Geometry, to: Geometry, t: number): Geometry => {
  const nodes: Geometry['nodes'] = new Map()
  for (const [id, next] of to.nodes) {
    const prev = from.nodes.get(id)
    nodes.set(
      id,
      prev
        ? {
            ...next,
            alpha: lerp(prev.alpha, 1, t),
            box: {
              x: lerp(prev.box.x, next.box.x, t),
              y: lerp(prev.box.y, next.box.y, t),
              w: lerp(prev.box.w, next.box.w, t),
              h: lerp(prev.box.h, next.box.h, t),
            },
          }
        : { ...next, alpha: t },
    )
  }
  for (const [id, prev] of from.nodes) {
    if (!to.nodes.has(id))
      nodes.set(id, { ...prev, alpha: prev.alpha * (1 - t) })
  }
  const edges: Geometry['edges'] = new Map()
  for (const [key, next] of to.edges) {
    const prev = from.edges.get(key)
    const via =
      prev?.via && next.via && prev.via.length === next.via.length
        ? next.via.map((p, i) => ({
            x: lerp(prev.via![i].x, p.x, t),
            y: lerp(prev.via![i].y, p.y, t),
          }))
        : next.via
    edges.set(
      key,
      prev
        ? { ...next, via, alpha: lerp(prev.alpha, 1, t) }
        : { ...next, alpha: t },
    )
  }
  for (const [key, prev] of from.edges) {
    if (!to.edges.has(key))
      edges.set(key, { ...prev, alpha: prev.alpha * (1 - t) })
  }
  return { height: lerp(from.height, to.height, t), nodes, edges }
}

/** 문자열 → 씨앗 수. */
const hashOf = (text: string) => {
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return hash
}

/** 기둥 섬유 한 가닥 — 위에서 아래로 천천히 꼬이며 흔들리는 선(고정). */
const strandPath = (
  x: number,
  top: number,
  bottom: number,
  random: () => number,
) => {
  const amp = 1.5 + random() * 7
  const phase = random() * Math.PI * 2
  const wave = 120 + random() * 170
  const drift = (random() - 0.5) * 12
  const points: Point[] = []
  for (let y = top; y < bottom + 22; y += 22) {
    const at = Math.min(y, bottom)
    const k = (at - top) / Math.max(1, bottom - top)
    points.push({
      x: x + drift * k + Math.sin(phase + (at / wave) * Math.PI * 2) * amp,
      y: at,
    })
  }
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(points[0].x)},${f(points[0].y)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const next = points[i]
    d += ` Q${f(prev.x)},${f(prev.y)} ${f((prev.x + next.x) / 2)},${f((prev.y + next.y) / 2)}`
  }
  const last = points[points.length - 1]
  return `${d} L${f(last.x)},${f(last.y)}`
}

/** 빛 점 하나 — 선(pulse)·켜진 선의 빛 공(lit)·섬유 위 빛 점(spark). */
type MotionDot = {
  d: string
  kind: 'pulse' | 'lit' | 'spark'
  /** 선의 상태 색(SignalTone) — 섬유 빛 점은 ''. */
  tone: string
  /** 출발 열의 색(--col) — 섬유 빛 점은 ''. */
  color: string
  dim: boolean
  /** 켜진 기둥의 섬유 빛 점(탭 강조색). */
  litSpine: boolean
  /** 한 바퀴(초)·시작 위치(초 — 이만큼 지난 데서 시작)·거꾸로. */
  duration: number
  delay: number
  reverse: boolean
}

// 빛 점이 지날 좌표를 이만큼(그림 좌표)마다 짚는다 — 사이는 곧게 이어져서,
// 이 정도면 곡선도 매끈해 보인다.
const SAMPLE_STEP = 6

/**
 * 신호 그래프 — 노드(작업·단계·탭)와 그 사이 흐름을 퍼셉트론 영상의 신경망처럼
 * 그린다. 데이터가 실제로 오가는 선(flow)에는 빛 점이 흐르고, 카드 값의 색이
 * 상태를 뜻한다(색만으로 구분하지 않게 글자도 같이 쓴다). 그림 좌표
 * (width × height) 안에 그려 화면 폭에 맞춰 늘고 준다.
 */
export const SignalGraph = ({
  width,
  height,
  nodes,
  edges,
  label,
  focus = null,
  columns = [],
  spines = [],
}: {
  width: number
  height: number
  nodes: SignalNode[]
  edges: SignalEdge[]
  /** 읽어 주는 이름 — "배치 파이프라인" 등. */
  label: string
  /** 고른 노드 — 그 노드에 닿은 선·노드가 켜지고 나머지는 흐려진다. */
  focus?: string | null
  /** 열 머리 — 영상의 TYPES / QUESTIONS 같은 기둥 이름. */
  columns?: SignalColumn[]
  /** 기둥 x — 열 사이에 세로로 늘어선 빛 섬유 다발. */
  spines?: number[]
}) => {
  // 화면 밖에 있거나 브라우저 탭이 숨겨져 있으면 움직임을 멈춘다 — CSS
  // 애니메이션은 is-paused로, 빛 점(Web Animations)은 직접 멈춘다.
  const stageRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<SVGPathElement>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let onScreen = true
    const apply = () => {
      const paused = !onScreen || document.hidden
      stage.classList.toggle('is-paused', paused)
      for (const animation of motionRef.current?.getAnimations({
        subtree: true,
      }) ?? []) {
        if (paused) animation.pause()
        else animation.play()
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      apply()
    })
    observer.observe(stage)
    document.addEventListener('visibilitychange', apply)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', apply)
    }
  }, [])

  // 그라데이션·마스크 id — 한 화면에 그림이 여럿이어도 겹치지 않게.
  const prefix = useId().replace(/:/g, '')

  // 지금 보이는 배치 — 데이터가 바뀌어 배치가 달라지면 잠깐 섞인 값.
  const target = geometryOf(nodes, edges, height)
  const targetKey = geometryKey(target)
  const shown = useTween(target, targetKey, mixGeometry)
  // 넘어가는 중에는 빛 점을 숨긴다 — 매 프레임 길이 바뀌어 좌표를 다시 짚을 수
  // 없다. 다 넘어가면 새 길로 다시 만든다.
  const settled = shown === target || geometryKey(shown) === targetKey
  const currentNodes = new Map(nodes.map((node) => [node.id, node]))
  const currentEdges = new Map(edges.map((edge) => [edgeKey(edge), edge]))
  const boxes = new Map<string, Box>(
    [...shown.nodes].map(([id, placed]) => [id, placed.box]),
  )
  const placedNodes = [...shown.nodes].map(([id, placed]) => ({
    node: currentNodes.get(id) ?? placed.item,
    box: placed.box,
    alpha: placed.alpha,
  }))
  const graphHeight = shown.height

  const top = columns.length > 0 ? HEAD_H : 0
  const fullHeight = graphHeight + top
  const viewBox = `0 0 ${width} ${fullHeight}`
  /** x가 들어가는 열의 색 — 없으면 탭 강조색. */
  const columnColor = (x: number) =>
    columns.find((column) => Math.abs(column.x - x) <= column.width / 2)
      ?.color ?? 'var(--log-accent)'
  /** x 가까이의 기둥 — 꺾은선이 기둥 옆 여러 줄로 지나가도 그 기둥으로. */
  const spineNear = (x: number) => spines.find((each) => Math.abs(each - x) < 7)

  // 선마다 길 — 고른 노드에 닿은 선은 켜져 기둥을 따라 꺾어 간다.
  const routes = [...shown.edges].flatMap(([key, placed], index) => {
    const live = currentEdges.get(key)
    const edge = live ?? placed.item
    const a = boxes.get(edge.from)
    const b = boxes.get(edge.to)
    if (!a || !b) return []
    const lit =
      Boolean(live) &&
      focus !== null &&
      (edge.from === focus || edge.to === focus)
    let path: Route
    let litX: number[] = []
    if (placed.via) {
      const poly = polyRoute(placed.via, edge.labelAt)
      path = poly
      litX = poly.verticals
    } else {
      const bent = lit && edge.route !== 'arc' ? litPath(a, b, spines) : null
      path = bent?.route ?? edgePath(a, b, edge.route, edge.turnX)
      if (bent) litX = [bent.spine]
    }
    return [
      {
        key,
        edge,
        index,
        lit,
        alpha: placed.alpha,
        dim: focus !== null && !lit,
        // 평소 선의 색 — 출발 노드가 있는 열의 색(영상의 분홍·보라·노랑 선).
        color: columnColor(a.x),
        weight: Math.max(1, Math.min(4, edge.weight ?? 1)),
        path,
        litX,
      },
    ]
  })
  const linked = new Set<string>(focus ? [focus] : [])
  const litSpines = new Set<number>()
  for (const route of routes) {
    if (!route.lit) continue
    linked.add(route.edge.from)
    linked.add(route.edge.to)
    for (const x of route.litX) {
      const spine = spineNear(x)
      if (spine !== undefined) litSpines.add(spine)
    }
  }

  // 바닥 먼지 — 100 높이 띠마다 씨앗을 따로 둬서, 그림 높이가 바뀌어도 있던
  // 점은 제자리에 있고 늘어난 띠에만 새로 생긴다.
  const dust: { x: number; y: number; r: number; opacity: number }[] = []
  for (let band = 0; band * 100 < graphHeight; band++) {
    const random = seeded(width * 7 + band)
    for (let i = 0; i < Math.round((width * 100) / 5200); i++) {
      const dot = {
        x: random() * width,
        y: band * 100 + random() * 100,
        r: random() < 0.85 ? 0.6 : 1.1,
        opacity: 0.06 + random() * 0.24,
      }
      if (dot.y < graphHeight) dust.push(dot)
    }
  }

  // 기둥 — 섬유 가닥, 카드로 뻗는 가지, 매듭, 흐르는 빛 점. 씨앗은 기둥 x(가지는
  // 노드마다 따로)라 높이·노드가 바뀌며 넘어가는 동안에도 흔들리지 않는다.
  const spineParts = spines.map((x) => {
    const random = seeded(Math.round(x * 13))
    // 몇 가닥은 왼쪽 열의 색으로(영상의 분홍·청록이 섞인 섬유).
    const tint =
      [...columns].reverse().find((column) => column.x < x)?.color ??
      'var(--log-accent)'
    const strands = Array.from({ length: 14 }, (_, index) => ({
      d: strandPath(x + (random() - 0.5) * 16, 4, graphHeight - 4, random),
      width: 0.4 + random() * 1,
      opacity: 0.2 + random() * 0.55,
      tinted: index % 6 === 3,
      spark: index % 5 === 1,
      duration: 6 + random() * 5,
      delay: random() * 8,
      reverse: random() < 0.5,
    }))
    // 가지 — 기둥 옆 카드의 가장자리로 깃털처럼 휘어 뻗는 가는 선. 기둥에서
    // 세로로 떠나 카드 가장자리에 가로로 닿는다. 몇 개는 끝에 빛 점.
    const wisps: string[] = []
    const knots: { x: number; y: number; r: number }[] = []
    const f = (n: number) => n.toFixed(1)
    for (const { node, box, alpha } of placedNodes) {
      if (alpha < 0.5) continue
      const left = box.x - box.w / 2
      const right = box.x + box.w / 2
      const edgeX =
        left > x && left - x < 120
          ? left
          : right < x && x - right < 120
            ? right
            : null
      if (edgeX === null) continue
      const wispRandom = seeded(hashOf(node.id) + Math.round(x))
      for (let i = 0; i < 3; i++) {
        const sy = box.y + (wispRandom() - 0.5) * box.h * 1.8
        const ey = box.y + (wispRandom() - 0.5) * box.h * 0.7
        const sx = x + (wispRandom() - 0.5) * 10
        const bend = 0.3 + wispRandom() * 0.4
        wisps.push(
          `M${f(sx)},${f(sy)} C${f(sx)},${f(sy + (ey - sy) * 0.8)} ${f(edgeX + (sx - edgeX) * bend)},${f(ey)} ${f(edgeX)},${f(ey)}`,
        )
        if (i === 0) knots.push({ x: edgeX, y: ey, r: 0.9 })
      }
    }
    // 매듭 — 55 높이 칸마다 하나(칸마다 같은 수의 난수를 써서 자리가 고정).
    const knotRandom = seeded(Math.round(x * 7) + 1)
    for (let slot = 0; slot * 55 < graphHeight; slot++) {
      const knot = {
        x: x + (knotRandom() - 0.5) * 18,
        y: slot * 55 + 8 + knotRandom() * 39,
        r: 0.8 + knotRandom() * 1.3,
      }
      if (knot.y < graphHeight - 8) knots.push(knot)
    }
    return { x, tint, strands, wisp: wisps.join(' '), knots }
  })

  // 빛 점 — 섬유마다 몇 개, 데이터가 오가는 선(flow)과 켜진 선마다 하나.
  const motionDots: MotionDot[] = settled
    ? [
        ...spineParts.flatMap((spine) =>
          spine.strands
            .filter((strand) => strand.spark)
            .map((strand) => ({
              d: strand.d,
              kind: 'spark' as const,
              tone: '',
              color: '',
              dim: false,
              litSpine: litSpines.has(spine.x),
              duration: strand.duration,
              delay: strand.delay,
              reverse: strand.reverse,
            })),
        ),
        ...routes
          .filter(({ edge, lit }) => edge.flow || lit)
          .map(({ edge, index, lit, dim, color, path }) => ({
            d: path.d,
            kind: lit ? ('lit' as const) : ('pulse' as const),
            tone: edge.tone,
            color,
            dim,
            litSpine: false,
            duration: lit ? 2.4 : 3.4 + (index % 5) * 0.45,
            delay: (index * 0.67) % 3.4,
            reverse: false,
          })),
      ]
    : []
  const motionKey = JSON.stringify({ top, dots: motionDots })

  // 빛 점 만들기 — 길마다 SAMPLE_STEP마다 짚은 좌표를 transform 키프레임으로
  // (같은 간격이라 같은 빠르기). transform 애니메이션은 GPU 합성 단계에서 돌아
  // 매 프레임 다시 칠하지 않는다(SVG 점선을 움직이던 때는 이 층을 초당 60번
  // 다시 칠해 화면을 켜 둔 동안 브라우저 일의 대부분이었다).
  useEffect(() => {
    const layer = motionRef.current
    const measure = measureRef.current
    if (!layer || !measure) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const { top: offset, dots } = JSON.parse(motionKey) as {
      top: number
      dots: MotionDot[]
    }
    const animations = dots.map((dot) => {
      measure.setAttribute('d', dot.d)
      const total = measure.getTotalLength()
      const count = Math.max(2, Math.min(200, Math.ceil(total / SAMPLE_STEP)))
      const frames = Array.from({ length: count + 1 }, (_, i) => {
        const point = measure.getPointAtLength((total * i) / count)
        return {
          transform: `translate(${point.x.toFixed(1)}px,${(point.y + offset).toFixed(1)}px)`,
        }
      })
      const element = document.createElement('i')
      element.className = [
        'sig-dot',
        `is-${dot.kind}`,
        dot.tone && `is-${dot.tone}`,
        dot.dim && 'is-dim',
        dot.litSpine && 'is-lit-spine',
      ]
        .filter(Boolean)
        .join(' ')
      if (dot.color) element.style.setProperty('--col', dot.color)
      layer.append(element)
      return element.animate(frames, {
        duration: dot.duration * 1000,
        delay: -dot.delay * 1000,
        iterations: Infinity,
        easing: 'linear',
        direction: dot.reverse ? 'reverse' : 'normal',
      })
    })
    if (stageRef.current?.classList.contains('is-paused')) {
      for (const animation of animations) animation.pause()
    }
    return () => {
      for (const animation of animations) animation.cancel()
      layer.replaceChildren()
    }
  }, [motionKey])

  // 빛 점 층 크기 — 그림 좌표(width)를 화면 폭에 맞춘다(뒤·앞 SVG의 viewBox와
  // 같은 비율). 폭이 바뀔 때만 고친다.
  useEffect(() => {
    const stage = stageRef.current
    const layer = motionRef.current
    if (!stage || !layer) return
    const observer = new ResizeObserver(() => {
      layer.style.transform = `scale(${stage.clientWidth / width})`
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [width])

  const onKey = (node: SignalNode) => (event: KeyboardEvent) => {
    if (node.onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      node.onClick()
    }
  }

  return (
    <div ref={stageRef} className="sig-stage">
      {/* 뒤 — 격자, 열 머리, 먼지, 기둥, 선. 움직이지 않는다(처음 그릴 때만). */}
      <svg className="sig-graph" viewBox={viewBox} aria-hidden="true">
        <defs>
          {/* 바닥 격자 — 가운데는 보이고 가장자리로 갈수록 흐려진다. */}
          <pattern
            id={`${prefix}-grid`}
            width="120"
            height="96"
            patternUnits="userSpaceOnUse"
          >
            <path d="M120 0H0V96" className="sig-grid" />
          </pattern>
          <radialGradient id={`${prefix}-fade`}>
            <stop offset="0.55" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${prefix}-mask`}>
            <rect
              width={width}
              height={fullHeight}
              fill={`url(#${prefix}-fade)`}
            />
          </mask>
          {/* 기둥 위아래 끝이 흐려지게. */}
          <linearGradient id={`${prefix}-vfade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.06" stopColor="#fff" />
            <stop offset="0.94" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${prefix}-vmask`}>
            <rect
              width={width}
              height={graphHeight}
              fill={`url(#${prefix}-vfade)`}
            />
          </mask>
        </defs>

        <g mask={`url(#${prefix}-mask)`}>
          <rect
            width={width}
            height={fullHeight}
            fill={`url(#${prefix}-grid)`}
          />
        </g>
        {/* 빛 점이 지날 좌표를 짚는 데 쓰는 보이지 않는 길. */}
        <path ref={measureRef} d="M0,0" visibility="hidden" />

        {/* 열 머리 — 앞 번호는 열 색, 아래 열 색 밑줄(오른쪽으로 옅어진다). */}
        {columns.map((column, index) => (
          <g
            key={column.label}
            className="sig-colhead"
            transform={`translate(${column.x - column.width / 2},0)`}
          >
            <text y="22" className="sig-colhead__text">
              <tspan className="sig-colhead__no" fill={column.color}>
                {String(index + 1).padStart(2, '0')}
              </tspan>{' '}
              {column.label}
            </text>
            <linearGradient id={`${prefix}-col-${index}`} x1="0" x2="1">
              <stop offset="0" stopColor={column.color} />
              <stop offset="1" stopColor={column.color} stopOpacity="0.15" />
            </linearGradient>
            <rect
              y="31"
              width={column.width}
              height="1.5"
              fill={`url(#${prefix}-col-${index})`}
            />
          </g>
        ))}

        <g transform={`translate(0,${top})`}>
          <g className="sig-dust">
            {dust.map((dot, index) => (
              <circle
                key={index}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                opacity={dot.opacity}
              />
            ))}
          </g>

          {/* 기둥 — 옅은 띠, 가지, 섬유, 가운데 심, 매듭. 켜진 선이 지나는
              기둥은 탭 강조색으로 물든다(--spine). */}
          <g mask={`url(#${prefix}-vmask)`}>
            {spineParts.map((spine, index) => (
              <g
                key={spine.x}
                className={`sig-spine${litSpines.has(spine.x) ? ' is-lit' : ''}`}
                style={{ ['--tint' as string]: spine.tint }}
              >
                <linearGradient id={`${prefix}-band-${index}`}>
                  <stop offset="0" className="sig-spine__stop is-edge" />
                  <stop offset="0.5" className="sig-spine__stop is-core" />
                  <stop offset="1" className="sig-spine__stop is-edge" />
                </linearGradient>
                <radialGradient id={`${prefix}-glow-${index}`}>
                  <stop offset="0" className="sig-spine__glow is-core" />
                  <stop offset="0.3" className="sig-spine__glow is-mid" />
                  <stop offset="1" className="sig-spine__glow is-edge" />
                </radialGradient>
                <rect
                  x={spine.x - 36}
                  width="72"
                  height={graphHeight}
                  fill={`url(#${prefix}-band-${index})`}
                />
                <path d={spine.wisp} className="sig-spine__wisp" />
                {/* 빛 점이 흐르는 가닥 밑에는 넓고 옅은 번짐 — 광섬유처럼. */}
                {spine.strands
                  .filter((strand) => strand.spark)
                  .map((strand, glowIndex) => (
                    <path
                      key={`g${glowIndex}`}
                      d={strand.d}
                      className="sig-spine__strand is-glow"
                    />
                  ))}
                {spine.strands.map((strand, strandIndex) => (
                  <path
                    key={strandIndex}
                    d={strand.d}
                    className={`sig-spine__strand${strand.tinted ? ' is-tinted' : ''}`}
                    style={{
                      strokeWidth: strand.width,
                      opacity: strand.opacity,
                    }}
                  />
                ))}
                <rect
                  className="sig-spine__core"
                  x={spine.x - 0.7}
                  width="1.4"
                  height={graphHeight}
                />
                {spine.knots.map((knot, knotIndex) => (
                  <g key={knotIndex}>
                    <circle
                      cx={knot.x}
                      cy={knot.y}
                      r={knot.r * 5}
                      fill={`url(#${prefix}-glow-${index})`}
                    />
                    <circle
                      cx={knot.x}
                      cy={knot.y}
                      r={knot.r}
                      className="sig-spine__knot"
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>

          {/* 선 — 평소엔 가는 색 선(양끝은 카드로 스며든다). 켜진 선은 넓은
              번짐 · 중간 번짐 · 흰빛 섞인 심 세 겹. */}
          {routes.map(
            ({ key, edge, index, lit, alpha, dim, color, weight, path }) => {
              const gradientId = `${prefix}-edge-${index}`
              return (
                <g key={key} opacity={alpha < 1 ? alpha : undefined}>
                  <g
                    className={`sig-edge is-${edge.tone}${lit ? ' is-lit' : ''}${dim ? ' is-dim' : ''}`}
                    style={{
                      ['--col' as string]: color,
                      animationDelay: `${(index % 12) * 0.04}s`,
                    }}
                  >
                    {lit ? (
                      <>
                        <path d={path.d} className="sig-edge__glow" />
                        <path d={path.d} className="sig-edge__haze" />
                      </>
                    ) : (
                      <linearGradient
                        id={gradientId}
                        gradientUnits="userSpaceOnUse"
                        x1={path.start.x}
                        y1={path.start.y}
                        x2={path.end.x}
                        y2={path.end.y}
                      >
                        <stop offset="0" className="sig-edge__stop is-end" />
                        <stop offset="0.5" className="sig-edge__stop is-mid" />
                        <stop offset="1" className="sig-edge__stop is-end" />
                      </linearGradient>
                    )}
                    <path
                      d={path.d}
                      pathLength={100}
                      className={`sig-edge__line${edge.dashed ? ' is-dashed' : ''}`}
                      stroke={lit ? undefined : `url(#${gradientId})`}
                      style={{ strokeWidth: lit ? 2.4 : 0.8 + weight * 0.4 }}
                    />
                  </g>
                </g>
              )
            },
          )}
        </g>
      </svg>

      {/* 빛 점 층 — 점은 아래 effect가 만든다(React가 그리지 않는다). 그림
          좌표 크기로 두고 화면 폭에 맞춰 통째로 줄이고 늘린다. */}
      <div
        ref={motionRef}
        className="sig-motion"
        style={{ width, height: fullHeight }}
        aria-hidden="true"
      />

      {/* 앞 — 선 위 숫자(유리 알약)와 카드. */}
      <svg
        className="sig-graph is-front"
        viewBox={viewBox}
        role="group"
        aria-label={label}
      >
        <g transform={`translate(0,${top})`}>
          {routes.map(({ key, edge, alpha, dim, path }) => {
            if (!edge.label) return null
            const pill = edge.label.length * 6.4 + 14
            return (
              <g key={key} opacity={alpha < 1 ? alpha : undefined}>
                <g
                  className={`sig-tag is-${edge.tone}${dim ? ' is-dim' : ''}`}
                  transform={`translate(${path.center.x - pill / 2},${path.center.y - 17})`}
                >
                  <rect
                    className="sig-tag__glass"
                    width={pill}
                    height="16"
                    rx="8"
                  />
                  <rect
                    className="sig-tag__shine"
                    x="5"
                    y="0.5"
                    width={pill - 10}
                    height="1"
                    rx="0.5"
                  />
                  <text
                    className="sig-tag__text"
                    x={pill / 2}
                    y="11.5"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </g>
              </g>
            )
          })}

          {/* 카드 — 진한 판, 열 색 네모 + 굵은 이름(오른쪽 값), 회색 이름 ·
              오른쪽 값 줄, 아래 열 색 막대. 고른 노드·실패는 막대 자리에
              결과 띠. */}
          {placedNodes.map(({ node, box, alpha }) => {
            const rows = node.rows ?? []
            const isFocus = node.id === focus
            const onPath = focus !== null && linked.has(node.id) && !isFocus
            const dim = focus !== null && !linked.has(node.id)
            const alarm = node.tone === 'fail'
            const lit = Boolean(node.active) || onPath || alarm
            const showResult =
              (Boolean(node.active) || alarm) &&
              Boolean(node.result) &&
              rows.length > 0
            const tagRoom = node.tag ? textWidth(node.tag, 10) + 8 : 0
            return (
              <g key={node.id} opacity={alpha < 1 ? alpha : undefined}>
                <g
                  className={`sig-node is-${node.tone}${node.active ? ' is-active' : ''}${onPath ? ' is-path' : ''}${lit ? ' is-lit' : ''}${node.onClick ? ' is-clickable' : ''}${dim ? ' is-dim' : ''}`}
                  transform={`translate(${box.x - box.w / 2},${box.y - box.h / 2})`}
                  style={{ ['--col' as string]: columnColor(box.x) }}
                  role={node.onClick ? 'button' : undefined}
                  tabIndex={node.onClick ? 0 : undefined}
                  aria-label={
                    node.onClick
                      ? `${node.label} ${rows.map((row) => `${row.label} ${row.value}`).join(', ')} — 눌러서 자세히`
                      : undefined
                  }
                  onClick={node.onClick}
                  onKeyDown={onKey(node)}
                >
                  {lit && (
                    <>
                      <rect
                        className="sig-node__aura is-wide"
                        x="-7"
                        y="-7"
                        width={box.w + 14}
                        height={box.h + 14}
                        rx="12"
                      />
                      <rect
                        className="sig-node__aura"
                        x="-2.5"
                        y="-2.5"
                        width={box.w + 5}
                        height={box.h + 5}
                        rx="8"
                      />
                    </>
                  )}
                  <rect
                    className="sig-node__box"
                    width={box.w}
                    height={box.h}
                    rx="6"
                  />
                  <rect
                    className="sig-node__square"
                    x="11"
                    y="13.5"
                    width="6"
                    height="6"
                  />
                  <text className="sig-node__label" x="23" y="20">
                    {fit(node.label, box.w - 34 - tagRoom, TITLE_PX)}
                  </text>
                  {node.tag && (
                    <text
                      className="sig-node__tag"
                      x={box.w - 11}
                      y="20"
                      textAnchor="end"
                    >
                      {node.tag}
                    </text>
                  )}
                  {rows.map((row, index) => {
                    const y = TITLE_H + 5 + index * ROW_H
                    const key = fit(row.label, (box.w - 22) * 0.5, ROW_PX)
                    const room = box.w - 22 - textWidth(key, ROW_PX) - 10
                    return (
                      <g
                        key={index}
                        className={`sig-node__row${row.tone ? ` is-${row.tone}` : ''}`}
                      >
                        <text className="sig-node__key" x="11" y={y}>
                          {key}
                        </text>
                        <text
                          className="sig-node__value"
                          x={box.w - 11}
                          y={y}
                          textAnchor="end"
                        >
                          {fit(row.value, room, ROW_PX)}
                        </text>
                      </g>
                    )
                  })}
                  {showResult ? (
                    <g className="sig-node__result">
                      <rect
                        x="5"
                        y={box.h - 19}
                        width={box.w - 10}
                        height="14"
                        rx="2.5"
                      />
                      <text x="11" y={box.h - 9}>
                        {fit(node.result ?? '', box.w - 22, 9)}
                      </text>
                    </g>
                  ) : (
                    <rect
                      className="sig-node__bar"
                      x={11 + (box.w - 22) * barOffset(node.id) * 0.75}
                      y={box.h - (rows.length > 0 ? 12 : 9)}
                      width={Math.max(16, box.w * 0.17)}
                      height="2.6"
                    />
                  )}
                </g>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
