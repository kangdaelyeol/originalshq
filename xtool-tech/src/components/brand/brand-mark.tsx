import { cx } from '../../lib/cx'

/**
 * xTool의 X — 왼쪽 위 짧은 조각 + 긴 대각선과 오른쪽 아래 다리 두 덩어리.
 * 꼭짓점은 앱 아이콘(assets/xtool-start-icon.png, 824px)에서 X가 차지하는 상자
 * (142,210)–(680,610)을 0 기준으로 옮겨 땄다. 색은 currentColor.
 */
export function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 538 400" className={className} aria-hidden>
      <g fill="currentColor" stroke="currentColor" strokeWidth={6} strokeLinejoin="round">
        <polygon points="0,0 140,0 233,92 162,163" />
        <polygon points="0,400 399,0 538,0 342,200 538,400 399,400 270,273 140,400" />
      </g>
    </svg>
  )
}

/** 녹색 판 위 짙은 X — 사이드바·로그인 머리의 로고 칸. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cx('brand-mark', className)} aria-hidden>
      <XMark className="brand-mark__x" />
    </span>
  )
}
