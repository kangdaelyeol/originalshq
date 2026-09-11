import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  fromISO,
  startOfMonth,
  todayISO,
  toISO,
} from '../utils'
import type { ISODate } from '../types'
import '../styles/date-range-picker.scss'

interface DateRangePickerProps {
  dateStart: ISODate
  dateEnd: ISODate
  onChange: (start: ISODate, end: ISODate) => void
  disabled?: boolean
}

interface Preset {
  key: string
  label: string
  range: () => [ISODate, ISODate]
}

const CUSTOM_KEY = 'custom'

/** GA 스타일 날짜 프리셋 — "지난 N일"은 오늘을 포함해서 센다(기존 조회 로직과 동일). */
const PRESETS: readonly Preset[] = [
  {
    key: 'today',
    label: '오늘',
    range: () => [todayISO(), todayISO()],
  },
  {
    key: 'yesterday',
    label: '어제',
    range: () => {
      const y = addDays(todayISO(), -1)
      return [y, y]
    },
  },
  {
    key: 'today_yesterday',
    label: '오늘과 어제',
    range: () => [addDays(todayISO(), -1), todayISO()],
  },
  {
    key: 'last7',
    label: '지난 7일',
    range: () => [addDays(todayISO(), -6), todayISO()],
  },
  {
    key: 'last14',
    label: '지난 14일',
    range: () => [addDays(todayISO(), -13), todayISO()],
  },
  {
    key: 'last28',
    label: '지난 28일',
    range: () => [addDays(todayISO(), -27), todayISO()],
  },
  {
    key: 'last30',
    label: '지난 30일',
    range: () => [addDays(todayISO(), -29), todayISO()],
  },
  {
    key: 'this_week',
    label: '이번 주',
    range: () => {
      const t = todayISO()
      const dow = fromISO(t).getUTCDay()
      return [addDays(t, -dow), t]
    },
  },
  {
    key: 'last_week',
    label: '지난 주',
    range: () => {
      const t = todayISO()
      const dow = fromISO(t).getUTCDay()
      const thisWeekStart = addDays(t, -dow)
      const end = addDays(thisWeekStart, -1)
      return [addDays(end, -6), end]
    },
  },
  {
    key: 'this_month',
    label: '이번 달',
    range: () => [startOfMonth(todayISO()), todayISO()],
  },
  {
    key: 'last_month',
    label: '지난 달',
    range: () => {
      const end = addDays(startOfMonth(todayISO()), -1)
      return [startOfMonth(end), end]
    },
  },
]

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`)

function matchPreset(start: ISODate, end: ISODate): string {
  const found = PRESETS.find((p) => {
    const [s, e] = p.range()
    return s === start && e === end
  })
  return found?.key ?? CUSTOM_KEY
}

function formatDisplay(iso: ISODate): string {
  return iso.replaceAll('-', '.')
}

/** monthStart(해당 월 1일) 기준 6행 캘린더 그리드. 이전/다음 달로 채우지 않고
 * 빈 칸으로 둔다 — 참고 이미지의 달력도 그렇게 생겼다. */
function buildMonthGrid(monthStart: ISODate): (ISODate | null)[] {
  const d = fromISO(monthStart)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const firstWeekday = d.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (ISODate | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISO(new Date(Date.UTC(year, month, day))))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowIcon({ dir }: { dir: 'left' | 'right' }) {
  const d = dir === 'left' ? 'M12.5 5 7.5 10 12.5 15' : 'M7.5 5 12.5 10 7.5 15'
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x={3}
        y={4.5}
        width={14}
        height={12}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.4}
      />
      <path d="M3 8h14" stroke="currentColor" strokeWidth={1.4} />
      <path
        d="M6.5 3v3M13.5 3v3"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  )
}

interface MonthCalendarProps {
  monthStart: ISODate
  rangeLo: ISODate
  rangeHi: ISODate
  yearOptions: readonly number[]
  onSelectMonth: (monthStart: ISODate) => void
  onDayClick: (day: ISODate) => void
  onDayHover: (day: ISODate | null) => void
}

function MonthCalendar({
  monthStart,
  rangeLo,
  rangeHi,
  yearOptions,
  onSelectMonth,
  onDayClick,
  onDayHover,
}: MonthCalendarProps) {
  const cells = useMemo(() => buildMonthGrid(monthStart), [monthStart])
  const d = fromISO(monthStart)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const today = todayISO()

  return (
    <div className="date-range-picker__month">
      <div className="date-range-picker__month-head">
        <select
          className="date-range-picker__month-select"
          value={month}
          onChange={(e) =>
            onSelectMonth(
              toISO(new Date(Date.UTC(year, Number(e.target.value), 1))),
            )
          }
        >
          {MONTH_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="date-range-picker__month-select"
          value={year}
          onChange={(e) =>
            onSelectMonth(
              toISO(new Date(Date.UTC(Number(e.target.value), month, 1))),
            )
          }
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      <div className="date-range-picker__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div
        className="date-range-picker__grid"
        onPointerLeave={() => onDayHover(null)}
      >
        {cells.map((day, i) => {
          if (!day) {
            return (
              <span
                key={`empty-${i}`}
                className="date-range-picker__cell is-empty"
              />
            )
          }
          const inRange = day >= rangeLo && day <= rangeHi
          const isStart = day === rangeLo
          const isEnd = day === rangeHi
          const isFuture = day > today
          return (
            <button
              key={day}
              type="button"
              className={[
                'date-range-picker__cell',
                inRange && 'is-in-range',
                isStart && 'is-start',
                isEnd && 'is-end',
                day === today && 'is-today',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={isFuture}
              onClick={() => onDayClick(day)}
              onPointerEnter={() => onDayHover(day)}
            >
              <span className="date-range-picker__cell-num">
                {Number(day.slice(-2))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const DateRangePicker = ({
  dateStart,
  dateEnd,
  onChange,
  disabled = false,
}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(dateStart)
  const [draftEnd, setDraftEnd] = useState(dateEnd)
  // true인 동안은 "시작일은 정했고 끝나는 날을 고르는 중" — 다음 클릭이 끝나는 날이 된다.
  const [pickingEnd, setPickingEnd] = useState(false)
  const [hoverDay, setHoverDay] = useState<ISODate | null>(null)
  const [rightMonthStart, setRightMonthStart] = useState(() =>
    startOfMonth(dateEnd),
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const openPopover = () => {
    setDraftStart(dateStart)
    setDraftEnd(dateEnd)
    setPickingEnd(false)
    setHoverDay(null)
    setRightMonthStart(startOfMonth(dateEnd))
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const activeKey = matchPreset(draftStart, draftEnd)

  const applyPreset = (p: Preset) => {
    const [s, e] = p.range()
    setDraftStart(s)
    setDraftEnd(e)
    setPickingEnd(false)
    setHoverDay(null)
    setRightMonthStart(startOfMonth(e))
  }

  const handleDayClick = (day: ISODate) => {
    if (!pickingEnd) {
      setDraftStart(day)
      setDraftEnd(day)
      setPickingEnd(true)
    } else {
      if (day < draftStart) {
        setDraftEnd(draftStart)
        setDraftStart(day)
      } else {
        setDraftEnd(day)
      }
      setPickingEnd(false)
      setHoverDay(null)
    }
  }

  const handleTypedStart = (value: ISODate) => {
    setDraftStart(value)
    if (value > draftEnd) setDraftEnd(value)
    setPickingEnd(false)
  }

  const handleTypedEnd = (value: ISODate) => {
    setDraftEnd(value)
    if (value < draftStart) setDraftStart(value)
    setPickingEnd(false)
  }

  const handleApply = () => {
    onChange(draftStart, draftEnd)
    setOpen(false)
  }

  const leftMonthStart = addMonths(rightMonthStart, -1)

  const yearOptions = useMemo(() => {
    const y = fromISO(todayISO()).getUTCFullYear()
    return Array.from({ length: 6 }, (_, i) => y - 5 + i)
  }, [])

  // 드래그로 범위를 고르는 중이면 마우스가 지나간 지점까지 미리 보여준다.
  const [previewLo, previewHi]: [ISODate, ISODate] =
    pickingEnd && hoverDay
      ? hoverDay < draftStart
        ? [hoverDay, draftStart]
        : [draftStart, hoverDay]
      : [draftStart, draftEnd]

  const triggerPresetLabel =
    PRESETS.find((p) => p.key === activeKey)?.label ?? '직접 입력'

  return (
    <div className="date-range-picker" ref={containerRef}>
      <button
        type="button"
        className={`date-range-picker__trigger${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openPopover())}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="date-range-picker__trigger-icon">
          <CalendarIcon />
        </span>
        <span className="date-range-picker__trigger-label">
          {triggerPresetLabel}: {formatDisplay(dateStart)} –{' '}
          {formatDisplay(dateEnd)}
        </span>
        <span className="date-range-picker__trigger-chevron">
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div className="date-range-picker__popover">
          <div
            className="date-range-picker__presets"
            role="radiogroup"
            aria-label="기간 프리셋"
          >
            {PRESETS.map((p) => (
              <label key={p.key} className="date-range-picker__preset-item">
                <input
                  type="radio"
                  name="date-range-preset"
                  checked={activeKey === p.key}
                  onChange={() => applyPreset(p)}
                />
                {p.label}
              </label>
            ))}
            <label className="date-range-picker__preset-item">
              <input
                type="radio"
                name="date-range-preset"
                checked={activeKey === CUSTOM_KEY}
                onChange={() => setPickingEnd(false)}
              />
              직접 입력
            </label>
          </div>

          <div className="date-range-picker__calendar">
            <div className="date-range-picker__calendar-nav">
              <button
                type="button"
                className="date-range-picker__nav-btn"
                aria-label="이전 달"
                onClick={() =>
                  setRightMonthStart(addMonths(rightMonthStart, -1))
                }
              >
                <ArrowIcon dir="left" />
              </button>

              <div className="date-range-picker__months">
                <MonthCalendar
                  monthStart={leftMonthStart}
                  rangeLo={previewLo}
                  rangeHi={previewHi}
                  yearOptions={yearOptions}
                  onSelectMonth={(m) => setRightMonthStart(addMonths(m, 1))}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDay}
                />
                <MonthCalendar
                  monthStart={rightMonthStart}
                  rangeLo={previewLo}
                  rangeHi={previewHi}
                  yearOptions={yearOptions}
                  onSelectMonth={setRightMonthStart}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDay}
                />
              </div>

              <button
                type="button"
                className="date-range-picker__nav-btn"
                aria-label="다음 달"
                onClick={() =>
                  setRightMonthStart(addMonths(rightMonthStart, 1))
                }
              >
                <ArrowIcon dir="right" />
              </button>
            </div>

            <div className="date-range-picker__range-inputs">
              <input
                type="date"
                value={draftStart}
                max={todayISO()}
                onChange={(e) => handleTypedStart(e.target.value)}
              />
              <span>~</span>
              <input
                type="date"
                value={draftEnd}
                max={todayISO()}
                onChange={(e) => handleTypedEnd(e.target.value)}
              />
            </div>

            <div className="date-range-picker__footer">
              <button
                type="button"
                className="date-range-picker__cancel"
                onClick={() => setOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="date-range-picker__apply"
                onClick={handleApply}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
