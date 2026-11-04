import type { CSSProperties } from 'react'
import { WaterEmpty } from '@/ohq-ui/water/surfaces/water-empty'
import { WaterFlag } from '@/ohq-ui/water/surfaces/water-flag'
import type { MiniListItem } from '../../board/mini-list'

/**
 * 짧은 목록(D7) — MiniList와 같은 props. 이름 · 한 줄 설명 · 오른쪽 값. 바로 챙길 값(alert)은 빨간 점 칩
 * (색은 점에만, 글자는 짙은 잉크). 줄은 위에서부터 21ms 간격으로 진해지고, 마우스·초점에 흰 칩이 깔린다.
 */
export function WaterMiniList({ items, empty }: { items: readonly MiniListItem[]; empty: string }) {
  if (items.length === 0) return <WaterEmpty title={empty} />
  return (
    <ul className="water-mini">
      {items.map((item, i) => (
        <li key={item.key} className="water-reveal" style={{ '--w-i': i } as CSSProperties}>
          <button type="button" className="water-mini__row" onClick={item.onSelect}>
            <span className="water-mini__body">
              <span className="water-mini__title">{item.title}</span>
              {item.meta && <span className="water-mini__meta">{item.meta}</span>}
            </span>
            {item.value &&
              (item.alert ? (
                <WaterFlag tone="crit" className="water-mini__value">
                  {item.value}
                </WaterFlag>
              ) : (
                <span className="water-mini__value">{item.value}</span>
              ))}
          </button>
        </li>
      ))}
    </ul>
  )
}
