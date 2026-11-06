import { Pencil } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'
import { GlassPanel } from './glass-panel'
import { GoalRing } from './goal-ring'
import { StatRows } from './stat-rows'

interface GoalCardProps extends HTMLAttributes<HTMLElement> {
  title: string
  sub: string
  pct: number
  of: string
  rows: readonly { label: string; value: string }[]
}

/** "November goal" 카드(153×95) — 제목·남은 날·연필, 고리와 세 줄 */
export function GoalCard({ title, sub, pct, of, rows, className, ...rest }: GoalCardProps) {
  return (
    <GlassPanel as="section" className={cx('d16-goal', className)} {...rest}>
      <header className="d16-card-head">
        <div>
          <h2 className="d16-card-head__title">{title}</h2>
          <p className="d16-card-head__sub">{sub}</p>
        </div>
        <button type="button" className="d16-goal__edit d16-hov" aria-label="Edit goal">
          <Pencil strokeWidth={1.8} aria-hidden />
        </button>
      </header>
      <div className="d16-goal__body">
        <GoalRing value={pct} label={`${Math.round(pct * 100)}%`} sub={of} />
        <StatRows className="d16-goal__rows" rows={rows} />
      </div>
    </GlassPanel>
  )
}
