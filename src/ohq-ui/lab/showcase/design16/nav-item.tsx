import type { LucideIcon } from 'lucide-react'
import { cx } from '../../../lib/cx'

interface NavItemProps {
  icon: LucideIcon
  label: string
  badge?: number
  active?: boolean
  /** 고른 표시는 목록이 따로 그린다 — 혼자 쓸 때 바탕까지 칠하려면 true */
  filled?: boolean
  onClick?: () => void
  /** 표시 엔진이 자리를 찾는 이름 */
  navKey?: string
}

/** 사이드바 한 줄 — 아이콘 7px · 글자 6.3px(Urbanist 500) · 오른쪽 숫자 알약. 올리면 흰 막 4%가 바로 든다(F65→F66). */
export function NavItem({ icon: Icon, label, badge, active, filled, onClick, navKey }: NavItemProps) {
  return (
    <button
      type="button"
      className={cx('d16-nav-item', 'd16-hov', active && 'is-active', filled && 'is-filled')}
      aria-current={active ? 'page' : undefined}
      data-nav={navKey}
      onClick={onClick}
    >
      <Icon className="d16-nav-item__icon" strokeWidth={1.8} aria-hidden />
      <span className="d16-nav-item__label">{label}</span>
      {badge !== undefined && <span className="d16-nav-item__badge">{badge}</span>}
    </button>
  )
}
