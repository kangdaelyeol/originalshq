import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../../lib/cx'
import { WaterBead } from '../glass'
import type { WaterIcon } from './types'

interface WaterButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>
  /**
   * primary: 어두운 알약(D7 고른 칩) · ghost: 반투명 흰 칩(D7 안 고른 칩) · glass: 불투명 유리(D7 접힌 버튼 속) ·
   * danger: 붉은 알약(지우기)
   */
  variant?: 'primary' | 'ghost' | 'glass' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: WaterIcon
  /** 기다리는 중 — 아이콘 자리에서 물방울이 통통 튀고, 눌러도 아무 일 없다(aria-busy) */
  loading?: boolean
}

/**
 * 물 단추 — Button과 같은 props에 glass·danger·lg·loading을 더했다. 누르면 D7 버튼처럼 출렁이며 3% 줄고
 * (wobble ζ0.3·ω46), 떼면 부풀며 돌아온다(swell ζ0.35·ω20) — CSS 전환이라 rAF를 쓰지 않는다.
 */
export function WaterButton({
  ref,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: WaterButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'water-button',
        `water-button--${variant}`,
        `water-button--${size}`,
        loading && 'is-loading',
        className,
      )}
      {...rest}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest['aria-disabled'] || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
    >
      {loading ? (
        <svg className="water-button__bead" viewBox="-7 -7 14 14" aria-hidden focusable="false">
          <WaterBead />
        </svg>
      ) : (
        Icon && <Icon className="water-button__icon" />
      )}
      {children}
    </button>
  )
}
