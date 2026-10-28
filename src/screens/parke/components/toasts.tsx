import { useParkeContext } from '@/screens/parke/context'
import '@/screens/parke/styles/admin-ui.scss'

/** 화면 아래 알림 — 삭제 후 "되돌리기" 버튼이 여기 뜬다. */
export const Toasts = () => {
  const { toasts, dismissToast } = useParkeContext()
  return (
    <div className="parke-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`parke-toast is-${toast.tone}`}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="parke-toast__action"
              onClick={() => {
                toast.action?.run()
                dismissToast(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="parke-toast__close"
            aria-label="알림 닫기"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
