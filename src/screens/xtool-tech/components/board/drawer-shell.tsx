import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { usePortalRoot } from '../../lib/portal-root'

interface DrawerShellProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** top: 다른 패널 위에 겹쳐 뜨는 패널(편집) — Esc가 이 패널만 닫는다. */
  layer?: 'base' | 'top'
  /** 바뀌면 패널을 처음부터 다시 그린다(다른 항목을 열 때). */
  contentKey?: string
  children: ReactNode
}

/**
 * 오른쪽에서 밀려 나오는 유리 패널 껍데기. 화면 루트(.xtool-tech)로 포털해서 띄운다(카드 안에
 * 두면 조상 요소가 backdrop root가 돼 흐림이 사라진다). 어둡게 깔리는 막과 패널은 형제로 둔다
 * — 막의 opacity 애니메이션이 패널의 흐림을 끄지 않게.
 */
export function DrawerShell({ open, onClose, labelledBy, layer = 'base', contentKey, children }: DrawerShellProps) {
  const root = usePortalRoot()
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 위에 겹친 패널은 먼저(capture) 받아서 아래 패널까지 닫히지 않게 막는다.
      if (layer === 'top') e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, layer === 'top')
    return () => window.removeEventListener('keydown', onKey, layer === 'top')
  }, [open, layer, onClose, contentKey])

  if (!root) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className={cx('drawer-scrim', layer === 'top' && 'drawer-scrim--top')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key={`drawer-${contentKey ?? ''}`}
            ref={panelRef}
            tabIndex={-1}
            className={cx('glass', 'drawer', layer === 'top' && 'drawer--top')}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    root,
  )
}
