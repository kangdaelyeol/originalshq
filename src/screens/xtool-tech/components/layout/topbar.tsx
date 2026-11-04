import { Bell, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePeriod } from '../../context/period-context'
import { NOTIFICATIONS, type NotificationItem } from '../../data/notifications'
import { PERIOD_OPTIONS } from '../../data/period'
import { MY_WORK_PATH, xtPath } from '../../paths'
import { Button } from '@/ohq-ui/components/button'
import { SegmentedControl } from '@/ohq-ui/components/segmented-control'
import { NotificationPanel, type PanelAnchor } from './notification-panel'
import { SyncStatus } from './sync-status'
import { TopbarTitle } from './topbar-title'

/**
 * 상단바 — 왼쪽 제목, 오른쪽 저장 표시·기간·알림·새 이슈. embedded면 Monday 표 판(.mon-board) 맨 위에 들어가는
 * 머리말 모양(Monday 보드 머리말처럼 판과 한 몸)으로 그린다. 기간은 대시보드의 보드·내 업무에서만 — 숫자
 * 카드의 "… 완료"가 이 기간을 센다(물 상단바와 같은 규칙). Monday 표(embedded)는 숫자 카드가 없어 뺀다.
 */
export function Topbar({ embedded = false }: { embedded?: boolean }) {
  const { pathname } = useLocation()
  const { period, setPeriod } = usePeriod()
  const periodic = !embedded && (pathname.startsWith(xtPath('/boards/')) || pathname.startsWith(MY_WORK_PATH))
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
    <header className={embedded ? 'mon-board__head' : 'glass topbar'}>
      <TopbarTitle />
      <div className="topbar__controls">
        <SyncStatus />
        {periodic && (
          <SegmentedControl ariaLabel="기간" size="sm" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        )}
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
