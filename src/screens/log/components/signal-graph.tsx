import { useEffect, useId, useRef, type KeyboardEvent } from 'react'

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
// SVG 세 장을 포갠다 — 뒤(격자·기둥·선: 한 번 그리면 끝), 움직임(빛 점·빛 공:
// 따로 합성되는 층이라 움직여도 이 층만 다시 칠한다), 앞(숫자·카드). 빛나는
// 것은 흐림 필터 없이 반투명 겹으로, 움직임은 CSS(stroke-dashoffset·opacity)로만.

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
  // 화면 밖에 있거나 브라우저 탭이 숨겨져 있으면 움직임(CSS 애니메이션)을
  // 멈춘다 — 보지 않는 동안 매 프레임 다시 칠하지 않게.
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let onScreen = true
    const apply = () => {
      stage.classList.toggle('is-paused', !onScreen || document.hidden)
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
  const boxes = new Map<string, Box>(
    nodes.map((node) => [
      node.id,
      {
        x: node.x,
        y: node.y,
        w: node.width ?? NODE_W,
        h: node.height ?? cardHeight(node.rows?.length ?? 0),
      },
    ]),
  )
  const top = columns.length > 0 ? HEAD_H : 0
  const fullHeight = height + top
  const viewBox = `0 0 ${width} ${fullHeight}`
  /** x가 들어가는 열의 색 — 없으면 탭 강조색. */
  const columnColor = (x: number) =>
    columns.find((column) => Math.abs(column.x - x) <= column.width / 2)
      ?.color ?? 'var(--log-accent)'

  // 선마다 길 — 고른 노드에 닿은 선은 켜져 기둥을 따라 꺾어 간다.
  const routes = edges.flatMap((edge, index) => {
    const a = boxes.get(edge.from)
    const b = boxes.get(edge.to)
    if (!a || !b) return []
    const lit = focus !== null && (edge.from === focus || edge.to === focus)
    const bent = lit && edge.route !== 'arc' ? litPath(a, b, spines) : null
    return [
      {
        edge,
        index,
        lit,
        dim: focus !== null && !lit,
        // 평소 선의 색 — 출발 노드가 있는 열의 색(영상의 분홍·보라·노랑 선).
        color: columnColor(a.x),
        weight: Math.max(1, Math.min(4, edge.weight ?? 1)),
        path: bent?.route ?? edgePath(a, b, edge.route, edge.turnX),
        spine: bent?.spine ?? null,
      },
    ]
  })
  const linked = new Set<string>(focus ? [focus] : [])
  const litSpines = new Set<number>()
  for (const route of routes) {
    if (!route.lit) continue
    linked.add(route.edge.from)
    linked.add(route.edge.to)
    if (route.spine !== null) litSpines.add(route.spine)
  }

  // 바닥 먼지 — 늘 같은 자리.
  const floorRandom = seeded(width * 7 + height)
  const dust = Array.from(
    { length: Math.round((width * height) / 5200) },
    () => ({
      x: floorRandom() * width,
      y: floorRandom() * height,
      r: floorRandom() < 0.85 ? 0.6 : 1.1,
      opacity: 0.06 + floorRandom() * 0.24,
    }),
  )

  // 기둥 — 섬유 가닥, 카드로 뻗는 가지, 매듭, 흐르는 빛 점(기둥마다 늘 같게).
  const spineParts = spines.map((x) => {
    const random = seeded(Math.round(x * 13) + height)
    // 몇 가닥은 왼쪽 열의 색으로(영상의 분홍·청록이 섞인 섬유).
    const tint =
      [...columns].reverse().find((column) => column.x < x)?.color ??
      'var(--log-accent)'
    const strands = Array.from({ length: 14 }, (_, index) => ({
      d: strandPath(x + (random() - 0.5) * 16, 4, height - 4, random),
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
    for (const node of nodes) {
      const box = boxes.get(node.id)!
      const left = box.x - box.w / 2
      const right = box.x + box.w / 2
      const edgeX =
        left > x && left - x < 120
          ? left
          : right < x && x - right < 120
            ? right
            : null
      if (edgeX === null) continue
      for (let i = 0; i < 3; i++) {
        const sy = box.y + (random() - 0.5) * box.h * 1.8
        const ey = box.y + (random() - 0.5) * box.h * 0.7
        const sx = x + (random() - 0.5) * 10
        const bend = 0.3 + random() * 0.4
        wisps.push(
          `M${f(sx)},${f(sy)} C${f(sx)},${f(sy + (ey - sy) * 0.8)} ${f(edgeX + (sx - edgeX) * bend)},${f(ey)} ${f(edgeX)},${f(ey)}`,
        )
        if (i === 0) knots.push({ x: edgeX, y: ey, r: 0.9 })
      }
    }
    for (let i = 0; i < Math.max(3, Math.round(height / 55)); i++) {
      knots.push({
        x: x + (random() - 0.5) * 18,
        y: 8 + random() * (height - 16),
        r: 0.8 + random() * 1.3,
      })
    }
    return { x, tint, strands, wisp: wisps.join(' '), knots }
  })

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
              height={height}
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
                  height={height}
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
                  height={height}
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
          {routes.map(({ edge, index, lit, dim, color, weight, path }) => {
            const gradientId = `${prefix}-edge-${index}`
            return (
              <g
                key={`${edge.from}>${edge.to}`}
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
            )
          })}
        </g>
      </svg>

      {/* 움직임 — 섬유를 따라 흐르는 빛 점, 선 위의 빛 점·빛 공. 이 층만 따로
          합성되어 움직여도 뒤 층(기둥·선)을 다시 칠하지 않는다. */}
      <svg className="sig-graph is-motion" viewBox={viewBox} aria-hidden="true">
        <g transform={`translate(0,${top})`}>
          {spineParts.map((spine) => (
            <g
              key={spine.x}
              className={`sig-spine${litSpines.has(spine.x) ? ' is-lit' : ''}`}
            >
              {spine.strands
                .filter((strand) => strand.spark)
                .map((strand, index) => (
                  <g
                    key={index}
                    className="sig-spark"
                    style={{
                      animationDuration: `${strand.duration}s`,
                      animationDelay: `-${strand.delay}s`,
                      animationDirection: strand.reverse ? 'reverse' : 'normal',
                    }}
                  >
                    <path
                      d={strand.d}
                      pathLength={100}
                      className="sig-spark__halo"
                    />
                    <path
                      d={strand.d}
                      pathLength={100}
                      className="sig-spark__dot"
                    />
                  </g>
                ))}
            </g>
          ))}
          {routes
            .filter(({ edge, lit }) => edge.flow || lit)
            .map(({ edge, index, lit, dim, color, path }) => (
              <g
                key={`${edge.from}>${edge.to}`}
                className={`sig-pulse is-${edge.tone}${lit ? ' is-lit' : ''}${dim ? ' is-dim' : ''}`}
                style={{ ['--col' as string]: color }}
              >
                <g
                  className="sig-pulse__run"
                  style={{
                    animationDuration: lit
                      ? '2.4s'
                      : `${3.4 + (index % 5) * 0.45}s`,
                    animationDelay: `-${(index * 0.67) % 3.4}s`,
                  }}
                >
                  {lit && (
                    <path
                      d={path.d}
                      pathLength={100}
                      className="sig-pulse__bloom"
                    />
                  )}
                  <path
                    d={path.d}
                    pathLength={100}
                    className="sig-pulse__halo"
                  />
                  <path
                    d={path.d}
                    pathLength={100}
                    className="sig-pulse__dot"
                  />
                </g>
              </g>
            ))}
        </g>
      </svg>

      {/* 앞 — 선 위 숫자(유리 알약)와 카드. */}
      <svg
        className="sig-graph is-front"
        viewBox={viewBox}
        role="group"
        aria-label={label}
      >
        <g transform={`translate(0,${top})`}>
          {routes.map(({ edge, dim, path }) => {
            if (!edge.label) return null
            const pill = edge.label.length * 6.4 + 14
            return (
              <g
                key={`${edge.from}>${edge.to}`}
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
            )
          })}

          {/* 카드 — 진한 판, 열 색 네모 + 굵은 이름(오른쪽 값), 회색 이름 ·
              오른쪽 값 줄, 아래 열 색 막대. 고른 노드·실패는 막대 자리에
              결과 띠. */}
          {nodes.map((node) => {
            const box = boxes.get(node.id)!
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
              <g
                key={node.id}
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
            )
          })}
        </g>
      </svg>
    </div>
  )
}
