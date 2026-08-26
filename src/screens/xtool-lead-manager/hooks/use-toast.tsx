import { useState, useCallback } from 'react'
import {
  type ToastType,
  ToasterMessage,
} from '@/screens/xtool-lead-manager/components'

interface Toast {
  id: number
  type: ToastType
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: ToastType) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2000)
  }, [])

  const ToastContainer = () => (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
      }}
    >
      {toasts.map((toast) => (
        <ToasterMessage key={toast.id} type={toast.type} />
      ))}
    </div>
  )

  return { showToast, ToastContainer }
}
