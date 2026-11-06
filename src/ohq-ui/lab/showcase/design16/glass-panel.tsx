import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from '../../../lib/cx'

interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'aside' | 'article'
  /** panel: 바깥 판(흐림) · inset: 판 안의 판(흐림 없이 밝은 막) · float: 떠 있는 판(그림자 진하게) */
  tone?: 'panel' | 'inset' | 'float'
  /** 놓을 자리로 뜬 판 — 강조색 테두리와 빛 */
  hot?: boolean
  ref?: Ref<HTMLElement>
  children?: ReactNode
}

/**
 * D16 유리 판 — 공 위에 어두운 남색 막(토큰 --d16-glass)을 깔고 뒤를 흐린다(--d16-blur).
 * 위 테두리가 옆보다 밝고(F30 윗변 62 · 옆 33), 위쪽 25px에 옅은 빛이 진다.
 */
export function GlassPanel({
  as: Tag = 'div',
  tone = 'panel',
  hot,
  className,
  ref,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={cx('d16-glass', `d16-glass--${tone}`, hot && 'is-hot', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}
