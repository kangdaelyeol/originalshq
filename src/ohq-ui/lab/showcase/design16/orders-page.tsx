import { Download, Plus } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import {
  D16_LANES,
  D16_ORDER_FILTERS,
  D16_ORDERS,
  D16_ORDERS_SUB,
  D16_ORDERS_TITLE,
  D16_RETURNS,
  D16_TABLE_SUM,
  type OrderStatus,
  type OrdersTab,
} from './design16-data'
import { FilterChips } from './filter-chips'
import { GlassPanel } from './glass-panel'
import { OrdersTable } from './orders-table'
import { PackingBoard } from './packing-board'
import { PillButton } from './pill-button'
import { RiseTitle } from './rise-title'
import { SearchField } from './search-field'
import { SelectPill } from './select-pill'
import { TabBar, type TabData } from './tab-bar'
import { useExitSwap } from './use-exit-swap'

interface OrdersPageProps {
  tab: OrdersTab
  onTabChange?: (next: OrdersTab) => void
  columns: Record<OrderStatus, string[]>
  onMove: (id: string, from: OrderStatus, to: OrderStatus) => void
  floatLayer?: RefObject<HTMLElement | null>
}

/**
 * Orders 페이지 — 큰 제목(글자마다 오른다)·부제·Export/New order, 탭(All orders / Packing board / Returns),
 * 그 아래 표 또는 칸반. 탭을 바꾸면 제목·밑줄·내용이 0.1초에 빠졌다가 새로 붙는다(영상 F106~F129).
 */
export function OrdersPage({ tab, onTabChange, columns, onMove, floatLayer }: OrdersPageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const shown = useExitSwap(tab, rootRef, '[data-route-exit], .d16-tabs__line')
  const [filter, setFilter] = useState('all')
  const toPack = columns['to-pack'].length

  const tabs: TabData<OrdersTab>[] = [
    { key: 'all', label: 'All orders' },
    { key: 'board', label: 'Packing board', count: toPack },
    { key: 'returns', label: 'Returns', count: D16_RETURNS },
  ]

  return (
    <div className="d16-orders" ref={rootRef}>
      <header className="d16-orders__head">
        <div>
          <div data-route-exit key={`title-${shown}`}>
            <RiseTitle className="d16-orders__title" text={D16_ORDERS_TITLE} />
          </div>
          <p className="d16-orders__sub">{D16_ORDERS_SUB}</p>
        </div>
        <div className="d16-orders__actions">
          <PillButton variant="glass" icon={Download}>
            Export
          </PillButton>
          <PillButton icon={Plus}>New order</PillButton>
        </div>
      </header>
      <TabBar key={`tabs-${shown}`} className="d16-orders__tabs" tabs={tabs} value={shown} onChange={onTabChange} />
      <div className="d16-orders__content" data-route-exit key={`content-${shown}`}>
        {shown === 'all' && (
          <>
            <div className="d16-orders__tools">
              <SearchField className="d16-orders__search" placeholder="Search order, customer or product" />
              <SelectPill label="All channels" />
              <SelectPill label="Last 30 days" />
            </div>
            <FilterChips className="d16-orders__chips" chips={D16_ORDER_FILTERS} value={filter} onChange={setFilter} />
            <OrdersTable orders={D16_ORDERS.slice(0, 6)} summary={D16_TABLE_SUM} />
          </>
        )}
        {shown === 'board' && (
          <PackingBoard lanes={D16_LANES} columns={columns} onMove={onMove} floatLayer={floatLayer} />
        )}
        {shown === 'returns' && (
          <GlassPanel className="d16-orders__returns">
            <p>{D16_RETURNS} returns are waiting for a label.</p>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}
