import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSchedule, type ScheduleEvent, type ScheduleSources } from '../../data/schedule'
import { daysBetween, koreaToday, shortDate } from '../../lib/dates'
import { cx } from '@/ohq-ui/lib/cx'
import { xtPath } from '../../paths'
import { GlassCard, SegmentedControl } from '../layout-parts'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

type Scope = 'team' | 'me'

const dayLabel = (date: string, today: string) => {
  const weekday = WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const diff = daysBetween(today, date)
  const rel = diff === 0 ? '오늘' : diff === 1 ? '내일' : null
  return { rel, text: `${shortDate(date)} (${weekday})` }
}

/** 오늘·이번 주 일정 — 오늘부터 7일, 날짜별. 팀 전체 / 나. */
export function ScheduleCard({
  sources,
  myNames,
  loading,
}: {
  sources: ScheduleSources
  myNames: ReadonlySet<string>
  loading: boolean
}) {
  const [scope, setScope] = useState<Scope>('team')
  const [showOverdue, setShowOverdue] = useState(false)
  const today = koreaToday()
  const schedule = buildSchedule(sources, today, scope === 'me' ? myNames : null)
  const total = schedule.days.reduce((sum, d) => sum + d.events.length, 0)

  return (
    <GlassCard
      title="오늘·이번 주 일정"
      subtitle={loading ? '불러오는 중…' : `${total}건`}
      actions={
        <SegmentedControl
          ariaLabel="일정 범위"
          options={[
            { value: 'team' as Scope, label: '팀 전체' },
            { value: 'me' as Scope, label: '나' },
          ]}
          value={scope}
          onChange={setScope}
        />
      }
      className="schedule"
    >
      {schedule.overdue.length > 0 && (
        <div className="schedule__overdue">
          <button type="button" className="schedule__overdue-head" aria-expanded={showOverdue} onClick={() => setShowOverdue((v) => !v)}>
            지난 일정 {schedule.overdue.length}건 — 날짜가 지났는데 아직 안 끝남
            <ChevronDown size={14} className={cx('king-rank__chev', showOverdue && 'is-open')} aria-hidden />
          </button>
          {showOverdue && (
            <ul className="schedule__events">
              {schedule.overdue.map((e) => (
                <EventRow key={e.key} event={e} showDate />
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="schedule__days">
        {schedule.days.map(({ date, events }) => {
          const label = dayLabel(date, today)
          return (
            <li key={date} className={cx('schedule__day', label.rel === '오늘' && 'is-today', events.length === 0 && 'is-empty')}>
              <p className="schedule__date">
                {label.rel && <strong>{label.rel}</strong>}
                {label.text}
                {events.length > 0 && <span>{events.length}건</span>}
              </p>
              {events.length > 0 ? (
                <ul className="schedule__events">
                  {events.map((e) => (
                    <EventRow key={e.key} event={e} />
                  ))}
                </ul>
              ) : (
                <p className="schedule__none">일정 없음</p>
              )}
            </li>
          )
        })}
      </ol>
    </GlassCard>
  )
}

function EventRow({ event, showDate }: { event: ScheduleEvent; showDate?: boolean }) {
  return (
    <li>
      <Link className="schedule__event" to={`${xtPath(`/boards/${event.slug}`)}?item=${event.itemId}`}>
        <span className="schedule__time">{showDate ? shortDate(event.date) : (event.time ?? '종일')}</span>
        <span className={cx('schedule__kind', `is-${event.boardKey}`)}>{event.kind}</span>
        <span className="schedule__body">
          <span className="schedule__title">{event.title || '(이름 없음)'}</span>
          {event.meta && <span className="schedule__meta">{event.meta}</span>}
        </span>
      </Link>
    </li>
  )
}
