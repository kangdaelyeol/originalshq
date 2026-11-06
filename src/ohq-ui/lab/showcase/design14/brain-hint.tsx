import { cx } from '../../../lib/cx'
import { STATUS_ORDER, STATUS_TEXT } from './design14-data'

interface BrainHintProps {
  /** 상태 범례(점 색) 보이기 — 영상은 "… still in your head"로 범례 끝만 보인다 */
  legend?: boolean
  className?: string
}

/** 아래 안내 줄 — "… still in your head · ← → walk the departments · click a seat to see what it does" (F200 y=1222) */
export function BrainHint({ legend = true, className }: BrainHintProps) {
  return (
    <p className={cx('d14-hint', className)}>
      {legend &&
        STATUS_ORDER.map((s) => (
          <span key={s} className="d14-hint__item" data-status={s}>
            <i aria-hidden="true" />
            {STATUS_TEXT[s]}
            <span className="d14-hint__sep" aria-hidden="true">
              {' · '}
            </span>
          </span>
        ))}
      <span className="d14-hint__item">
        <span aria-hidden="true">← → </span>walk the departments
        <span className="d14-hint__sep" aria-hidden="true">
          {' · '}
        </span>
      </span>
      <span className="d14-hint__item">click a seat to see what it does</span>
    </p>
  )
}
