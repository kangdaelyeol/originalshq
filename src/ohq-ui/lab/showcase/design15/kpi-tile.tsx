import { ArrowDown, ArrowUp } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { CountUp } from './count-up'
import { cssVars } from './d15-format'
import type { D15Kpi } from './design15-data'
import { Sparkline } from './sparkline'

interface KpiTileProps {
  kpi: D15Kpi
  /** "vs previous 90d"의 기간 글 */
  range: string
  spark: readonly number[]
  index?: number
}

/**
 * KPI 칸(F600 113×62px) — 이름·큰 숫자(기간을 바꾸면 보이던 값에서 새 값으로 오른다, F598~F680)·전 기간 대비·꼬마 그래프.
 * 주기 시간은 줄어드는 게 좋은 값이라 ↓가 강조색.
 */
export function KpiTile({ kpi, range, spark, index = 0 }: KpiTileProps) {
  return (
    <article className="d15-card d15-kpi d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-kpi__label">{kpi.label}</h3>
      <CountUp className="d15-kpi__value" value={kpi.value} format={kpi.format} />
      <p className={cx('d15-kpi__delta', kpi.up ? 'is-up' : 'is-down')}>
        {kpi.up ? <ArrowUp aria-hidden strokeWidth={2.4} /> : <ArrowDown aria-hidden strokeWidth={2.4} />}
        <b>{kpi.delta.toFixed(1)}%</b> vs previous {range.toLowerCase()}
      </p>
      <Sparkline points={spark} />
    </article>
  )
}
