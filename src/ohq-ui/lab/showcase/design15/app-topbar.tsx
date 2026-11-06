import { Bell, Mail, Search } from 'lucide-react'
import { Avatar } from './avatar'
import { D15_USER, type D15Page } from './design15-data'

// 찾기 글은 쪽마다 다르다(F205 Dashboard · F330 Team · F545 Calendar…)
const PLACEHOLDER: Partial<Record<D15Page, string>> = {
  dashboard: 'Search projects & people',
  team: 'Search people',
}

/** 위 막대(F205 y19~44) — 찾기 알약(쪽마다 다른 글, ⌘K)·편지·종(빨간 점)·사람 */
export function AppTopbar({ page }: { page: D15Page }) {
  return (
    <header className="d15-top">
      <label className="d15-search">
        <Search aria-hidden strokeWidth={2} />
        <input placeholder={PLACEHOLDER[page] ?? 'Search tasks'} aria-label="Search" />
        <kbd>⌘ K</kbd>
      </label>
      <div className="d15-top__right">
        <button type="button" className="d15-top__icon" aria-label="Messages">
          <Mail aria-hidden strokeWidth={2} />
          <i />
        </button>
        <button type="button" className="d15-top__icon" aria-label="Notifications">
          <Bell aria-hidden strokeWidth={2} />
          <i />
        </button>
        <Avatar initials={D15_USER.initials} size="md" />
        <span className="d15-top__user">
          <b>{D15_USER.name}</b>
          <small>{D15_USER.email}</small>
        </span>
      </div>
    </header>
  )
}
