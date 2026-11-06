import { cx } from '../../../lib/cx'
import { CompareToggle } from './compare-toggle'
import { D16_RANGE_KEYS, D16_RANGES, type RangeKey } from './design16-data'
import { RangeControl } from './range-control'
import { SalesChart } from './sales-chart'

interface SalesStudioProps {
  range: RangeKey
  onRangeChange?: (next: RangeKey) => void
  compare: boolean
  onCompareToggle?: () => void
  introDelay?: number | null
  drawKey?: number
}

/** "Sales studio" — 제목·부제(합계 · 변화 %)·비교 단추·기간 고르기·차트 */
export function SalesStudio({ range, onRangeChange, compare, onCompareToggle, introDelay, drawKey }: SalesStudioProps) {
  const data = D16_RANGES[range]
  return (
    <section className="d16-studio">
      <div className="d16-studio__head">
        <div>
          <h2 className="d16-studio__title">Sales studio</h2>
          <p className="d16-studio__sub">
            {data.total} in this range ·{' '}
            <span className={cx('d16-studio__change', !data.up && 'is-down')}>{data.change}</span> on the same stretch
            before
          </p>
        </div>
        <div className="d16-studio__controls">
          <CompareToggle label={data.compareLabel} on={compare} onToggle={onCompareToggle} />
          <RangeControl options={D16_RANGE_KEYS} value={range} onChange={onRangeChange} label="Sales range" />
        </div>
      </div>
      <SalesChart
        className="d16-studio__chart"
        range={data}
        compare={compare}
        introDelay={introDelay}
        drawKey={drawKey}
      />
    </section>
  )
}
