import { CircleCheck, CircleX, GitMerge, TriangleAlert } from 'lucide-react'
import type { ActivityItem } from '../../data/overview'
import { cx } from '../../lib/cx'

const TONE_ICON = {
  good: CircleCheck,
  info: GitMerge,
  warn: TriangleAlert,
  crit: CircleX,
} as const

const TONE_LABEL = { good: '완료', info: '알림', warn: '경고', crit: '실패' } as const

export function ActivityLog({ items }: { items: readonly ActivityItem[] }) {
  return (
    <ul className="activity">
      {items.map((item) => {
        const Icon = TONE_ICON[item.tone]
        return (
          <li key={item.id} className="activity__item">
            <span className={cx('activity__icon', `activity__icon--${item.tone}`)}>
              <Icon size={15} strokeWidth={2.2} aria-label={TONE_LABEL[item.tone]} />
            </span>
            <div>
              <p className="activity__title">{item.title}</p>
              <p className="activity__time">{item.time}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
