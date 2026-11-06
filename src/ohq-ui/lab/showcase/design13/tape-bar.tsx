import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Frame } from './d13-clock'
import { CARET_PERIOD, CARET_PHASE, TAPE_DELAY, TAPE_TYPE, clamp01, eventIndexAt, eventStartAt } from './d13-timeline'
import { D13_EVENTS, type OrbitEvent } from './design13-data'
import { LivePill } from './live-pill'

interface TapeBarProps {
  /** 한 바퀴 글 — 사건마다 "이름  설명"을 새로 친다 */
  messages?: readonly OrbitEvent[]
  label?: string
  /** 오른쪽 LIVE 알약 */
  live?: boolean
  className?: string
}

/**
 * TAPE 줄 — 사건이 바뀔 때마다 새 글을 0.095초에 다 친다(길이와 상관없이 약 3프레임). 분홍 네모 깜빡이는 치는
 * 동안 켜져 있고, 그 밖에는 장면 시계로 0.2113초마다 깜빡인다. 첫 사건 전(F0)은 빈 줄에 깜빡이만.
 */
export function TapeBar({ messages = D13_EVENTS, label = 'TAPE', live = true, className }: TapeBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const last = useRef({ text: '\u0000', caret: true })

  const draw = useCallback(
    (t: number, still: boolean) => {
      const text = textRef.current
      const caret = caretRef.current
      if (!text || !caret || !messages.length) return
      const k = eventIndexAt(t)
      let shown = ''
      let typing = true
      if (k >= 0) {
        const ev = messages[k % messages.length]
        const line = `${ev.agent}  ${ev.tape}`
        const typed = still
          ? line.length
          : Math.floor(line.length * clamp01((t - eventStartAt(k) - TAPE_DELAY) / TAPE_TYPE))
        shown = line.slice(0, typed)
        typing = typed < line.length
      }
      const on = still || typing || (t / CARET_PERIOD - CARET_PHASE + 1) % 1 < 0.5
      if (last.current.text !== shown) {
        last.current.text = shown
        text.textContent = shown
      }
      if (last.current.caret !== on) {
        last.current.caret = on
        caret.classList.toggle('is-off', !on)
      }
    },
    [messages],
  )
  useD13Frame(rootRef, draw)

  return (
    <div ref={rootRef} className={cx('d13-tape', className)}>
      <span className="d13-tape__label">{label}</span>
      <span className="d13-tape__line">
        <span ref={textRef} className="d13-tape__text" />
        <span ref={caretRef} className="d13-tape__caret" aria-hidden />
      </span>
      {live && <LivePill className="d13-tape__live" />}
    </div>
  )
}
