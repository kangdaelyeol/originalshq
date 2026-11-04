import { useState, type CSSProperties } from 'react'
import type { ShareItem } from '../../charts/share-bar'
import { cx } from '../../lib/cx'
import { percentages } from '../../lib/format'
import { useWaterFill } from './use-water-fill'

interface WaterShareBarProps {
  items: readonly ShareItem[]
  ariaLabel: string
}

interface SegmentProps {
  item: ShareItem
  /** 이 조각 끝 자리(앞 조각들까지 더한 비율) */
  end: number
  index: number
  count: number
  dimmed: boolean
  onHover: (key: string | null) => void
}

/**
 * 비중 조각 하나 — 왼쪽 끝부터 제 끝(end)까지 뻗은 알약. 앞 조각이 위에 놓여 이 조각은 [앞 끝, 제 끝]만 보인다
 * (넓이가 값에 비례 — 같은 높이 알약 둘의 차). 끝 사이 2px 틈은 위 조각이 오른쪽으로 2px 비킨 그림자(홈 색)로.
 */
function Segment({ item, end, index, count, dimmed, onHover }: SegmentProps) {
  const fill = useWaterFill<HTMLSpanElement>(end, index)
  return (
    <span
      ref={fill}
      className={cx(
        'water-share__seg',
        index === count - 1 && 'is-last',
        item.key === '__other' && 'is-other',
        dimmed && 'is-dimmed',
      )}
      style={{ '--w-fill': item.color, zIndex: count - index } as CSSProperties}
      onPointerEnter={() => onHover(item.key)}
      onPointerLeave={() => onHover(null)}
    />
  )
}

/**
 * 100% 비중 막대 + 범례(D7) — ShareBar와 같은 props. 홈 안에 조각마다 색 알약이 왼쪽부터 21ms 간격으로
 * extend 스프링(16% 넘침)으로 차오른다. 조각·범례에 마우스를 올리거나 범례에 초점을 두면 나머지가 흐려지고
 * 작은 유리 판(툴팁)이 그 조각 위에 뜬다. 범례에 이름과 %가 늘 적혀 있다(툴팁에 기대지 않는다).
 */
export function WaterShareBar({ items, ariaLabel }: WaterShareBarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const pcts = percentages(items.map((item) => item.value))
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  // 조각 끝 자리 — 앞 조각들까지 더한 비율
  const ends = items.reduce<number[]>((list, item) => {
    const before = list.length ? list[list.length - 1] * total : 0
    list.push(total > 0 ? (before + Math.max(0, item.value)) / total : 0)
    return list
  }, [])
  const hi = items.findIndex((item) => item.key === hovered)
  const mid = hi < 0 ? 0 : ((hi > 0 ? ends[hi - 1] : 0) + ends[hi]) / 2
  // 툴팁이 막대 밖으로 나가지 않게 — 왼쪽 끝 근처는 오른쪽으로, 오른쪽 끝 근처는 왼쪽으로 편다
  const shift = mid < 0.18 ? '0%' : mid > 0.82 ? '-100%' : '-50%'

  return (
    <div className="water-share">
      <div
        className="water-share__bar"
        role="img"
        aria-label={`${ariaLabel} — ${items.map((item, i) => `${item.label} ${pcts[i]}%`).join(', ')}`}
      >
        <span className="water-share__clip">
          {items.map((item, i) => (
            <Segment
              key={item.key}
              item={item}
              end={ends[i]}
              index={i}
              count={items.length}
              dimmed={hovered !== null && hovered !== item.key}
              onHover={setHovered}
            />
          ))}
        </span>
        {hi >= 0 && (
          <div
            className="water-tip water-tip--above is-on"
            style={{ left: `${mid * 100}%`, transform: `translateX(${shift})` }}
            aria-hidden
          >
            <p className="water-tip__row">
              <span className="water-tip__key" style={{ background: items[hi].color }} />
              <strong>{pcts[hi]}%</strong>
              <span>{items[hi].label}</span>
            </p>
          </div>
        )}
      </div>

      <ul className="water-legend">
        {items.map((item, i) => (
          <li
            key={item.key}
            className={cx(
              'water-legend__row',
              item.key === '__other' && 'is-other',
              hovered === item.key && 'is-active',
            )}
            tabIndex={0}
            onPointerEnter={() => setHovered(item.key)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.key)}
            onBlur={() => setHovered(null)}
          >
            <span className="water-legend__swatch" style={{ '--w-fill': item.color } as CSSProperties} aria-hidden />
            <span className="water-legend__label">{item.label}</span>
            <span className="water-legend__value">{pcts[i]}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
