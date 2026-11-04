import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { rovingIndex } from './keys'
import type { WaterOption } from './types'

interface WaterChipsProps<T extends string> {
  options: readonly WaterOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  /** md가 D7 그대로(글자 11px, 높이 26.5px) — sm 0.9배, lg 1.2배 */
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}

/**
 * 물 칩(D7 Bounce | Splash 효과 고르기) — 하나만 고른다. 고른 칩은 어두운 알약에 흰 글자, 아닌 칩은 반투명
 * 흰 알약에 회색 글자. 바뀔 때 0.1s(F356 → F359). 화살표·Home·End로 옮겨 고른다.
 */
export function WaterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  disabled = false,
  className,
}: WaterChipsProps<T>) {
  const index = options.findIndex((o) => o.value === value)
  const chips = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = rovingIndex(e.key, index, options.length)
    const o = next === null ? undefined : options[next]
    if (next === null || !o || disabled) return
    e.preventDefault()
    chips.current[next]?.focus()
    if (o.value !== value) onChange(o.value)
  }

  return (
    <div
      className={cx('water-chips', `water-chips--${size}`, disabled && 'is-disabled', className)}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const on = i === index
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => {
              chips.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            disabled={disabled}
            className={cx('water-chips__chip', on && 'is-on')}
            onClick={() => {
              if (!on) onChange(o.value)
            }}
          >
            {Icon && <Icon className="water-chips__icon" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
