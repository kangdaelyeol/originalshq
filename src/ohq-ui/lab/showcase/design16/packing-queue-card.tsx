import { Package } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import type { OrderData } from './design16-data'
import { GlassPanel } from './glass-panel'
import { PillButton } from './pill-button'

interface PackingQueueCardProps extends HTMLAttributes<HTMLElement> {
  orders: readonly OrderData[]
  onPacked?: (id: string) => void
  onOpenBoard?: () => void
}

/** "Packing queue" 카드 — 포장할 주문 줄(아바타 10px·이름·번호·금액·"Packed" 단추), 25px 간격 */
export function PackingQueueCard({ orders, onPacked, onOpenBoard, className, ...rest }: PackingQueueCardProps) {
  return (
    <GlassPanel as="section" className={cx('d16-queue', className)} {...rest}>
      <header className="d16-card-head">
        <div>
          <h2 className="d16-card-head__title">Packing queue</h2>
          <p className="d16-card-head__sub">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} paid and waiting
          </p>
        </div>
        <button type="button" className="d16-link d16-hov" onClick={onOpenBoard}>
          Board
        </button>
      </header>
      <ul className="d16-list">
        {orders.map((o) => (
          <li key={o.id} className="d16-list__row" data-enter-row>
            <Avatar initials={o.initials} hue={o.hue} />
            <span className="d16-list__text">
              <span className="d16-list__name">{o.customer}</span>
              <span className="d16-list__sub">
                {o.id} · {o.items.length} items
              </span>
            </span>
            <span className="d16-list__value">{o.total}</span>
            <PillButton variant="quiet" size="sm" icon={Package} onClick={() => onPacked?.(o.id)}>
              Packed
            </PillButton>
          </li>
        ))}
        {orders.length === 0 && <li className="d16-list__empty">All packed — nice.</li>}
      </ul>
    </GlassPanel>
  )
}
