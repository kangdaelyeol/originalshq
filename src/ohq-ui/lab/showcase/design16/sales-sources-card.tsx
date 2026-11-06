import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'
import type { SourceData } from './design16-data'
import { GlassPanel } from './glass-panel'
import { ShareBar } from './share-bar'

interface SalesSourcesCardProps extends HTMLAttributes<HTMLElement> {
  sub: string
  sources: readonly SourceData[]
}

/** "Where sales came from" 카드 — 쌓은 막대와 줄(네모 점·이름·%·금액, 17px 간격) */
export function SalesSourcesCard({ sub, sources, className, ...rest }: SalesSourcesCardProps) {
  return (
    <GlassPanel as="section" className={cx('d16-sources', className)} {...rest}>
      <header className="d16-card-head">
        <div>
          <h2 className="d16-card-head__title">Where sales came from</h2>
          <p className="d16-card-head__sub">{sub}</p>
        </div>
      </header>
      <ShareBar className="d16-sources__bar" parts={sources} />
      <ul className="d16-sources__list">
        {sources.map((s) => (
          <li key={s.label} className="d16-sources__row" data-enter-row>
            <span className={`d16-sources__swatch d16-tone--${s.tone}`} aria-hidden />
            <span className="d16-sources__label">{s.label}</span>
            <span className="d16-sources__pct">{s.pct}%</span>
            <span className="d16-sources__value">{s.value}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  )
}
