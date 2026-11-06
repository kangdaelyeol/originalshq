import { cx } from '../../../lib/cx'

interface LiveDotProps {
  tone?: 'green' | 'blue' | 'amber'
  /** 숨쉬는 빛 — 1.1초마다 번졌다 줄어든다(F20.5·F54 최대, F38.5·F71 최소) */
  pulse?: boolean
  className?: string
}

/** 작은 상태 점(지름 4px) — 둘레 빛이 숨쉰다 */
export function LiveDot({ tone = 'green', pulse = true, className }: LiveDotProps) {
  return <span className={cx('d16-dot', `d16-dot--${tone}`, pulse && 'is-pulse', className)} aria-hidden />
}
