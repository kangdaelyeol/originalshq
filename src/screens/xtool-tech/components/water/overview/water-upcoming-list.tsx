import type { CSSProperties } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterEmpty } from '@/ohq-ui/water/surfaces/water-empty'
import { daysBetween, relativeDay } from '../../../lib/dates'
import type { UpcomingItem } from '../../board/upcoming-list'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

interface WaterUpcomingListProps {
  items: readonly UpcomingItem[]
  today: string
  empty: string
  /** due: 다가오는 날(지난 날짜는 빨간 점) · since: 시작한 날부터 며칠째 */
  mode?: 'due' | 'since'
}

/**
 * 날짜순 일정(D7) — UpcomingList와 같은 props. 왼쪽 날짜 칸은 불투명 유리 타일(D7 단추 속), 오늘은 어두운 표시
 * 알약(D7 고른 것)에 흰 글자, 지난 날은 빨간 점(글자는 짙은 잉크 — 회색 벽 위 상태 색은 점에만). 줄은 위에서부터
 * 21ms 간격으로 55ms 동안 진해지고(D7 아이콘 차례), 누를 수 있는 줄은 마우스·초점에 흰 칩이 깔린다.
 */
export function WaterUpcomingList({ items, today, empty, mode = 'due' }: WaterUpcomingListProps) {
  if (items.length === 0) return <WaterEmpty title={empty} />
  return (
    <ul className="water-upcoming">
      {items.map((item, i) => {
        const [, m, d] = item.date.split('-')
        const weekday = WEEKDAY[new Date(`${item.date}T00:00:00Z`).getUTCDay()]
        const overdue = mode === 'due' && item.date < today
        const isToday = item.date === today
        return (
          <li key={item.key} className="water-reveal" style={{ '--w-i': i } as CSSProperties}>
            <button type="button" className="water-upcoming__row" onClick={item.onSelect}>
              <span className={cx('water-upcoming__date', overdue && 'is-overdue', isToday && 'is-today')}>
                <strong>
                  {Number(m)}/{Number(d)}
                </strong>
                <small>{weekday}</small>
              </span>
              <span className="water-upcoming__body">
                <span className="water-upcoming__title">{item.title}</span>
                {item.meta && <span className="water-upcoming__meta">{item.meta}</span>}
              </span>
              <span className={cx('water-upcoming__when', overdue && 'is-overdue', mode === 'since' && 'is-since')}>
                {overdue && <span className="water-upcoming__dot" aria-hidden />}
                {mode === 'since' ? `${daysBetween(item.date, today)}일째` : relativeDay(item.date, today)}
                {overdue && <span className="sr-only"> (지남)</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
