import { cx } from '../../../lib/cx'
import type { LiquidEffect } from './liquid-menu-data'

interface LiquidEffectToggleProps {
  value: LiquidEffect
  onChange: (value: LiquidEffect) => void
}

const OPTIONS: { value: LiquidEffect; label: string }[] = [
  { value: 'bounce', label: 'Bounce' },
  { value: 'splash', label: 'Splash' },
]

/**
 * 물방울 효과 고르기(Design 7) — 영상 위쪽의 Bounce | Splash 두 알약.
 * 고른 쪽은 어두운 알약에 흰 글씨, 아닌 쪽은 반투명 흰 알약에 회색 글씨. 바뀔 때 0.1초(F356→F359).
 */
export function LiquidEffectToggle({ value, onChange }: LiquidEffectToggleProps) {
  return (
    <div className="d7-toggle" role="radiogroup" aria-label="물방울 효과">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx('d7-toggle__option', o.value === value && 'is-on')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
