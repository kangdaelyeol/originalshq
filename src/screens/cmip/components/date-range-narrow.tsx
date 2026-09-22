import { addMonths, fromISO, toISO } from '../utils'
import type { ISODate } from '../types'
import { useDateRangeNarrowViewModel } from '../view-model/use-date-range-narrow-view-model'
import '../styles/date-range-narrow.scss'

interface DateRangeNarrowProps {
  /** 실제로 수집·조회된 전체 기간 — 이 밖의 날짜는 고를 수 없다. */
  minDate: ISODate
  maxDate: ISODate
  dateStart: ISODate
  dateEnd: ISODate
  onChange: (start: ISODate, end: ISODate) => void
  disabled?: boolean
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`)

function clamp(iso: ISODate, min: ISODate, max: ISODate): ISODate {
  if (iso < min) return min
  if (iso > max) return max
  return iso
}

/** monthStart(해당 월 1일) 기준 캘린더 그리드. 이전/다음 달로 채우지 않고 빈 칸으로 둔다. */
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

/** 이미 조회된 전체 기간(minDate~maxDate) 안에서만 고를 수 있는, 프리셋 없는 달력
 * 단일 월 뷰 — 인사이트 그래프 모달의 "일별" 보기 전용 부분 범위 축소용. */
export const DateRangeNarrow = ({
  minDate,
  maxDate,
  dateStart,
  dateEnd,
  onChange,
  disabled = false,
}: DateRangeNarrowProps) => {
  const {
    open,
    viewMonth,
    minMonth,
    maxMonth,
    previewLo,
    previewHi,
    triggerLabel,
    containerRef,
    isDayDisabled,
    setViewMonth,
    setHoverDay,
    openPopover,
    close,
    handleDayClick,
    handleApply,
    handleResetToFull,
  } = useDateRangeNarrowViewModel(minDate, maxDate, dateStart, dateEnd, onChange)

  const cells = buildMonthGrid(viewMonth)
  const monthDate = fromISO(viewMonth)
  const year = monthDate.getUTCFullYear()
  const month = monthDate.getUTCMonth()
  const yearOptions = (() => {
    const lo = fromISO(minMonth).getUTCFullYear()
    const hi = fromISO(maxMonth).getUTCFullYear()
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  })()

  const setMonth = (y: number, m: number) => {
    const next = toISO(new Date(Date.UTC(y, m, 1)))
    setViewMonth(clamp(next, minMonth, maxMonth))
  }

  return (
    <div className="date-range-narrow" ref={containerRef}>
      <button
        type="button"
        className={`date-range-narrow__trigger${open ? ' is-open' : ''}`}
        onClick={() => (open ? close() : openPopover())}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="date-range-narrow__trigger-icon">
          <CalendarIcon />
        </span>
        <span className="date-range-narrow__trigger-label">{triggerLabel}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="date-range-narrow__popover">
          <div className="date-range-narrow__nav">
            <button
              type="button"
              className="date-range-narrow__nav-btn"
              aria-label="이전 달"
              disabled={viewMonth <= minMonth}
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            >
              <ArrowIcon dir="left" />
            </button>

            <div className="date-range-narrow__month-head">
              <select
                className="date-range-narrow__month-select"
                value={month}
                onChange={(e) => setMonth(year, Number(e.target.value))}
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="date-range-narrow__month-select"
                value={year}
                onChange={(e) => setMonth(Number(e.target.value), month)}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="date-range-narrow__nav-btn"
              aria-label="다음 달"
              disabled={viewMonth >= maxMonth}
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            >
              <ArrowIcon dir="right" />
            </button>
          </div>

          <div className="date-range-narrow__weekdays">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div
            className="date-range-narrow__grid"
            onPointerLeave={() => setHoverDay(null)}
          >
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <span
                    key={`empty-${i}`}
                    className="date-range-narrow__cell is-empty"
                  />
                )
              }
              const inRange = day >= previewLo && day <= previewHi
              const isStart = day === previewLo
              const isEnd = day === previewHi
              const dayDisabled = isDayDisabled(day)
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    'date-range-narrow__cell',
                    inRange && 'is-in-range',
                    isStart && 'is-start',
                    isEnd && 'is-end',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={dayDisabled}
                  onClick={() => handleDayClick(day)}
                  onPointerEnter={() => setHoverDay(day)}
                >
                  <span className="date-range-narrow__cell-num">
                    {Number(day.slice(-2))}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="date-range-narrow__footer">
            <button
              type="button"
              className="date-range-narrow__reset"
              onClick={handleResetToFull}
            >
              전체 기간
            </button>
            <div className="date-range-narrow__footer-actions">
              <button
                type="button"
                className="date-range-narrow__cancel"
                onClick={close}
              >
                취소
              </button>
              <button
                type="button"
                className="date-range-narrow__apply"
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
