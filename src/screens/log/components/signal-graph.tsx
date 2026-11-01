import { useEffect, useId, useRef, type KeyboardEvent } from 'react'

/** 노드·선의 상태 색 — 성공·주의·실패·실행 중·대기·탭 강조색. */
export type SignalTone = 'ok' | 'warn' | 'fail' | 'run' | 'idle' | 'accent'

export interface SignalNode {
  id: string
  /** 노드 가운데 좌표(그림 좌표). */
  x: number
  y: number
  label: string
  /** 이름 아래 작은 글씨. */
  sub?: string
  /** 오른쪽 위 꼬리표(ok·소요 시간 등). */
  tag?: string
  tone: SignalTone
  /** 노드 너비 — 기본 168. */
  width?: number
  /** 고른 노드(걸러 보는 중) — 테두리를 강조색으로. */
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
  route?: 'auto' | 'arc'
}

const NODE_W = 168
const NODE_H = 46

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

type Box = { x: number; y: number; w: number; h: number }

/** 가운데에서 상대 쪽으로 그은 선이 노드 테두리와 만나는 점. */
const anchor = (box: Box, toward: { x: number; y: number }) => {
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
const edgePath = (a: Box, b: Box, route: SignalEdge['route'] = 'auto') => {
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

/**
 * 신호 그래프 — 노드(작업·단계·탭)와 그 사이 흐름을 퍼셉트론 신경망처럼
 * 그린다. 데이터가 실제로 오가는 선(flow)에는 빛 점이 흐르고, 노드 색은 상태를
 * 뜻한다(색만으로 구분하지 않게 sub·tag에 글자도 같이 쓴다). 그림 좌표
 * (width × height) 안에 그려 화면 폭에 맞춰 늘고 준다.
 */
export const SignalGraph = ({
  width,
  height,
  nodes,
  edges,
  label,
  focus = null,
}: {
  width: number
  height: number
  nodes: SignalNode[]
  edges: SignalEdge[]
  /** 읽어 주는 이름 — "배치 파이프라인" 등. */
  label: string
  /** 고른 노드 — 그 노드와 바로 이어진 노드·선만 밝게 두고 나머지는 흐리게. */
  focus?: string | null
}) => {
  // 화면 밖에 있거나 브라우저 탭이 숨겨져 있으면 빛 점·깜빡임(CSS 애니메이션)을
  // 멈춘다 — 보지 않는 동안 매 프레임 다시 칠하지 않게.
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let onScreen = true
    const apply = () => {
      svg.classList.toggle('is-paused', !onScreen || document.hidden)
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      apply()
    })
    observer.observe(svg)
    document.addEventListener('visibilitychange', apply)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', apply)
    }
  }, [])

  // 선마다 그라데이션 id — 한 화면에 그림이 여럿이어도 겹치지 않게.
  const gradientPrefix = useId().replace(/:/g, '')
  const linked = new Set<string>(focus ? [focus] : [])
  if (focus) {
    for (const edge of edges) {
      if (edge.from === focus) linked.add(edge.to)
      if (edge.to === focus) linked.add(edge.from)
    }
  }
  const dimNode = (id: string) => focus !== null && !linked.has(id)
  const dimEdge = (edge: SignalEdge) =>
    focus !== null && edge.from !== focus && edge.to !== focus
  const boxes = new Map<string, Box>(
    nodes.map((node) => [
      node.id,
      { x: node.x, y: node.y, w: node.width ?? NODE_W, h: NODE_H },
    ]),
  )
  const onKey = (node: SignalNode) => (event: KeyboardEvent) => {
    if (node.onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      node.onClick()
    }
  }

  return (
    <svg
      ref={svgRef}
      className={`sig-graph${focus ? ' has-focus' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern
          id="sig-dots"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" className="sig-dot" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#sig-dots)" />

      {edges.map((edge, index) => {
        const a = boxes.get(edge.from)
        const b = boxes.get(edge.to)
        if (!a || !b) return null
        const { d, start, end } = edgePath(a, b, edge.route)
        const weight = Math.max(1, Math.min(4, edge.weight ?? 1))
        const gradientId = `${gradientPrefix}-edge-${index}`
        const duration = `${2.6 + (index % 4) * 0.35}s`
        const delay = `-${(index * 0.41) % 2.6}s`
        return (
          <g
            key={`${edge.from}>${edge.to}`}
            className={`sig-edge is-${edge.tone}${dimEdge(edge) ? ' is-dim' : ''}`}
            style={{ animationDelay: `${(index % 12) * 0.04}s` }}
          >
            {/* 출발 → 도착 방향의 그라데이션 — 양끝은 옅고 가운데가 진하다
                (퍼셉트론 선처럼 노드 가까이에서 스며든다). 색은 이 g의
                --tone을 물려받는다. */}
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            >
              <stop offset="0" className="sig-edge__stop is-end" />
              <stop offset="0.5" className="sig-edge__stop is-mid" />
              <stop offset="1" className="sig-edge__stop is-end" />
            </linearGradient>
            {/* 넓고 옅은 빛 번짐 — 흐림 필터 없이 굵은 반투명 선으로. */}
            <path
              d={d}
              className="sig-edge__glow"
              stroke={`url(#${gradientId})`}
              style={{ strokeWidth: 4 + weight * 2.4 }}
            />
            <path
              d={d}
              pathLength={100}
              className={`sig-edge__line${edge.dashed ? ' is-dashed' : ''}`}
              stroke={`url(#${gradientId})`}
              style={{ strokeWidth: 0.9 + weight * 0.55 }}
            />
            {/* 빛 점 — 혜성처럼 꼬리(길고 옅은 꼬리 + 짧고 밝은 꼬리)를 달고
                흐른다. 꼬리 끝이 늘 점에 닿도록 셋의 시작 위치를 맞췄다. 모두 CSS
                stroke-dashoffset(SVG animateMotion은 매 프레임 레이아웃을 다시
                계산해 무겁다). pathLength 100이라 선 길이와 상관없이 둘씩. */}
            {edge.flow &&
              (
                [
                  ['sig-flow__trail', 1.2],
                  ['sig-flow__tail', 1.5],
                  ['sig-flow__halo', 5],
                  ['sig-flow', 2],
                ] as const
              ).map(([className, scale]) => (
                <path
                  key={className}
                  d={d}
                  pathLength={100}
                  className={className}
                  style={{
                    strokeWidth: (1.8 + weight * 0.35) * scale,
                    animationDuration: duration,
                    animationDelay: delay,
                  }}
                />
              ))}
          </g>
        )
      })}

      {/* 선 위 숫자 — 모든 선을 그린 뒤에 얹어야 다른 선에 가리지 않는다.
          유리 알약(반투명 판 + 위쪽 빛 선) 위에 글자. */}
      {edges.map((edge) => {
        const a = boxes.get(edge.from)
        const b = boxes.get(edge.to)
        if (!edge.label || !a || !b) return null
        const { center } = edgePath(a, b, edge.route)
        const width = edge.label.length * 6.4 + 14
        return (
          <g
            key={`label:${edge.from}>${edge.to}`}
            className={`sig-tag is-${edge.tone}${dimEdge(edge) ? ' is-dim' : ''}`}
            transform={`translate(${center.x - width / 2},${center.y - 17})`}
          >
            <rect className="sig-tag__glass" width={width} height="16" rx="8" />
            <rect
              className="sig-tag__shine"
              x="5"
              y="0.5"
              width={width - 10}
              height="1"
              rx="0.5"
            />
            <text
              className="sig-tag__text"
              x={width / 2}
              y="11.5"
              textAnchor="middle"
            >
              {edge.label}
            </text>
          </g>
        )
      })}

      {nodes.map((node) => {
        const box = boxes.get(node.id)!
        const left = box.x - box.w / 2
        const top = box.y - box.h / 2
        // 오른쪽 꼬리표 자리만큼 이름을 더 줄인다.
        const tagRoom = node.tag ? node.tag.length * 6.5 + 8 : 0
        const chars = Math.floor((box.w - 30 - tagRoom) / 7)
        return (
          <g
            key={node.id}
            className={`sig-node is-${node.tone}${node.active ? ' is-active' : ''}${node.onClick ? ' is-clickable' : ''}${dimNode(node.id) ? ' is-dim' : ''}`}
            transform={`translate(${left},${top})`}
            role={node.onClick ? 'button' : undefined}
            tabIndex={node.onClick ? 0 : undefined}
            aria-label={
              node.onClick
                ? `${node.label} ${node.sub ?? ''} — 눌러서 걸러 보기`
                : undefined
            }
            onClick={node.onClick}
            onKeyDown={onKey(node)}
          >
            <rect
              className="sig-node__box"
              width={box.w}
              height={box.h}
              rx="3"
            />
            {node.active && (
              <rect
                className="sig-node__ring"
                x="-5"
                y="-5"
                width={box.w + 10}
                height={box.h + 10}
                rx="6"
              />
            )}
            <rect className="sig-node__bar" width={box.w} height="2" rx="1" />
            <circle
              className="sig-node__lamp"
              cx="13"
              cy={node.sub ? box.h / 2 - 6 : box.h / 2}
              r="3.2"
            />
            <text
              className="sig-node__label"
              x="23"
              y={node.sub ? box.h / 2 - 2 : box.h / 2 + 4}
            >
              {clip(node.label, chars)}
            </text>
            {node.sub && (
              <text className="sig-node__sub" x="23" y={box.h / 2 + 12}>
                {clip(node.sub, Math.floor((box.w - 30) / 6))}
              </text>
            )}
            {node.tag && (
              <text
                className="sig-node__tag"
                x={box.w - 8}
                y={node.sub ? box.h / 2 - 2 : box.h / 2 + 4}
                textAnchor="end"
              >
                {node.tag}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
