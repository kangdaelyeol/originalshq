import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { useD13Frame } from './d13-clock'
import { landsAt } from './d13-timeline'
import type { LandsBarSpec } from './design13-data'

interface LandsBarProps extends LandsBarSpec {
  className?: string
}

const TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * 막대 한 줄 — 이름·백분율, 어두운 홈(312 × 9px, 끝 둥근) 위 그라데이션 채우기, 아래 10% 눈금 아홉 개.
 * 채우기는 장면을 열면 0.42초에 차오르고(easeOutCubic, 위 줄부터 0.06초씩 늦게) 그 뒤 0.833초 주기로 출렁인다.
 * 채우기 위로 옅은 사선 "//" 빛이 흘러간다(CSS).
 */
export function LandsBar({ label, value, wobble, phase, delay, tone, className }: LandsBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const last = useRef({ w: -1, pct: '' })

  const draw = useCallback(
    (t: number) => {
      const fill = fillRef.current
      const pct = pctRef.current
      if (!fill || !pct) return
      const v = landsAt(t, { value, wobble, phase, delay })
      const w = Math.round(v * 10000) / 100
      if (last.current.w !== w) {
        last.current.w = w
        fill.style.width = `${w}%`
      }
      const text = `${Math.round(v * 100)}%`
      if (last.current.pct !== text) {
        last.current.pct = text
        pct.textContent = text
      }
    },
    [value, wobble, phase, delay],
  )
  useD13Frame(rootRef, draw)

  return (
    <div ref={rootRef} className={cx('d13-bar', `d13-bar--${tone}`, className)}>
      <span className="d13-bar__label">{label}</span>
      <span ref={pctRef} className="d13-bar__pct">
        0%
      </span>
      <span className="d13-bar__track">
        <span ref={fillRef} className="d13-bar__fill">
          <span className="d13-bar__shine" aria-hidden />
        </span>
      </span>
      <span className="d13-bar__ticks" aria-hidden>
        {TICKS.map((i) => (
          <i key={i} style={{ left: `${i * 10}%` }} />
        ))}
      </span>
    </div>
  )
}
