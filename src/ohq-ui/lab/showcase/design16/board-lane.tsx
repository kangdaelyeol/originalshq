import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import type { OrderStatus, Tone } from './design16-data'
import { GlassPanel } from './glass-panel'

interface BoardLaneProps {
  col: OrderStatus
  title: string
  sub: string
  count: number
  tone: Tone
  /** 놓을 자리 — 테두리 강조색 + 빛(F141 To pack · F149 Packed) */
  hot?: boolean
  /** 카드가 없을 때 안내 */
  emptyText?: string
  children?: ReactNode
}

/**
 * 칸반 레인(120×, 8.7px 틈) — 점·제목·숫자, 부제, 카드 6px 간격. 비면 "Drop an order here" 칸.
 * 영상 코드가 elementFromPoint(...).closest('.lane')로 찾는 판이 이것이다(data-col = 상태).
 */
export function BoardLane({
  col,
  title,
  sub,
  count,
  tone,
  hot,
  emptyText = 'Drop an order here',
  children,
}: BoardLaneProps) {
  const empty = !children || (Array.isArray(children) && children.length === 0)
  return (
    <GlassPanel
      as="section"
      className={cx('d16-lane', `d16-tone--${tone}`)}
      hot={hot}
      data-col={col}
      aria-label={title}
    >
      <header className="d16-lane__head">
        <span className="d16-lane__dot" aria-hidden />
        <h3 className="d16-lane__title">{title}</h3>
        <span className="d16-lane__count">{count}</span>
      </header>
      <p className="d16-lane__sub">{sub}</p>
      <div className="d16-lane__cards">{empty ? <p className="d16-lane__empty">{emptyText}</p> : children}</div>
    </GlassPanel>
  )
}
