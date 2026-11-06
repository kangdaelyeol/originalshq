import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import { D16_T, EASE, play } from './d16-motion'
import { D16_STATUS_LABEL, type OrderData } from './design16-data'
import { GlassPanel } from './glass-panel'
import { ItemThumb } from './item-thumb'
import { StatusPill } from './status-pill'

interface OrdersTableProps {
  orders: readonly OrderData[]
  summary: string
  /** 붙을 때 판이 10px 아래에서 오르고(0.07초 뒤 0.45초) 줄이 0.025초씩 나타난다 — null이면 바로 */
  intro?: boolean
  className?: string
}

/** "All orders" 표 — 판 안에 요약 줄·머리 줄·27.1px 줄(체크·번호·고객·상품 칸·시각·경로·금액·상태) */
export function OrdersTable({ orders, summary, intro = true, className }: OrdersTableProps) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !intro) return
    const anims = [
      play(
        root,
        [
          { opacity: 0, translate: '0 calc(10 * var(--d16-px))' },
          { opacity: 1, translate: '0 0' },
        ],
        { duration: D16_T.table, delay: D16_T.tableDelay, easing: EASE.cubicOut },
      ),
      ...Array.from(root.querySelectorAll<HTMLElement>('.d16-table__row'), (row, i) =>
        play(
          row,
          [
            { opacity: 0, translate: '0 calc(4 * var(--d16-px))' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: D16_T.rows, delay: D16_T.rowsDelay + i * D16_T.rowsStagger, easing: EASE.cubicOut },
        ),
      ),
    ]
    return () => anims.forEach((a) => a?.cancel())
  }, [intro])

  return (
    <GlassPanel as="section" ref={ref} className={cx('d16-table', className)}>
      <p className="d16-table__summary">
        <b>{summary.split(' · ')[0]}</b> · <b className="is-strong">{summary.split(' · ')[1]}</b>
      </p>
      <div className="d16-table__head d16-table__grid" role="row">
        <span className="d16-check" aria-hidden />
        <span>Order</span>
        <span>Customer</span>
        <span>Items</span>
        <span>
          Placed <ChevronDown className="d16-table__sort" strokeWidth={2} aria-hidden />
        </span>
        <span>Channel</span>
        <span className="is-right">
          Total <ArrowUpDown className="d16-table__sort" strokeWidth={2} aria-hidden />
        </span>
        <span>Status</span>
      </div>
      {orders.map((o) => {
        const status = D16_STATUS_LABEL[o.status]
        const n = o.items.reduce((s, item) => s + item.qty, 0)
        return (
          <div key={o.id} className="d16-table__row d16-table__grid d16-hov" role="row">
            <span className="d16-check" aria-hidden />
            <span className="d16-table__id">{o.id}</span>
            <span className="d16-table__customer">
              <Avatar initials={o.initials} hue={o.hue} size={11} />
              <span className="d16-table__who">
                <span className="d16-table__name">{o.customer}</span>
                <span className="d16-table__city">{o.city}</span>
              </span>
            </span>
            <span className="d16-table__items">
              <span className="d16-table__thumbs">
                {o.items.slice(0, 3).map((item, i) => (
                  <ItemThumb key={i} kind={item.kind} size={9} />
                ))}
              </span>
              {n} {n === 1 ? 'item' : 'items'}
            </span>
            <span className="d16-table__muted">{o.placed}</span>
            <span className="d16-table__muted">{o.channel}</span>
            <span className="d16-table__total is-right">{o.total}</span>
            <span>
              <StatusPill tone={status.tone}>{status.text}</StatusPill>
            </span>
          </div>
        )
      })}
    </GlassPanel>
  )
}
