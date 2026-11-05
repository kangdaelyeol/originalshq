import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'

interface DrawerShellProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  /** top: 다른 패널 위에 겹쳐 뜨는 패널(편집) — Esc가 이 패널만 닫는다. */
  layer?: 'base' | 'top'
  /** 바뀌면 패널을 처음부터 다시 그린다(다른 항목을 열 때). */
  contentKey?: string
  /** center: 화면 가운데 뜨는 모달(상세 보기) — Monday 표 레이아웃은 그대로 오른쪽 패널. 기본은 오른쪽. */
  placement?: 'side' | 'center'
  children: ReactNode
}

const SIDE_MOTION = { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 40, opacity: 0 } }
const CENTER_MOTION = {
  initial: { y: 18, scale: 0.98, opacity: 0 },
  animate: { y: 0, scale: 1, opacity: 1 },
  exit: { y: 12, scale: 0.98, opacity: 0 },
}

/**
 * 오른쪽에서 밀려 나오는(center면 가운데 떠오르는) 유리 패널 껍데기. 화면 루트(.xtool-tech)로 포털해서 띄운다(카드 안에
 * 두면 조상 요소가 backdrop root가 돼 흐림이 사라진다). 어둡게 깔리는 막과 패널은 형제로 둔다
 * — 막의 opacity 애니메이션이 패널의 흐림을 끄지 않게.
 */
export function DrawerShell({
  open,
  onClose,
  labelledBy,
  layer = 'base',
  contentKey,
  placement = 'side',
  children,
}: DrawerShellProps) {
  const root = usePortalRoot()
  const { theme } = useAppearance()
  const center = placement === 'center' && theme !== 'monday'
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 패널 안의 펼친 목록(드롭다운)이 있으면 그것만 닫히게 양보한다.
      if (panelRef.current?.querySelector('[data-popover-open]')) return
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
            className={cx('glass', 'drawer', layer === 'top' && 'drawer--top', center && 'drawer--center')}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            {...(center ? CENTER_MOTION : SIDE_MOTION)}
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
