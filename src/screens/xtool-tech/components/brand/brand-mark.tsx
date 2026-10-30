import { cx } from '../../lib/cx'
import { X_BOX, X_POLYGONS } from './x-shape'

/** xTool의 X — 꼭짓점은 x-shape.ts(앱 아이콘에서 딴 값). 색은 currentColor. */
export function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${X_BOX.width} ${X_BOX.height}`} className={className} aria-hidden>
      <g fill="currentColor" stroke="currentColor" strokeWidth={6} strokeLinejoin="round">
        {X_POLYGONS.map((poly, i) => (
          <polygon key={i} points={poly.map(([x, y]) => `${x},${y}`).join(' ')} />
        ))}
      </g>
    </svg>
  )
}

/** 녹색 판 위 짙은 X — 사이드바 로고 칸. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cx('brand-mark', className)} aria-hidden>
      <XMark className="brand-mark__x" />
    </span>
  )
}
