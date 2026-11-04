import { ArrowUpRight, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { signOutXtool } from '@/xtool-auth/auth-actions'
import type { XtoolMember } from '@/xtool-auth/members'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import { BrandMark } from '@/ohq-ui/brand/brand-mark'
import { Avatar } from '@/ohq-ui/components/avatar'
import { useProfilePhoto } from '@/screens/xtool-tech/data/tech-profiles'
import { XT_BASE } from '@/screens/xtool-tech/paths'

export function AdminHeader({ member }: { member: XtoolMember }) {
  const photo = useProfilePhoto(member.email)
  return (
    <header className="glass admin-header">
      <div className="admin-header__brand">
        <BrandMark />
        <div className="admin-header__brand-text">
          <strong>xtool admin</strong>
          <span>구성원 · 권한</span>
        </div>
      </div>
      <nav className="admin-header__nav" aria-label="팀 페이지">
        <Link to={XT_BASE} className="admin-header__link">
          기술팀 보드
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </nav>
      <div className="admin-header__user" title={member.email}>
        <Avatar initials={initialsOf(member.name, member.email)} color="var(--accent)" ink="var(--accent-ink)" photo={photo} />
        <div className="admin-header__who">
          <strong>{member.name || member.email}</strong>
          <span>{member.email}</span>
        </div>
        <button
          type="button"
          className="admin-header__logout"
          onClick={() => void signOutXtool()}
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut size={15} aria-hidden />
        </button>
      </div>
    </header>
  )
}
