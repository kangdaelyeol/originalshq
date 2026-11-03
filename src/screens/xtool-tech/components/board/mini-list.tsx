import { cx } from '@/ohq-ui/lib/cx'

export interface MiniListItem {
  key: string
  title: string
  meta?: string
  /** 오른쪽 값(재고 수 등) */
  value?: string
  alert?: boolean
  onSelect?: () => void
}

/** 짧은 목록 — 이름 · 한 줄 설명 · 오른쪽 값. 재고 부족·중복 SN처럼 바로 챙길 것. */
export function MiniList({ items, empty }: { items: readonly MiniListItem[]; empty: string }) {
  if (items.length === 0) return <p className="bar-list__empty">{empty}</p>
  return (
    <ul className="mini-list">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" className="mini-list__row" onClick={item.onSelect}>
            <span className="mini-list__body">
              <span className="mini-list__title">{item.title}</span>
              {item.meta && <span className="mini-list__meta">{item.meta}</span>}
            </span>
            {item.value && <span className={cx('mini-list__value', item.alert && 'is-alert')}>{item.value}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
