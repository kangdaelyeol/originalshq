import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Frame } from './d13-clock'
import { countAt, eventIndexAt, eventStartAt, flashAt, formatInt, riseAt } from './d13-timeline'
import { D13_EVENTS, type OrbitEvent, type StatSpec } from './design13-data'
import { Sparkline } from './sparkline'

interface StatCardProps extends StatSpec {
  /** 번쩍일 때를 알려 줄 사건 차례 */
  events?: readonly OrbitEvent[]
  className?: string
}

/**
 * 숫자 칸 — 위 색 띠, 작은 이름, 오른쪽 위 꼬마 선, 큰 고정폭 숫자, 아래 설명. 숫자는 시계로 오르거나(오르기·출렁임)
 * 그대로. 이 칸의 손님 카드에 선이 닿는 순간(사건 시작 + 0.117초) 칸 바탕·테두리가 분홍으로 0.17초 번쩍인다.
 */
export function StatCard({
  label,
  sub,
  tone,
  value,
  agent,
  sparkNode,
  sparkPhase,
  events = D13_EVENTS,
  className,
}: StatCardProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const last = useRef({ num: '', flash: -1 })

  const draw = useCallback(
    (t: number, still: boolean) => {
      const root = rootRef.current
      const num = numRef.current
      if (!root || !num) return
      let text = ''
      if (value.kind === 'count') text = formatInt(countAt(t, value.from, value.to, value.duration))
      else if (value.kind === 'rise') text = formatInt(riseAt(t, value))
      else text = value.text
      if (last.current.num !== text) {
        last.current.num = text
        num.textContent = text
      }
      let flash = 0
      const k = eventIndexAt(t)
      if (agent && !still && k >= 0 && events.length && events[k % events.length].agent === agent) {
        flash = Math.round(flashAt(t - eventStartAt(k)) * 100) / 100
      }
      if (last.current.flash !== flash) {
        last.current.flash = flash
        root.style.setProperty('--d13-flash', String(flash))
      }
    },
    [value, agent, events],
  )
  useD13Frame(rootRef, draw)

  const suffix = value.kind === 'static' ? undefined : value.suffix
  return (
    <div ref={rootRef} className={cx('d13-stat', `d13-stat--${tone}`, className)}>
      <span className="d13-stat__label">{label}</span>
      <Sparkline node={sparkNode} phase={sparkPhase} className="d13-stat__spark" />
      <span className="d13-stat__value">
        <span ref={numRef}>{value.kind === 'static' ? value.text : formatInt(value.from)}</span>
        {suffix === '★' ? <span className="d13-stat__star"> ★</span> : suffix}
      </span>
      <span className="d13-stat__sub">{sub}</span>
    </div>
  )
}
