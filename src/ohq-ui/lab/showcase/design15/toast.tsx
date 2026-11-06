import { useEffect, useState } from 'react'
import { cx } from '../../../lib/cx'
import { TOAST_HOLD_MS, TOAST_OUT_MS } from './d15-motion'

interface ToastProps {
  text: string
  /** 떠 있는 시간(ms) — 지나면 흐려지며 사라지고 onDone */
  hold?: number
  onDone?: () => void
}

/**
 * 알림 알약(창 아래 가운데) — 짙은 강조색 바탕. 들어올 때 흐림이 걷히며(F86.5~F89.5 0.11초), 나갈 때 다시
 * 흐려지며 0.2초에 사라진다(F843~F849). 바꿔 띄우려면 바깥에서 key를 바꾼다.
 */
export function Toast({ text, hold = TOAST_HOLD_MS, onDone }: ToastProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const out = window.setTimeout(() => setLeaving(true), hold)
    const done = window.setTimeout(() => onDone?.(), hold + TOAST_OUT_MS)
    return () => {
      window.clearTimeout(out)
      window.clearTimeout(done)
    }
  }, [hold, onDone])

  return (
    <div className={cx('d15-toast', leaving && 'is-out')} role="status">
      {text}
    </div>
  )
}
