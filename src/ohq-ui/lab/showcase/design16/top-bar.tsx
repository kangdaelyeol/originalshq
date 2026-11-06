import { Bell, Plus, Search } from 'lucide-react'
import { Fragment } from 'react'
import { IconButton } from './icon-button'
import { LiveDot } from './live-dot'
import { PillButton } from './pill-button'

interface TopBarProps {
  greeting: string
  /** 날짜 다음 경로 — ['Orders', 'All orders'] → "Sunday, November 1 · Orders › All orders" */
  date: string
  crumbs: string[]
  notifications?: number
  onCreate?: () => void
}

/** 위 줄 — 인사(8.8px 600)와 초록 점 경로, 오른쪽 검색·알림(파란 숫자)·"+ Create" */
export function TopBar({ greeting, date, crumbs, notifications, onCreate }: TopBarProps) {
  return (
    <header className="d16-top">
      <div className="d16-top__text">
        <h1 className="d16-top__greeting">{greeting}</h1>
        <p className="d16-top__crumbs">
          <LiveDot />
          <span>
            {date}
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                <span className="d16-top__sep">{i === 0 ? ' · ' : ' › '}</span>
                {c}
              </Fragment>
            ))}
          </span>
        </p>
      </div>
      <div className="d16-top__actions">
        <IconButton icon={Search} label="Search" />
        <IconButton icon={Bell} label="Notifications" badge={notifications} />
        <PillButton icon={Plus} onClick={onCreate}>
          Create
        </PillButton>
      </div>
    </header>
  )
}
