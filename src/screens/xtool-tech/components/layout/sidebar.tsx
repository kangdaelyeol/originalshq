import { ChevronLeft, LogOut, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useId, type CSSProperties } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import type { XtoolMember } from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { useProfilePhoto } from '../../data/tech-profiles'
import { cx } from '@/ohq-ui/lib/cx'
import { accentVars, DEFAULT_ACCENT } from '@/ohq-ui/theme/accent'
import { useLayoutKind } from '../../lib/layout-kind'
import { navArrowKeys } from '../../lib/nav-arrow-keys'
import { useOverviewHidden } from '../../lib/overview-pref'
import { SIDEBAR_TOGGLE_KEY } from '../../lib/use-sidebar-collapsed'
import { NAV_SECTIONS } from '../../nav'
import { XT_BASE } from '../../paths'
import { BrandMark } from '@/ohq-ui/brand/brand-mark'
import { Avatar } from '@/ohq-ui/components/avatar'
import { SidebarPeopleItem } from './sidebar-people'

// 관리자 화면(구성원 등록·권한) — 팀 페이지 밖, 모든 팀이 같이 쓴다.
const ADMIN_PATH = '/admin/xtool'

// ↑·↓로 메뉴 옮겨 가기 — 메뉴와 펼친 직원 목록
const onNavKeys = navArrowKeys('.nav-item, .nav-sub__btn')
// Monday 표는 강조색이 Monday 파랑이라, 로고 판만 xTool 그린으로 둔다(브랜드 색)
const BRAND_ACCENT = accentVars(DEFAULT_ACCENT) as CSSProperties

interface SidebarProps {
  member: XtoolMember
  /** 아이콘 줄로 접었는지(넓은 화면에서만 — 좁으면 CSS가 늘 접는다) */
  collapsed: boolean
  onToggle: () => void
}

/**
 * 왼쪽 메뉴. 오른쪽 테두리에 걸린 흰 원 단추(Design 8 유리 사이드바)로 아이콘 줄 ↔ 펼침을 오간다 —
 * 폭은 셸(.shell.is-collapsed)이 바꾸고, 갈매기는 펼침 0° · 접힘 180°.
 */
export function Sidebar({ member, collapsed, onToggle }: SidebarProps) {
  const id = useId()
  const photo = useProfilePhoto(member.email)
  const { design } = useLayoutKind()
  // Monday 표에서 개요를 숨겼으면 메뉴에서 뺀다(설정 > 레이아웃)
  const overviewHidden = useOverviewHidden()
  return (
    <div className="sidebar-wrap">
      <aside id={id} className="glass sidebar" onKeyDown={onNavKeys}>
        <div className="sidebar__brand" style={design === 'monday' ? BRAND_ACCENT : undefined}>
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
              {section.items
                .filter((item) => (!item.adminOnly || member.isAdmin) && !(overviewHidden && item.to === XT_BASE))
                .map((item) => {
                if (item.people) return <SidebarPeopleItem key={item.to} item={item} collapsed={collapsed} />
                const { to, label, icon: Icon, badge } = item
                return (
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
                )
              })}
            </ul>
          </nav>
        ))}

        <div className="sidebar__footer">
          {/* 강조색 판 위 강조색 글자색 — 설정을 따라간다. */}
          <Avatar initials={initialsOf(member.name, member.email)} color="var(--accent)" ink="var(--accent-ink)" size="md" photo={photo} />
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

      <motion.button
        type="button"
        className="sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls={id}
        aria-keyshortcuts={SIDEBAR_TOGGLE_KEY}
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        title={`${collapsed ? '펼치기' : '접기'} (${SIDEBAR_TOGGLE_KEY})`}
        onClick={onToggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
      >
        <motion.span
          className="sidebar-toggle__icon"
          initial={false}
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1] }}
        >
          <ChevronLeft size={14} strokeWidth={2.6} aria-hidden />
        </motion.span>
      </motion.button>
    </div>
  )
}
