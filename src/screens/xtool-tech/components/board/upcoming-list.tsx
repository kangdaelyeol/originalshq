import { daysBetween, relativeDay } from '@xtool-core/dates'
import { cx } from '@/ohq-ui/lib/cx'

export interface UpcomingItem {
  key: string
  date: string
  title: string
  meta?: string
  onSelect?: () => void
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

interface UpcomingListProps {
  items: readonly UpcomingItem[]
  today: string
  empty: string
  /** due: 다가오는 날(지난 날짜는 빨갛게) · since: 시작한 날부터 며칠째 */
  mode?: 'due' | 'since'
}

/** 날짜순 일정 — 왼쪽 날짜 칸(월/일·요일) + 이름 + 한 줄 설명. */
export function UpcomingList({ items, today, empty, mode = 'due' }: UpcomingListProps) {
  if (items.length === 0) return <p className="bar-list__empty">{empty}</p>
  return (
    <ul className="upcoming">
      {items.map((item) => {
        const [, m, d] = item.date.split('-')
        const weekday = WEEKDAY[new Date(`${item.date}T00:00:00Z`).getUTCDay()]
        const overdue = mode === 'due' && item.date < today
        return (
          <li key={item.key}>
            <button type="button" className="upcoming__row" onClick={item.onSelect}>
              <span className={cx('upcoming__date', overdue && 'is-overdue', item.date === today && 'is-today')}>
                <strong>
                  {Number(m)}/{Number(d)}
                </strong>
                <small>{weekday}</small>
              </span>
              <span className="upcoming__body">
                <span className="upcoming__title">{item.title}</span>
                {item.meta && <span className="upcoming__meta">{item.meta}</span>}
              </span>
              <span className={cx('upcoming__when', overdue && 'is-overdue', mode === 'since' && 'is-since')}>
                {mode === 'since' ? `${daysBetween(item.date, today)}일째` : relativeDay(item.date, today)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
