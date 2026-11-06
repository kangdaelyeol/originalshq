import { useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { CountUp } from './count-up'
import { cssVars } from './d15-format'
import { COUNT_DELAY_MS, easeInOutCubic, GAUGE_MS, prefersReducedMotion, tween } from './d15-motion'

interface TimeDonutProps {
  items: readonly { name: string; tone: string; hours: number }[]
  /** 가운데 아래 줄("tracked · 90d") */
  caption: string
  title?: string
  index?: number
}

// 고리(F600): 가운데 (570.5,222.5)·바깥 반지름 37.5px·굵기 11px → 가운데 선 반지름 32. 조각 사이 흰 틈 1.4%.
const R = 32
const C = 2 * Math.PI * R
const GAP = 1.4

/**
 * Time by project 고리 — 열릴 때 회색 고리 위로 조각들이 12시부터 시계 방향으로 차오른다(F578 "0h" → F594).
 * 기간을 바꾸면 조각 각도가 지금 자리에서 새 자리로 옮겨 가고, 가운데 합계·목록 숫자도 함께 오른다.
 */
export function TimeDonut({ items, caption, title = 'Time by project', index = 5 }: TimeDonutProps) {
  const segs = useRef<(SVGCircleElement | null)[]>([])
  const shown = useRef<{ p: number; spans: number[] } | null>(null)
  const total = items.reduce((s, it) => s + it.hours, 0)
  const key = items.map((it) => it.hours).join(',')

  useLayoutEffect(() => {
    const spans = items.map((it) => (total ? (it.hours / total) * 100 : 0))
    const draw = (p: number, sp: number[]) => {
      let start = 0
      sp.forEach((len, k) => {
        const el = segs.current[k]
        const vis = Math.max(0, Math.min(len - GAP, p * 100 - start))
        if (el) {
          el.setAttribute('stroke-dasharray', `${(vis / 100) * C} ${C}`)
          el.setAttribute('stroke-dashoffset', `${(-start / 100) * C}`)
        }
        start += len
      })
    }
    const from = shown.current
    if (prefersReducedMotion()) {
      draw(1, spans)
      shown.current = { p: 1, spans }
      return
    }
    if (!from) {
      draw(0, spans)
      let begun = false
      const stop = tween(
        GAUGE_MS + 100,
        (u) => {
          begun = true
          draw(easeInOutCubic(u), spans)
        },
        COUNT_DELAY_MS + 80,
      )
      shown.current = { p: 1, spans }
      return () => {
        stop()
        if (!begun) shown.current = null
      }
    }
    const now = [...from.spans]
    shown.current = { p: 1, spans: now }
    return tween(GAUGE_MS, (u) => {
      const e = easeInOutCubic(u)
      spans.forEach((to, k) => {
        now[k] = from.spans[k] + (to - from.spans[k]) * e
      })
      draw(1, now)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <section className="d15-card d15-donut d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">{title}</h3>
      <div className="d15-donut__ring">
        <svg viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r={R} className="d15-donut__track" />
          {items.map((it, k) => (
            <circle
              key={it.name}
              ref={(el) => {
                segs.current[k] = el
              }}
              cx="40"
              cy="40"
              r={R}
              className={cx('d15-donut__seg', `is-${it.tone}`)}
              strokeDasharray={`0 ${C}`}
            />
          ))}
        </svg>
        <p className="d15-donut__total">
          <CountUp value={total} format="hours" />
          <small>{caption}</small>
        </p>
      </div>
      <ul className="d15-donut__legend">
        {items.map((it) => (
          <li key={it.name}>
            <i className={`is-${it.tone}`} />
            <span>{it.name}</span>
            <CountUp className="d15-donut__hours" value={it.hours} format="hours" />
          </li>
        ))}
      </ul>
    </section>
  )
}
