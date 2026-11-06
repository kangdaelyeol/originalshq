import type { CSSProperties } from 'react'
import { cx } from '../../../lib/cx'

interface MiniBarsProps {
  values: readonly number[]
  /** 가장 높은 막대(영상 px) */
  height?: number
  className?: string
}

/** 시간대별 방문 막대 — 24개, 칸 5.64px(막대 3.7 + 틈), 위가 밝은 강조색 그러데이션 */
export function MiniBars({ values, height = 17, className }: MiniBarsProps) {
  const max = Math.max(...values, 1)
  return (
    <div className={cx('d16-bars', className)} style={{ '--h': height } as CSSProperties} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="d16-bars__bar" style={{ '--v': v / max } as CSSProperties} />
      ))}
    </div>
  )
}
