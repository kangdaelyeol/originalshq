import { Video } from 'lucide-react'
import { cssVars } from './d15-format'

interface ReminderCardProps {
  title: string
  time: string
  action?: string
  index?: number
  onAction?: () => void
}

/** Reminders(F205 x413~526) — 짙은 강조색 굵은 제목 두 줄·시간·"Start Meeting" 알약 단추 */
export function ReminderCard({ title, time, action = 'Start Meeting', index = 5, onAction }: ReminderCardProps) {
  return (
    <section className="d15-card d15-reminder d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">Reminders</h3>
      <p className="d15-reminder__what">{title}</p>
      <p className="d15-reminder__time">{time}</p>
      <button type="button" className="d15-btn d15-btn--solid d15-reminder__go" onClick={onAction}>
        <Video aria-hidden strokeWidth={2.2} />
        {action}
      </button>
    </section>
  )
}
