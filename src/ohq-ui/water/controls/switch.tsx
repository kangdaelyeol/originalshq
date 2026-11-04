import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useReducedMotion, useWaterIndicator } from '../hooks'
import type { IndicatorTarget } from '../indicator'
import { waterClock } from '../motion'

interface WaterSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** 옆에 보이는 이름 — 없으면 ariaLabel을 꼭 적는다 */
  label?: ReactNode
  ariaLabel?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * 물 스위치 — 유리에 파인 홈(D7 track) 안에서 손잡이가 표시 알약처럼 스프링(ζ0.65·ω30.5, 7% 넘침)으로 오가며
 * 달리는 빠르기만큼 늘어난다. 꺼지면 불투명 유리 알약, 켜지면 어두운 알약(0.1s). Space·Enter로 바꾼다.
 */
export function WaterSwitch({
  checked,
  onChange,
  label,
  ariaLabel,
  size = 'md',
  disabled = false,
  className,
  id,
}: WaterSwitchProps) {
  const reduced = useReducedMotion()
  const { ref: knobRef, engine: knobEngine } = useWaterIndicator<HTMLSpanElement>()
  const trackRef = useRef<HTMLButtonElement>(null)
  const pressedAt = useRef<number | undefined>(undefined)
  const geo = useRef<{ off: IndicatorTarget; on: IndicatorTarget; travel: number } | null>(null)
  /** 손잡이가 가 있는(가는 중인) 쪽 */
  const shown = useRef<boolean | null>(null)
  const movedAt = useRef(-Infinity)
  const latest = useRef({ checked, reduced })
  const labelId = useId()

  useLayoutEffect(() => {
    latest.current = { checked, reduced }
  })

  // 재기 — 홈 안쪽 폭과 손잡이 크기(손잡이 폭은 엔진이 style에 쓰므로 CSS 변수에서 읽는다)
  useLayoutEffect(() => {
    const track = trackRef.current
    const el = knobRef.current
    if (!track || !el) return
    // 효과가 붙을 때마다 엔진이 새로 생긴다(StrictMode는 두 번 붙인다) — 첫 재기는 모양이 같아도 놓는다
    let placed = false
    const measure = () => {
      const cs = getComputedStyle(track)
      const w = parseFloat(cs.width)
      const h = parseFloat(cs.height)
      const kh = el.offsetHeight
      const kw = parseFloat(cs.getPropertyValue('--water-knob-w')) || kh
      const inset = (h - kh) / 2
      const off = { pos: inset + kw / 2, size: kw }
      const on = { pos: w - inset - kw / 2, size: kw }
      const prev = geo.current
      if (placed && prev && prev.off.pos === off.pos && prev.on.pos === on.pos && prev.on.size === kw) return
      placed = true
      geo.current = { off, on, travel: on.pos - off.pos }
      const e = knobEngine.current
      if (!e) return
      const want = latest.current.checked
      const moving = waterClock() - movedAt.current < 0.9 && !latest.current.reduced
      e.set(want ? on : off, moving ? { step: on.pos - off.pos } : { instant: true })
      shown.current = want
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [size, knobRef, knobEngine])

  // 켜고 끌 때 — 누른 시각부터 스프링으로
  useLayoutEffect(() => {
    const e = knobEngine.current
    const g = geo.current
    if (!e || !g || shown.current === checked) return
    shown.current = checked
    const at = pressedAt.current
    pressedAt.current = undefined
    const target = checked ? g.on : g.off
    if (latest.current.reduced) {
      e.set(target, { instant: true })
      return
    }
    e.set(target, { at, step: g.travel })
    movedAt.current = at ?? waterClock()
  }, [checked, knobEngine])

  return (
    <label
      className={cx('water-switch', `water-switch--${size}`, checked && 'is-on', disabled && 'is-disabled', className)}
    >
      <button
        ref={trackRef}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        disabled={disabled}
        className="water-switch__track"
        onClick={() => {
          pressedAt.current = waterClock()
          onChange(!checked)
        }}
      >
        <span ref={knobRef} className="water-switch__knob" aria-hidden />
      </button>
      {label && (
        <span id={labelId} className="water-switch__label">
          {label}
        </span>
      )}
    </label>
  )
}
