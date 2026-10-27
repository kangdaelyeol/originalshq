import type { ToastItem } from '../view-model/use-toast'

/** useToast의 토스트를 화면 아래 가운데에 쌓아 보여 준다. */
export const ToastStack = ({ toasts }: { toasts: readonly ToastItem[] }) => (
  <div className="log-toast" role="status" aria-live="polite">
    {toasts.map((toast) => (
      <div key={toast.id} className={`log-toast__item is-${toast.tone}`}>
        <span className="log-toast__dot" aria-hidden="true" />
        {toast.message}
      </div>
    ))}
  </div>
)
