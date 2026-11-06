import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { cssVars } from './d15-format'
import { D15_EVENT_KINDS, D15_EVENTS, D15_TODAY, type D15EventKind } from './design15-data'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

interface CalendarMonthProps {
  year: number
  /** 0~11 */
  month: number
  /** 0 일요일 · 1 월요일(설정 "Week starts on") */
  weekStart?: 0 | 1
  onPrev?: () => void
  onNext?: () => void
  index?: number
}

interface Cell {
  key: string
  day: number
  inMonth: boolean
  today: boolean
  events: readonly { title: string; kind: D15EventKind }[]
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function buildCells(year: number, month: number, weekStart: 0 | 1): Cell[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const lead = (first - weekStart + 7) % 7
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const total = Math.ceil((lead + days) / 7) * 7
  const cells: Cell[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, month, 1 - lead + i))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const day = d.getUTCDate()
    const key = iso(y, m, day)
    cells.push({
      key,
      day,
      inMonth: m === month,
      today: y === D15_TODAY.y && m === D15_TODAY.m && day === D15_TODAY.d,
      events: m === month ? D15_EVENTS.filter((e) => e.date === key) : [],
    })
  }
  return cells
}

/**
 * 달 칸(F545: 7열·칸 둥근 회색, 오늘은 강조색 테두리와 동그라미 숫자) — 일정은 종류별 색 꼬리표(칸 폭에서 말줄임).
 * 달을 바꾸면 옛 칸은 바로 비고 새 칸이 0.1초 뒤 0.2초에 한꺼번에 나타난다(F526.5 누름 → F529.5~F536).
 */
export function CalendarMonth({ year, month, weekStart = 0, onPrev, onNext, index = 1 }: CalendarMonthProps) {
  const cells = buildCells(year, month, weekStart)
  const names = weekStart === 1 ? [...DAYS.slice(1), DAYS[0]] : DAYS
  return (
    <section className="d15-card d15-month d15-rise" style={cssVars({ '--i': index })}>
      <header className="d15-month__head">
        <h3 className="d15-month__title">
          {MONTHS[month]} {year}
        </h3>
        <div className="d15-month__nav">
          <button
            type="button"
            className="d15-icon-btn"
            aria-label="Previous month"
            onClick={onPrev}
            data-tour="cal-prev"
          >
            <ChevronLeft aria-hidden strokeWidth={2.2} />
          </button>
          <button type="button" className="d15-icon-btn" aria-label="Next month" onClick={onNext} data-tour="cal-next">
            <ChevronRight aria-hidden strokeWidth={2.2} />
          </button>
        </div>
      </header>
      <div className="d15-month__days">
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div key={`${year}-${month}-${weekStart}`} className="d15-month__grid">
        {cells.map((c) => (
          <div key={c.key} className={cx('d15-month__cell', !c.inMonth && 'is-out', c.today && 'is-today')}>
            <span className="d15-month__num">{c.day}</span>
            {c.events.slice(0, 2).map((e) => (
              <span key={e.title} className={cx('d15-chip', `is-${e.kind}`)}>
                {e.title}
              </span>
            ))}
          </div>
        ))}
      </div>
      <ul className="d15-month__legend">
        {D15_EVENT_KINDS.map((k) => (
          <li key={k.kind}>
            <i className={`is-${k.kind}`} />
            {k.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
