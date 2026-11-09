import { cx } from '../../../lib/cx'
import type { SeatStatus } from './brain-map'
import { STATUS_ORDER, STATUS_TEXT } from './design14-data'

interface BrainHintProps {
  /** 상태 범례(점 색) 보이기 — 영상은 "… still in your head"로 범례 끝만 보인다 */
  legend?: boolean
  /** 범례 글·순서 — 기본은 영상 글 */
  statusText?: Record<SeatStatus, string>
  statusOrder?: readonly SeatStatus[]
  /** 범례 옆 수(주면 보인다) */
  counts?: Partial<Record<SeatStatus, number>>
  /** 범례 뒤 두 마디 */
  walk?: string
  click?: string
  className?: string
}

/** 아래 안내 줄 — "… still in your head · ← → walk the departments · click a seat to see what it does" (F200 y=1222) */
export function BrainHint({
  legend = true,
  statusText = STATUS_TEXT,
  statusOrder = STATUS_ORDER,
  counts,
  walk = 'walk the departments',
  click = 'click a seat to see what it does',
  className,
}: BrainHintProps) {
  return (
    <p className={cx('d14-hint', className)}>
      {legend &&
        statusOrder.map((s) => (
          <span key={s} className="d14-hint__item" data-status={s}>
            <i aria-hidden="true" />
            {statusText[s]}
            {counts?.[s] !== undefined && <b className="d14-hint__count">{counts[s]}</b>}
            <span className="d14-hint__sep" aria-hidden="true">
              {' · '}
            </span>
          </span>
        ))}
      <span className="d14-hint__item">
        <span aria-hidden="true">← → </span>
        {walk}
        <span className="d14-hint__sep" aria-hidden="true">
          {' · '}
        </span>
      </span>
      <span className="d14-hint__item">{click}</span>
    </p>
  )
}
