import { cx } from '../../../lib/cx'
import { AvatarStack } from './avatar'
import { cssVars } from './d15-format'
import { D15_COMING_UP, D15_TODAY_AGENDA } from './design15-data'

/** 오늘 일정(F545 오른쪽 위) — "TODAY · FRIDAY"·"October 9"·종류 색 왼쪽 줄이 있는 일정 두 개 */
export function TodayAgenda({
  weekday = 'Friday',
  date = 'October 9',
  index = 2,
}: {
  weekday?: string
  date?: string
  index?: number
}) {
  return (
    <section className="d15-card d15-today d15-rise" style={cssVars({ '--i': index })}>
      <p className="d15-today__kicker">Today · {weekday}</p>
      <h3 className="d15-today__date">{date}</h3>
      <ul className="d15-today__list">
        {D15_TODAY_AGENDA.map((e) => (
          <li key={e.title} className={cx('d15-today__item', `is-${e.kind}`)}>
            <span className="d15-today__time">
              {e.start}
              <small>{e.end}</small>
            </span>
            <span className="d15-today__what">
              <b>{e.title}</b>
              <small>{e.label}</small>
              <AvatarStack people={e.people} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Coming up(F545 오른쪽 아래) — 날짜 딱지(OCT/9)·제목·"Today · 10:00 am" */
export function ComingUp({ index = 3 }: { index?: number }) {
  return (
    <section className="d15-card d15-coming d15-rise" style={cssVars({ '--i': index })}>
      <h3 className="d15-card__title">Coming up</h3>
      <ul className="d15-coming__list">
        {D15_COMING_UP.map((e, k) => (
          <li key={e.title} className="d15-coming__item" style={cssVars({ '--k': k })}>
            <span className="d15-coming__badge">
              <small>OCT</small>
              {e.day}
            </span>
            <span className="d15-coming__what">
              <b>{e.title}</b>
              <small>{e.when}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
