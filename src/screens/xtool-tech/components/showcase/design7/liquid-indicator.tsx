import type { CSSProperties, Ref } from 'react'
import { cx } from '../../../lib/cx'

interface LiquidIndicatorProps {
  /** 늘어남(0~0.28) — 견본에서 움직이는 모습을 멈춰 보여 줄 때 */
  stretch?: number
  ref?: Ref<HTMLDivElement>
  className?: string
  style?: CSSProperties
}

/**
 * 고른 항목 뒤의 어두운 알약(Design 7) — 71×50.5, 위 #535156 → 아래 #2c2a2f(F1 x600 단면).
 * 메뉴 안에서는 엔진이 위치·늘어남을 매 프레임 넣고, 견본에서는 stretch로 모양만 보여 준다.
 */
export function LiquidIndicator({ stretch = 0, ref, className, style }: LiquidIndicatorProps) {
  const still = stretch ? { transform: `scale(${1 + stretch}, ${1 - 0.64 * stretch})` } : undefined
  return <div ref={ref} className={cx('d7-indicator', className)} style={{ ...still, ...style }} aria-hidden />
}
