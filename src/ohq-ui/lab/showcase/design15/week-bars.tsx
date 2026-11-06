import { useState } from 'react'
import { cx } from '../../../lib/cx'
import { BAR_DELAY_MS, BAR_STAGGER_MS } from './d15-motion'
import { cssVars } from './d15-format'
import type { D15BarTone } from './design15-data'

interface WeekBarsProps {
  bars: readonly { day: string; value: number; tone: D15BarTone }[]
  /** 처음 말풍선이 붙는 막대(F16부터 T 위 "74%") — 다른 막대에 올리면 그 막대로 옮긴다 */
  focus?: number
  /** 자라기 시작(ms) */
  delay?: number
  title?: string
  index?: number
}

/**
 * Project Analytics 막대 일곱(F41: 너비 26px·간격 32.4px·바닥 y243.5, 100% = 64.2px) — 알약 모양, 빗금·강조·옅은·짙은 넷.
 * 막대마다 52ms씩 늦게 easeOutQuint 0.75초로 자란다(높이 애니메이션, 막대가 절대 위치라 다른 칸은 안 움직인다).
 */
export function WeekBars({
  bars,
  focus = 2,
  delay = BAR_DELAY_MS,
  title = 'Project Analytics',
  index = 4,
}: WeekBarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const tip = hover ?? focus

  return (
    <section className="d15-card d15-bars d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">{title}</h3>
      <div className="d15-bars__plot" onPointerLeave={() => setHover(null)}>
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cx('d15-bars__col', i === tip && 'is-tip')}
            onPointerEnter={() => setHover(i)}
            style={cssVars({ '--h': bar.value / 100, '--d': `${delay + i * BAR_STAGGER_MS}ms` })}
          >
            <span className={cx('d15-bars__bar', `is-${bar.tone}`)} />
            <span className="d15-bars__tip" aria-hidden={i !== tip}>
              {bar.value}%
            </span>
            <span className="d15-bars__day">{bar.day}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
