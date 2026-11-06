import { cx } from '../../../lib/cx'
import type { Tone } from './design16-data'

interface ShareBarProps {
  parts: readonly { label: string; pct: number; tone: Tone }[]
  className?: string
}

/** 쌓은 몫 막대(144.5×5.5) — 조각마다 둥근 끝, 1.5px 틈(파랑 62.7% · 호박 14.9% · 청록 3.2% · 회색 16.8%) */
export function ShareBar({ parts, className }: ShareBarProps) {
  return (
    <div
      className={cx('d16-share', className)}
      role="img"
      aria-label={parts.map((p) => `${p.label} ${p.pct}%`).join(', ')}
    >
      {parts.map((p) => (
        <span key={p.label} className={`d16-share__part d16-tone--${p.tone}`} style={{ flexGrow: p.pct }} />
      ))}
    </div>
  )
}
