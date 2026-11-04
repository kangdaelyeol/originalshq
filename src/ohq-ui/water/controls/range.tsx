import { useId, useLayoutEffect, useRef } from 'react'
import { cx } from '../../lib/cx'
import { useReducedMotion, useWaterIndicator } from '../hooks'
import type { IndicatorPose } from '../indicator'
import { clamp01, round3, waterClock } from '../motion'
import { cssWidth } from './measure'

interface WaterRangeProps {
  label: string
  /** 슬라이더 아래 짧은 설명 */
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  /** 오른쪽 위에 보이는 값 표기(예: 22px, 46%) */
  format: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

/**
 * 물 슬라이더 — 유리에 파인 홈 + 어두운 채움 + 불투명 유리 손잡이. 손잡이는 표시 알약처럼 스프링으로 따라가며
 * (ζ0.65·ω30.5) 빠르기만큼 늘어나고, 채움은 손잡이를 같은 프레임에 따라간다. 끌기·화살표·PageUp/Down·
 * Home/End는 진짜 range 입력(투명하게 덮음)이 받는다. RangeField와 같은 props.
 */
export function WaterRange({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  disabled = false,
  className,
}: WaterRangeProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  /** 홈 폭·손잡이 지름(px) */
  const geo = useRef<{ width: number; kw: number } | null>(null)
  const shown = useRef<number | null>(null)
  const movedAt = useRef(-Infinity)
  const changedAt = useRef<number | undefined>(undefined)
  const frac = max > min ? clamp01((value - min) / (max - min)) : 0
  const latest = useRef({ frac, reduced })

  // 채움 — 손잡이가 그려질 때마다(엔진 onDraw, 같은 rAF 안) 오른끝을 손잡이 가운데에 맞춘다(transform만)
  const followKnob = (pose: IndicatorPose) => {
    const fill = fillRef.current
    const g = geo.current
    if (fill && g) fill.style.transform = `translateX(${round3(pose.pos - g.width)}px)`
  }
  const { ref: knobRef, engine: knobEngine } = useWaterIndicator<HTMLSpanElement>({ onDraw: followKnob })

  useLayoutEffect(() => {
    latest.current = { frac, reduced }
  })

  // 재기 — 진짜 입력의 손잡이 폭을 손잡이 지름과 같게 둬서(_controls.scss) 값 ↔ 자리가 같다
  useLayoutEffect(() => {
    const track = trackRef.current
    const el = knobRef.current
    if (!track || !el) return
    // 효과가 붙을 때마다 엔진이 새로 생긴다(StrictMode는 두 번 붙인다) — 첫 재기는 모양이 같아도 놓는다
    let placed = false
    const measure = () => {
      const width = cssWidth(track)
      const kw = el.offsetHeight
      const prev = geo.current
      if (placed && prev && prev.width === width && prev.kw === kw) return
      placed = true
      geo.current = { width, kw }
      const e = knobEngine.current
      if (!e) return
      const moving = waterClock() - movedAt.current < 0.9 && !latest.current.reduced
      const t = { pos: kw / 2 + latest.current.frac * (width - kw), size: kw }
      e.set(t, moving ? { step: width - kw } : { instant: true })
      shown.current = latest.current.frac
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [knobRef, knobEngine])

  // 값이 바뀌면 — 끄는 동안에는 매번 목표를 바꿔 지금 자리·빠르기에서 이어 간다
  useLayoutEffect(() => {
    const e = knobEngine.current
    const g = geo.current
    if (!e || !g || shown.current === frac) return
    shown.current = frac
    const at = changedAt.current
    changedAt.current = undefined
    const t = { pos: g.kw / 2 + frac * (g.width - g.kw), size: g.kw }
    if (latest.current.reduced) {
      e.set(t, { instant: true })
      return
    }
    e.set(t, { at, step: g.width - g.kw })
    movedAt.current = at ?? waterClock()
  }, [frac, knobEngine])

  return (
    <div className={cx('water-range', disabled && 'is-disabled', className)}>
      <div className="water-range__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <div ref={trackRef} className="water-range__track">
        <span className="water-range__groove" aria-hidden>
          <span ref={fillRef} className="water-range__fill" />
        </span>
        <input
          id={id}
          type="range"
          className="water-range__input"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={format(value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            changedAt.current = waterClock()
            onChange(Number(e.target.value))
          }}
        />
        <span ref={knobRef} className="water-range__knob" aria-hidden />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="water-range__hint">
          {hint}
        </p>
      )}
    </div>
  )
}
