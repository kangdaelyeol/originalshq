import { CircleAlert, CircleCheck, LoaderCircle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import { dismissToast, useToasts } from '../../data/tech-save-queue'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'

const ICON = { pending: LoaderCircle, success: CircleCheck, error: CircleAlert }

/** 화면 오른쪽 아래 알림 — 백그라운드 저장의 진행·결과. 실패는 닫을 때까지 남는다. */
export function Toaster() {
  const toasts = useToasts()
  const root = usePortalRoot()
  if (!root) return null
  return createPortal(
    <ol className="toaster" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICON[toast.tone]
          return (
            <motion.li
              key={toast.id}
              layout
              className={cx('glass', 'toast', `toast--${toast.tone}`)}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <Icon size={16} className={cx('toast__icon', toast.tone === 'pending' && 'is-spinning')} aria-hidden />
              <div className="toast__body">
                <p className="toast__title">{toast.title}</p>
                {toast.message && <p className="toast__message">{toast.message}</p>}
                {toast.action && (
                  <button type="button" className="text-link text-link--accent toast__action" onClick={toast.action.run}>
                    {toast.action.label}
                  </button>
                )}
              </div>
              {toast.tone !== 'pending' && (
                <button type="button" className="toast__close" aria-label="닫기" onClick={() => dismissToast(toast.id)}>
                  <X size={14} aria-hidden />
                </button>
              )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>,
    root,
  )
}
