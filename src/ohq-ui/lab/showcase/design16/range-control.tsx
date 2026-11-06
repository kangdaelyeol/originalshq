import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { spanOf, StretchIndicator } from './stretch-indicator'

interface RangeControlProps<T extends string> {
  options: readonly T[]
  value: T
  onChange?: (next: T) => void
  label?: string
  className?: string
}

const optionSpan = (track: HTMLElement | null, value: string) => {
  const el = track?.querySelector<HTMLElement>(`[data-opt="${value}"]`)
  return track && el ? spanOf(el, track, 'x') : null
}

/**
 * 기간 고르기 — 어두운 길(87.6×15) 안에 칸 21.9px, 고른 칸 밝은 알약(18.6px).
 * 누르면 알약이 늘어나며 옮겨 간다(12M → 30D: 오른 모서리 F31.2~F38, 왼 모서리 F34.3~F45).
 */
export function RangeControl<T extends string>({
  options,
  value,
  onChange,
  label = 'Range',
  className,
}: RangeControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const engineRef = useRef<StretchIndicator | null>(null)

  const onMount = useEffectEvent(() => {
    if (!indRef.current) return
    const engine = new StretchIndicator(indRef.current, 'x')
    engineRef.current = engine
    const span = optionSpan(trackRef.current, value)
    if (span) engine.place(span[0], span[1])
  })
  useLayoutEffect(() => {
    onMount()
    return () => engineRef.current?.destroy()
  }, [])

  useLayoutEffect(() => {
    const span = optionSpan(trackRef.current, value)
    if (span) engineRef.current?.moveTo(span[0], span[1])
  }, [value])

  const onResize = useEffectEvent(() => {
    const span = optionSpan(trackRef.current, value)
    if (span) engineRef.current?.place(span[0], span[1])
  })
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) first = false
      else onResize()
    })
    ro.observe(track)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={cx('d16-range', className)} role="radiogroup" aria-label={label} ref={trackRef}>
      <span className="d16-range__indicator" ref={indRef} aria-hidden />
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={opt === value}
          data-opt={opt}
          className={cx('d16-range__opt', 'd16-hov', opt === value && 'is-on')}
          onClick={() => onChange?.(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
