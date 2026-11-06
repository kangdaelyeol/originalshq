import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { ComingUp, TodayAgenda } from './agenda-panels'
import { CalendarMonth } from './calendar-month'
import { D15_PAGE_HEAD, D15_TODAY } from './design15-data'
import { PageHead } from './page-head'

interface CalendarPageProps {
  weekStart: 0 | 1
}

/** Calendar(F545) — 달 칸·오늘·다가오는 일. "Today"는 이번 달로 돌아온다(F526 11월 → 10월) */
export function CalendarPage({ weekStart }: CalendarPageProps) {
  const [cursor, setCursor] = useState({ y: D15_TODAY.y, m: D15_TODAY.m })
  const shift = (step: number) =>
    setCursor((c) => {
      const m = c.m + step
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  const head = D15_PAGE_HEAD.calendar
  return (
    <div className="d15-calendar">
      <PageHead
        title={head.title}
        sub={head.sub}
        actions={
          <button
            type="button"
            className="d15-btn d15-btn--ghost"
            onClick={() => setCursor({ y: D15_TODAY.y, m: D15_TODAY.m })}
            data-tour="cal-today"
          >
            <CalendarDays aria-hidden strokeWidth={2} />
            Today
          </button>
        }
      />
      <div className="d15-calendar__grid">
        <CalendarMonth
          year={cursor.y}
          month={cursor.m}
          weekStart={weekStart}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
        />
        <div className="d15-calendar__side">
          <TodayAgenda />
          <ComingUp />
        </div>
      </div>
    </div>
  )
}
