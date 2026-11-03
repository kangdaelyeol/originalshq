import { ChevronUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { IconDot, SidebarBadge } from './sidebar-badge'
import { useD8Sidebar, useDockItem } from './sidebar-context'
import { D8_DOCK, type D8NavItem } from './sidebar-data'
import { slowTween } from './sidebar-motion'

interface SidebarNavItemProps {
  item: D8NavItem
  selected?: boolean
  onSelect?: (key: string) => void
  /** 하위 메뉴(프로젝트)가 열렸는지 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 진열용 — 마우스를 올린 모습으로 고정 */
  forceHover?: boolean
}

/**
 * 메뉴 한 줄 — 아이콘·라벨·끝 표시. 줄 높이 4.8em(줄 간격 5em, F169), 아이콘 가운데는 패널
 * 왼쪽에서 3.9em(접힘·펼침 같은 자리), 라벨은 6.5em에서 시작한다. 접혔을 때는 독 확대로 줄
 * 높이와 아이콘 크기가 커지고, 펼쳤을 때는 마우스를 올리면 옅은 알약이 깔린다.
 */
export function SidebarNavItem({
  item,
  selected = false,
  onSelect,
  open = false,
  onOpenChange,
  forceHover = false,
}: SidebarNavItemProps) {
  const { expanded, labels, rail, registerItem, showTip, timeScale } = useD8Sidebar()
  const dock = useDockItem(item.key, D8_DOCK.grow.item, 4.8)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const dockRef = dock.ref
  const setRow = useCallback(
    (el: HTMLDivElement | null) => {
      rowRef.current = el
      dockRef(el)
      registerItem(item.key, el)
    },
    [dockRef, registerItem, item.key],
  )

  // 접혔을 때만 툴팁 — 펼치면 라벨이 보이니까
  const tip = () => {
    if (!expanded && rowRef.current) {
      showTip({ key: item.key, label: item.label, chip: item.chip, anchor: 'panel', el: rowRef.current })
    }
  }

  const Icon = item.icon
  const badgeText = item.badge ? (item.badge.kind === 'dot' ? '새 소식' : item.badge.value) : null

  return (
    <motion.div
      ref={setRow}
      className={cx('d8-item', forceHover && 'is-hover')}
      data-selected={selected || undefined}
      style={{ height: dock.height }}
    >
      <button
        type="button"
        className="d8-item__btn"
        aria-current={selected ? 'page' : undefined}
        aria-label={badgeText ? `${item.label}, ${badgeText}` : item.label}
        onClick={() => onSelect?.(item.key)}
        onPointerEnter={tip}
        onPointerLeave={() => showTip(null)}
        onFocus={tip}
        onBlur={() => showTip(null)}
      >
        <span className="d8-item__inner">
          <motion.span className="d8-item__icon" style={{ scale: dock.iconScale }}>
            <Icon className="d8-icon" aria-hidden="true" />
            {item.badge && <IconDot opacity={rail} />}
          </motion.span>
          <motion.span className="d8-item__label" style={{ opacity: labels }}>
            {item.label}
          </motion.span>
          {item.badge && (
            <motion.span className="d8-item__trail" style={{ opacity: labels }}>
              <SidebarBadge badge={item.badge} />
            </motion.span>
          )}
        </span>
      </button>

      {item.children && (
        <motion.button
          type="button"
          className="d8-item__caret"
          style={{ opacity: labels }}
          tabIndex={expanded ? 0 : -1}
          aria-expanded={open}
          aria-label={`${item.label} 하위 메뉴 ${open ? '접기' : '펼치기'}`}
          onClick={() => onOpenChange?.(!open)}
        >
          <motion.span
            className="d8-item__caret-icon"
            initial={false}
            animate={{ rotate: open ? 0 : 180 }}
            transition={slowTween({ duration: 0.25, ease: [0.33, 1, 0.68, 1] }, timeScale)}
          >
            <ChevronUp aria-hidden="true" />
          </motion.span>
        </motion.button>
      )}
    </motion.div>
  )
}
