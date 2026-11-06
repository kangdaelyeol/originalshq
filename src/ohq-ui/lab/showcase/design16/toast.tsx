import { Check } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { D16_T, EASE, play } from './d16-motion'

interface ToastProps {
  message: string
  action?: string
  onAction?: () => void
  /** 나타나기 시작(초) — null이면 바로 */
  delay?: number | null
  className?: string
}

/**
 * 아래 가운데 토스트(198×25, 창 아래에서 10.5px) — 밝은 회색 알약(229,226,223)·체크·글·"Undo" 단추.
 * 12px 아래에서 back.out(1.7) 0.4초로 오르며 살짝 넘친다(F163 +6 · F164 +3.3 · F167 −0.8).
 */
export function Toast({ message, action, onAction, delay = D16_T.toastDelay, className }: ToastProps) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (delay === null) return
    const anims = [
      play(ref.current, [{ translate: `0 calc(${D16_T.toastFrom} * var(--d16-px))` }, { translate: '0 0' }], {
        duration: D16_T.toastRise,
        delay,
        easing: EASE.backOut17,
      }),
      play(ref.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 0.14, delay }),
    ]
    return () => anims.forEach((a) => a?.cancel())
  }, [delay, message])

  return (
    <div ref={ref} className={cx('d16-toast', className)} role="status">
      <Check className="d16-toast__icon" strokeWidth={2.4} aria-hidden />
      <span className="d16-toast__text">{message}</span>
      {action && (
        <button type="button" className="d16-toast__action d16-hov" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
