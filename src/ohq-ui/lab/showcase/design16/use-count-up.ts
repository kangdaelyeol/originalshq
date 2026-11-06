import { useLayoutEffect, type RefObject } from 'react'
import { prefersReducedMotion, quartOut } from './d16-motion'

export type CountFormat = 'usd' | 'int'

const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const formatCount = (v: number, format: CountFormat) => (format === 'usd' ? '$' : '') + NUM.format(Math.round(v))

/**
 * 숫자 오르기 — 0에서 value까지 quartOut(영상 $6,413: (1−f)^¼가 프레임마다 0.0315씩 곧게 준다 → 1.06초).
 * rAF가 글자만 바꾼다(React는 다시 그리지 않는다). playKey가 바뀌면 다시 오른다.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  value: number,
  format: CountFormat,
  opts: { delay: number; duration: number; playKey: number | null },
) {
  const { delay, duration, playKey } = opts
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (playKey === null || prefersReducedMotion()) {
      el.textContent = formatCount(value, format)
      return
    }
    el.textContent = formatCount(0, format)
    let raf = 0
    let start = -1
    const tick = (now: number) => {
      if (start < 0) start = now
      const u = ((now - start) / 1000 - delay) / duration
      el.textContent = formatCount(value * quartOut(u), format)
      if (u < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.textContent = formatCount(value, format)
    }
  }, [ref, value, format, delay, duration, playKey])
}
