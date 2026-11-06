import type { HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'
import type { ItemKind } from './design16-data'
import { GlassPanel } from './glass-panel'
import { ItemThumb } from './item-thumb'
import { PillButton } from './pill-button'
import { StockBar } from './stock-bar'

interface RunningLowCardProps extends HTMLAttributes<HTMLElement> {
  items: readonly { name: string; kind: ItemKind; left: number; reorder: number }[]
}

/** "Running low" 카드 — 상품 칸 13px·이름·"0 left · reorder at 40"·재고 막대·"Restock" */
export function RunningLowCard({ items, className, ...rest }: RunningLowCardProps) {
  return (
    <GlassPanel as="section" className={cx('d16-low', className)} {...rest}>
      <header className="d16-card-head">
        <div>
          <h2 className="d16-card-head__title">Running low</h2>
          <p className="d16-card-head__sub">At or below their reorder point</p>
        </div>
        <button type="button" className="d16-link d16-hov">
          Stock
        </button>
      </header>
      <ul className="d16-list">
        {items.map((item) => (
          <li key={item.name} className="d16-list__row" data-enter-row>
            <ItemThumb kind={item.kind} size={13} className="d16-low__thumb" />
            <span className="d16-list__text">
              <span className="d16-list__name">{item.name}</span>
              <span className="d16-list__sub">
                {item.left} left · reorder at {item.reorder}
              </span>
            </span>
            <StockBar left={item.left} reorder={item.reorder} />
            <PillButton variant="quiet" size="sm">
              Restock
            </PillButton>
          </li>
        ))}
      </ul>
    </GlassPanel>
  )
}
