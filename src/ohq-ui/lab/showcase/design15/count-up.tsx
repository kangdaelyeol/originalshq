import { useLayoutEffect, useRef } from 'react'
import { formatValue, type D15NumberFormat } from './d15-format'
import { COUNT_DELAY_MS, COUNT_MS, easeOutQuint, prefersReducedMotion, tween } from './d15-motion'

interface CountUpProps {
  value: number
  format?: D15NumberFormat
  /** 처음 붙을 때 시작 값(기본 0) */
  from?: number
  /** 처음 붙은 뒤 오르기 시작까지(ms) — 기본은 쪽이 붙고 0.27초(F868.5) */
  delay?: number
  duration?: number
  className?: string
}

/**
 * 오르는 숫자 — 처음엔 from(0)에서, 값이 바뀌면 보이던 값에서 새 값으로 easeOutQuint 1.2초(F868.5~F888).
 * React는 다시 그리지 않고 rAF가 글자만 고친다(span에 React 자식이 없다). 움직임 줄이기면 바로 끝값.
 */
export function CountUp({
  value,
  format = 'int',
  from = 0,
  delay = COUNT_DELAY_MS,
  duration = COUNT_MS,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const target = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const write = (v: number) => {
      shown.current = v
      el.textContent = formatValue(v, format)
    }
    const prevTarget = target.current
    const first = prevTarget === null
    const start = first ? from : (shown.current ?? from)
    target.current = value
    if (prefersReducedMotion() || start === value) {
      write(value)
      return
    }
    if (first) write(start)
    let begun = false
    const stop = tween(
      duration,
      (u) => {
        begun = true
        write(start + (value - start) * easeOutQuint(u))
      },
      first ? delay : 0,
    )
    return () => {
      stop()
      // StrictMode가 효과를 두 번 돌리면 첫 번째는 시작도 전에 걷힌다 — 그때는 "처음"을 되돌려 둔다
      if (!begun) target.current = prevTarget
    }
  }, [value, format, from, delay, duration])

  return <span ref={ref} className={className} />
}
