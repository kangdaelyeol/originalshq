import type { LucideIcon } from 'lucide-react'
import { cx } from '../../../lib/cx'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  /** 오른쪽 위 파란 숫자 동그라미 */
  badge?: number
  className?: string
  onClick?: () => void
}

/** 유리 동그라미 단추(지름 18.7px) — 뒤 공 색이 흐리게 비친다(F30 검색 단추 68,39,23 = 주황 공 위) */
export function IconButton({ icon: Icon, label, badge, className, onClick }: IconButtonProps) {
  return (
    <button type="button" className={cx('d16-icon-btn', 'd16-hov', className)} aria-label={label} onClick={onClick}>
      <Icon className="d16-icon-btn__icon" strokeWidth={2} aria-hidden />
      {badge !== undefined && <span className="d16-icon-btn__badge">{badge}</span>}
    </button>
  )
}
