import { useMemo } from 'react'
import { addMonths, fromISO, todayISO, toISO } from '../utils'
import type { ISODate } from '../types'
import { CUSTOM_KEY, PRESETS } from './date-range-presets'
import { useDateRangePickerViewModel } from '../view-model/use-date-range-picker-view-model'
import '../styles/date-range-picker.scss'

interface DateRangePickerProps {
  dateStart: ISODate
  dateEnd: ISODate
  onChange: (start: ISODate, end: ISODate) => void
  disabled?: boolean
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`)

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
  const {
    draftStart,
    draftEnd,
    setHoverDay,
    setRightMonthStart,
    open,
    activeKey,
    leftMonthStart,
    rightMonthStart,
    yearOptions,
    previewLo,
    previewHi,
    triggerPresetLabel,
    containerRef,
    openPopover,
    close,
    applyPreset,
    handleDayClick,
    handleTypedStart,
    handleTypedEnd,
    handleApply,
    setPickingEnd,
  } = useDateRangePickerViewModel(dateStart, dateEnd, onChange)

  return (
    <div className="date-range-picker" ref={containerRef}>
      <button
        type="button"
        className={`date-range-picker__trigger${open ? ' is-open' : ''}`}
        onClick={() => (open ? close() : openPopover())}
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
                onClick={close}
              >
                취소
              </button>
              <button
                type="button"
                className="date-range-picker__apply"
                onClick={handleApply}
              >
                업데이트
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
