import { cx } from '../../../lib/cx'
import { D13_LANDS, type LandsBarSpec } from './design13-data'
import { LandsBar } from './lands-bar'

interface LandsPanelProps {
  bars?: readonly LandsBarSpec[]
  title?: string
  className?: string
}

/** "WHERE THE NUMBER LANDS" 판 — 막대 줄을 39px 간격으로 쌓는다 */
export function LandsPanel({ bars = D13_LANDS, title = 'WHERE THE NUMBER LANDS', className }: LandsPanelProps) {
  return (
    <div className={cx('d13-panel', 'd13-lands', className)}>
      <div className="d13-panel__head">
        <h3 className="d13-panel__title">{title}</h3>
      </div>
      <div className="d13-lands__bars">
        {bars.map((bar) => (
          <LandsBar key={bar.label} {...bar} />
        ))}
      </div>
    </div>
  )
}
