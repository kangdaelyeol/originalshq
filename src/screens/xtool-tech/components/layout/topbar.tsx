import { Bell, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePeriod } from '../../context/period-context'
import { NOTIFICATIONS, type NotificationItem } from '../../data/notifications'
import { PERIOD_OPTIONS } from '../../data/period'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { NotificationPanel, type PanelAnchor } from './notification-panel'

export function Topbar() {
  const { period, setPeriod } = usePeriod()
  const { pathname } = useLocation()
  const bellRef = useRef<HTMLButtonElement>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => NOTIFICATIONS.map((n) => ({ ...n })))
  // 연 화면의 경로를 기억해 두면, 다른 메뉴로 옮겨 갈 때 따로 닫지 않아도 저절로 닫힌다.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<PanelAnchor>({ top: 0, right: 0 })
  const open = openedAt === pathname
  const unread = notifications.filter((n) => n.unread).length

  const measure = useCallback(() => {
    const rect = bellRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.bottom, right: rect.right })
  }, [])

  // 열려 있는 동안 스크롤·창 크기가 바뀌면 종 버튼을 따라간다(상단바는 페이지와 같이 스크롤된다).
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [open, measure])

  const toggle = () => {
    if (open) {
      setOpenedAt(null)
      return
    }
    measure()
    setOpenedAt(pathname)
  }

  const close = useCallback((reason: 'escape' | 'outside') => {
    setOpenedAt(null)
    if (reason === 'escape') bellRef.current?.focus()
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }, [])

  return (
    <header className="glass topbar">
      <label className="search">
        <Search size={15} aria-hidden />
        <input type="search" placeholder="서비스, 커밋, 이슈 번호 검색…" aria-label="검색" />
      </label>
      <div className="topbar__controls">
        <SegmentedControl ariaLabel="조회 기간" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <button
          ref={bellRef}
          type="button"
          className="icon-button"
          aria-label={unread > 0 ? `알림 — 읽지 않음 ${unread}개` : '알림'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'notification-panel' : undefined}
          onClick={toggle}
        >
          <Bell size={16} aria-hidden />
          {unread > 0 && (
            <span className="icon-button__badge" aria-hidden>
              {unread}
            </span>
          )}
        </button>
        <Button icon={Plus}>새 이슈</Button>
      </div>

      <NotificationPanel
        open={open}
        anchor={anchor}
        triggerRef={bellRef}
        items={notifications}
        onClose={close}
        onRead={markRead}
        onReadAll={markAllRead}
      />
    </header>
  )
}
