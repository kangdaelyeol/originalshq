import { ArrowRight } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cx } from '../../../lib/cx'
import { Avatar } from './avatar'
import type { OrderData } from './design16-data'
import { ItemThumb } from './item-thumb'

interface OrderCardProps {
  order: OrderData
  /** 끌기 시작(칸반이 넘긴다) */
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  /** lifted: 끄는 동안 제자리에 흐리게 남은 원래 카드(F145~F160 글자 최대 90/226) · ghost: 끄는 유령 모습 그대로 */
  state?: 'rest' | 'lifted' | 'ghost'
  className?: string
}

/**
 * 칸반 주문 카드(109×83, 상품 셋이면 96.5) — 번호(굵게)·시각, 아바타·이름, 상품 줄(12.8px 간격),
 * 금액·경로 칩·화살표 단추. 판 위의 판이라 흐림 없이 밝은 막만 깐다. 올리면 막이 어두워진다(F132 → F133, 24,31,35 → 11,17,27).
 */
export function OrderCard({ order, onPointerDown, state = 'rest', className }: OrderCardProps) {
  return (
    <article
      className={cx(
        'd16-ocard',
        'd16-hov',
        state === 'lifted' && 'is-lifted',
        state === 'ghost' && 'd16-ocard--ghost is-static',
        className,
      )}
      data-id={order.id}
      onPointerDown={onPointerDown}
    >
      <header className="d16-ocard__head">
        <b className="d16-ocard__id">{order.id}</b>
        <span className="d16-ocard__when">{order.when}</span>
      </header>
      <p className="d16-ocard__who">
        <Avatar initials={order.initials} hue={order.hue} size={11.8} />
        {order.customer}
      </p>
      <ul className="d16-ocard__items">
        {order.items.map((item, i) => (
          <li key={i}>
            <ItemThumb kind={item.kind} />
            {item.qty}× {item.name}
          </li>
        ))}
      </ul>
      <footer className="d16-ocard__foot">
        <b className="d16-ocard__total">{order.total}</b>
        <span className="d16-ocard__chip">{order.channel}</span>
        <button type="button" className="d16-ocard__go d16-hov" aria-label={`Open ${order.id}`}>
          <ArrowRight strokeWidth={2} aria-hidden />
        </button>
      </footer>
    </article>
  )
}
