import { Activity, AtSign, CircleX, GitPullRequest, Rocket } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { NotificationItem, NotificationKind } from '../../data/notifications'
import type { Option } from '../../data/types'
import { cx } from '../../lib/cx'
import { usePortalRoot } from '../../lib/portal-root'
import { SegmentedControl } from '../ui/segmented-control'

const KIND = {
  incident: { icon: CircleX, tone: 'crit', label: '장애' },
  review: { icon: GitPullRequest, tone: 'violet', label: '리뷰' },
  deploy: { icon: Rocket, tone: 'good', label: '배포' },
  mention: { icon: AtSign, tone: 'info', label: '멘션' },
  system: { icon: Activity, tone: 'neutral', label: '시스템' },
} as const satisfies Record<NotificationKind, { icon: unknown; tone: string; label: string }>

type Filter = 'all' | 'unread'

export interface PanelAnchor {
  /** 종 버튼 아래쪽 y(화면 기준) */
  top: number
  /** 종 버튼 오른쪽 x(화면 기준) — 패널 오른쪽을 여기에 맞춘다. */
  right: number
}

interface NotificationPanelProps {
  open: boolean
  anchor: PanelAnchor
  /** 패널이 아닌 곳을 눌렀는지 가릴 때 종 버튼도 "안쪽"으로 친다(다시 누르면 닫히게). */
  triggerRef: RefObject<HTMLElement | null>
  items: readonly NotificationItem[]
  onClose: (reason: 'escape' | 'outside') => void
  onRead: (id: string) => void
  onReadAll: () => void
}

/**
 * 알림 패널 — 상단바 밖(이 화면 루트 요소)으로 포털해서 띄운다. 상단바(유리)는 backdrop-filter가
 * 있어 그 안의 자식 유리는 상단바 바깥(페이지)을 흐리게 비추지 못하기 때문(lib/motion.ts의
 * backdrop root 주석). body가 아니라 루트 요소로 보내야 화면 스타일·변수가 적용된다.
 */
export function NotificationPanel({ open, anchor, triggerRef, items, onClose, onRead, onReadAll }: NotificationPanelProps) {
  const portalRoot = usePortalRoot()
  if (!portalRoot) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <PanelBody
          anchor={anchor}
          triggerRef={triggerRef}
          items={items}
          onClose={onClose}
          onRead={onRead}
          onReadAll={onReadAll}
        />
      )}
    </AnimatePresence>,
    portalRoot,
  )
}

function PanelBody({ anchor, triggerRef, items, onClose, onRead, onReadAll }: Omit<NotificationPanelProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const unread = items.filter((n) => n.unread).length
  const visible = filter === 'unread' ? items.filter((n) => n.unread) : items
  const filters: readonly Option<Filter>[] = [
    { value: 'all', label: '전체' },
    { value: 'unread', label: `읽지 않음 ${unread}` },
  ]

  // 열리면 패널로 포커스, 바깥을 누르거나 Esc면 닫는다.
  useEffect(() => {
    panelRef.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose('escape')
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, triggerRef])

  return (
    <motion.div
      ref={panelRef}
      id="notification-panel"
      className="glass notif"
      role="dialog"
      aria-label="알림"
      tabIndex={-1}
      style={{ top: anchor.top + 10, right: Math.max(12, window.innerWidth - anchor.right) }}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="notif__header">
        <div className="notif__heading">
          <h2 className="notif__title">알림</h2>
          {unread > 0 && <span className="notif__count">{unread}</span>}
        </div>
        <button type="button" className="notif__read-all" onClick={onReadAll} disabled={unread === 0}>
          모두 읽음
        </button>
      </header>

      <div className="notif__filters">
        <SegmentedControl size="sm" ariaLabel="알림 보기" options={filters} value={filter} onChange={setFilter} />
      </div>

      <ul className="notif__list">
        {visible.map((n) => {
          const kind = KIND[n.kind]
          const Icon = kind.icon
          return (
            <li key={n.id}>
              <button
                type="button"
                className={cx('notif__item', n.unread && 'is-unread')}
                onClick={() => onRead(n.id)}
              >
                <span className={cx('notif__icon', `notif__icon--${kind.tone}`)}>
                  <Icon size={15} strokeWidth={2.2} aria-label={kind.label} />
                </span>
                <span className="notif__content">
                  <span className="notif__item-title">{n.title}</span>
                  <span className="notif__text">{n.body}</span>
                  <span className="notif__time">{n.time}</span>
                </span>
                {n.unread && <span className="notif__dot" role="img" aria-label="읽지 않음" />}
              </button>
            </li>
          )
        })}
        {visible.length === 0 && <li className="notif__empty">읽지 않은 알림이 없어요</li>}
      </ul>

      <p className="notif__footer">최근 7일 알림을 보여 줘요 · 누르면 읽음으로 바뀌어요</p>
    </motion.div>
  )
}
