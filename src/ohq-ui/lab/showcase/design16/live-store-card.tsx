import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'
import { GlassPanel } from './glass-panel'
import { LiveDot } from './live-dot'
import { MiniBars } from './mini-bars'
import { StatRows } from './stat-rows'
import { StatusPill } from './status-pill'

interface LiveStoreCardProps extends HTMLAttributes<HTMLElement> {
  title: string
  sub: string
  link: string
  count: number
  countNote: string
  bars: readonly number[]
  rows: readonly { label: string; value: string }[]
  status: string
}

/** "Live store" 카드(153×135) — 숨쉬는 초록 점·큰 숫자 38(19.5px)·막대·세 줄·"Checkout healthy" */
export function LiveStoreCard({
  title,
  sub,
  link,
  count,
  countNote,
  bars,
  rows,
  status,
  className,
  ...rest
}: LiveStoreCardProps) {
  return (
    <GlassPanel as="section" className={cx('d16-live', className)} {...rest}>
      <header className="d16-card-head">
        <div>
          <h2 className="d16-card-head__title">
            <LiveDot />
            {title}
          </h2>
          <p className="d16-card-head__sub">{sub}</p>
        </div>
        <a className="d16-link d16-hov" href="#visitors" onClick={(e) => e.preventDefault()}>
          {link}
        </a>
      </header>
      <p className="d16-live__count">
        <span className="d16-live__num">{count}</span>
        <span className="d16-live__note">{countNote}</span>
      </p>
      <MiniBars className="d16-live__bars" values={bars} />
      <StatRows className="d16-live__rows" rows={rows} />
      <StatusPill tone="green">{status}</StatusPill>
    </GlassPanel>
  )
}
