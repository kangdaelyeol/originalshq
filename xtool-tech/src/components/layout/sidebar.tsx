import { LogOut } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { CURRENT_USER } from '../../data/team'
import { cx } from '../../lib/cx'
import { NAV_SECTIONS } from '../../nav'
import { BrandMark } from '../brand/brand-mark'
import { Avatar } from '../ui/avatar'

export function Sidebar() {
  return (
    <aside className="glass sidebar">
      <div className="sidebar__brand">
        <BrandMark />
        <div className="sidebar__brand-text">
          <strong>xtool tech</strong>
          <span>TECH BOARD</span>
        </div>
      </div>

      {NAV_SECTIONS.map((section) => (
        <nav key={section.label} className="sidebar__section" aria-label={section.label}>
          <p className="sidebar__section-label">{section.label}</p>
          <ul>
            {section.items.map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  title={label}
                  className={({ isActive }) => cx('nav-item', isActive && 'is-active')}
                >
                  <Icon size={16} strokeWidth={2} className="nav-item__icon" aria-hidden />
                  <span className="nav-item__label">{label}</span>
                  {badge && <span className="nav-item__badge">{badge}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      <div className="sidebar__footer">
        <Avatar initials={CURRENT_USER.initials} color={CURRENT_USER.color} ink={CURRENT_USER.ink} size="md" />
        <div className="sidebar__user">
          <strong>{CURRENT_USER.name}</strong>
          <span>{CURRENT_USER.role}</span>
        </div>
        <Link to="/login" className="sidebar__logout" aria-label="로그아웃" title="로그아웃">
          <LogOut size={15} aria-hidden />
        </Link>
      </div>
    </aside>
  )
}
