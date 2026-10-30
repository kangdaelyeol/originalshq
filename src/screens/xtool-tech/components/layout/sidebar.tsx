import { LogOut, ShieldCheck } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import type { XtoolMember } from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { cx } from '../../lib/cx'
import { NAV_SECTIONS } from '../../nav'
import { XT_BASE } from '../../paths'
import { BrandMark } from '../brand/brand-mark'
import { Avatar } from '../ui/avatar'

// 관리자 화면(구성원 등록·권한) — 팀 페이지 밖, 모든 팀이 같이 쓴다.
const ADMIN_PATH = '/admin/xtool'

export function Sidebar({ member }: { member: XtoolMember }) {
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
                  end={to === XT_BASE}
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
        {/* 강조색 판 위 강조색 글자색 — 설정을 따라간다. */}
        <Avatar initials={initialsOf(member.name, member.email)} color="var(--accent)" ink="var(--accent-ink)" size="md" />
        <div className="sidebar__user" title={member.email}>
          <strong>{member.name || member.email}</strong>
          <span>{member.isAdmin ? '관리자' : member.email}</span>
        </div>
        {member.isAdmin && (
          <Link to={ADMIN_PATH} className="sidebar__logout" aria-label="구성원 관리" title="구성원 관리">
            <ShieldCheck size={15} aria-hidden />
          </Link>
        )}
        {/* 로그아웃하면 화면 잠금(AppLayout)이 로그인 화면으로 보낸다. */}
        <button type="button" className="sidebar__logout" onClick={() => void signOutXtool()} aria-label="로그아웃" title="로그아웃">
          <LogOut size={15} aria-hidden />
        </button>
      </div>
    </aside>
  )
}
