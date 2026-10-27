import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

// 결과 토스트가 떠 있는 시간. 진행 중(info) 토스트는 결과로 바뀔 때까지
// 두되, 응답이 끝내 안 오면 INFO_MAX_MS 뒤에 닫는다.
const RESULT_MS = 2500
const INFO_MAX_MS = 20_000

let nextId = 1

/**
 * 화면 아래 가운데에 뜨는 짧은 알림(리드 관리자의 토스트와 같은 모양).
 * show는 토스트 id를 돌려준다 — 그 id를 다시 넘기면 같은 자리의 토스트를
 * 바꾼다("새로고침 중…" → "새로고침했습니다").
 */
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'success', replaceId?: number) => {
      const id = replaceId ?? nextId++
      setToasts((prev) =>
        prev.some((toast) => toast.id === id)
          ? prev.map((toast) =>
              toast.id === id ? { id, tone, message } : toast,
            )
          : [...prev, { id, tone, message }],
      )
      clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        setTimeout(
          () => dismiss(id),
          tone === 'info' ? INFO_MAX_MS : RESULT_MS,
        ),
      )
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  return { toasts, show }
}
