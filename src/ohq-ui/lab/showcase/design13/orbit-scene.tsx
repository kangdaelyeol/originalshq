import { useEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { AgentCard } from './agent-card'
import { ChipNode } from './chip-node'
import { useD13Clock } from './d13-clock'
import { D13_AGENTS, D13_EVENTS, type OrbitAgent, type OrbitEvent } from './design13-data'
import { OrbitBackdrop } from './orbit-backdrop'
import { OrbitEngine } from './orbit-engine'
import { OrbitTag } from './orbit-tag'
import { VerdictBadge } from './verdict-badge'

interface OrbitSceneProps {
  /** 궤도 위 카드(차례대로 360°/n씩) */
  agents?: readonly OrbitAgent[]
  /** 사건 차례(한 바퀴) — 0.2975초마다 하나 */
  events?: readonly OrbitEvent[]
  chipLabel?: string
  /** 궤도 입자 수 */
  particles?: number
  className?: string
}

/**
 * 궤도 장면 — 별·빛 띠(SVG, 가만히) 위 캔버스(점선 타원·입자·선)와 DOM(칩·카드·이름표·판정표).
 * 그림은 시계(useD13Clock)의 t로만 정해진다 — 엔진이 매 프레임 캔버스를 칠하고 DOM transform을 고친다.
 */
export function OrbitScene({
  agents = D13_AGENTS,
  events = D13_EVENTS,
  chipLabel = 'JEV',
  particles = 130,
  className,
}: OrbitSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const clock = useD13Clock()

  useEffect(() => {
    const root = rootRef.current
    const canvas = root?.querySelector('canvas')
    if (!root || !canvas) return
    const badge = root.querySelector<HTMLElement>('[data-d13-badge]')
    const engine = new OrbitEngine(
      {
        canvas,
        cards: Array.from(root.querySelectorAll<HTMLElement>('[data-d13-card]')),
        tags: agents.map((_, i) => root.querySelector<HTMLElement>(`[data-d13-tag="${i}"]`)),
        badge,
        badgeText: badge?.querySelector<HTMLElement>('[data-d13-badge-text]') ?? null,
        serial: root.querySelector<HTMLElement>('[data-d13-serial]'),
      },
      { agents, events, particles, serialFrom: 1 },
    )
    const unsubscribe = clock.subscribe(root, (t, still) => engine.draw(t, still))
    const resize = new ResizeObserver(() => {
      engine.resize()
      clock.redraw(root)
    })
    resize.observe(canvas)
    return () => {
      unsubscribe()
      resize.disconnect()
    }
  }, [clock, agents, events, particles])

  const first = events[0]
  return (
    <div ref={rootRef} className={cx('d13-orbit', className)}>
      <OrbitBackdrop />
      <canvas className="d13-orbit__canvas" aria-hidden />
      <ChipNode label={chipLabel} className="d13-orbit__chip" />
      {agents.map((agent) => (
        <AgentCard key={agent.id} name={agent.name} sub={agent.sub} data-d13-card="" />
      ))}
      {agents.map((agent, i) => (agent.tag ? <OrbitTag key={agent.id} text={agent.tag} data-d13-tag={i} /> : null))}
      {first && <VerdictBadge p={first.p} word={first.word} data-d13-badge="" />}
    </div>
  )
}
