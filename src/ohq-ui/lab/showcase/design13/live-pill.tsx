import { cx } from '../../../lib/cx'

interface LivePillProps {
  label?: string
  className?: string
}

/** "● LIVE" 알약 — 바탕·테두리·점이 0.333초마다 밝아졌다 어두워진다(영상 9.97프레임 주기, 글자는 그대로) */
export function LivePill({ label = 'LIVE', className }: LivePillProps) {
  return (
    <span className={cx('d13-live', className)}>
      <i className="d13-live__dot" aria-hidden />
      {label}
    </span>
  )
}
