import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'

interface VerdictBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 확률(0~1) — "p 0.83" */
  p: number
  /** 판정 낱말 — keep·drop·ship·hold·fire·jump·fix·clear */
  word: string
}

/**
 * 선이 닿은 카드 오른쪽 위에 0.13초 뜨는 초록 판정표 "p 0.83 keep" — 청록 1px 테두리, 어두운 청록 바탕,
 * 고정폭 글자. 카드 크기를 따라 줄지 않는다(영상에서 위·아래 어디서나 폭 58~61px).
 */
export function VerdictBadge({ p, word, className, ...rest }: VerdictBadgeProps) {
  return (
    <span className={cx('d13-badge', className)} {...rest}>
      <span className="d13-badge__text" data-d13-badge-text>
        p {p.toFixed(2)} {word}
      </span>
    </span>
  )
}
