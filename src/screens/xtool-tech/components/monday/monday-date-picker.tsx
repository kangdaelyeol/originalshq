import { ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import type { TechCellValue, TechColumn } from '../../data/tech-boards'
import { initialState } from '../../data/tech-edit'
import { cx } from '../../lib/cx'
import { koreaToday } from '../../lib/dates'
import type { CellCommit } from './monday-editors'
import { MonPopover } from './monday-popover'
import { previewCell } from './monday-values'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
// 연도 고르기 범위 — 올해 앞뒤로
const YEARS_BACK = 10
const YEARS_AHEAD = 5

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** 한국 지금 시각(HH:MM) */
const koreaTime = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16)

/** 적어 넣은 날짜 — 2026-11-03 · 2026.11.03 · 2026/11/03 · 11/03/2026 */
function parseDate(text: string): string | null {
  const t = text.trim()
  const iso = /^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})$/.exec(t)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  const parts = iso ? [iso[1], iso[2], iso[3]] : us ? [us[3], us[1], us[2]] : null
  if (!parts) return null
  const [y, mo, d] = parts.map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? ymd(y, mo, d) : null
}

/** 그 달을 월요일부터 6주(42칸)로 */
function monthGrid(year: number, month: number): { date: string; day: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, 1 - offset + i))
    return {
      date: ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    }
  })
}

interface DatePickerProps {
  column: TechColumn
  cell: TechCellValue | undefined
  anchor: HTMLElement
  onCommit: (commit: CellCommit) => void
  onCancel: () => void
}

/**
 * 날짜 칸 달력 — Monday 날짜 팝오버처럼: 위에 "오늘"·시각 켜기, 날짜 입력 칸, 월·연도 고르기와
 * 화살표, 아래 월요일부터 6주. 날짜를 누르면 바로 저장하고 닫힌다. 비어 있던 칸은 지금 날짜·시각을
 * 미리 채워 연다(그대로 저장하려면 오늘 날짜를 누른다).
 */
export function DatePicker({ column, cell, anchor, onCommit, onCancel }: DatePickerProps) {
  const [initial] = useState(() => initialState(column, cell) as { date: string; time: string })
  const empty = !initial.date
  const [date, setDate] = useState(empty ? koreaToday() : initial.date)
  const [time, setTime] = useState(empty ? koreaTime() : initial.time)
  const [withTime, setWithTime] = useState(empty || Boolean(initial.time))
  const [text, setText] = useState(date)
  const [view, setView] = useState(() => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }))
  // 손을 댔는지 — 미리 채운 값만 있는 채로 바깥을 누르면 저장하지 않는다.
  const [touched, setTouched] = useState(false)
  const today = koreaToday()
  const thisYear = Number(today.slice(0, 4))

  const commit = (nextDate: string, nextTime = withTime ? time : '') => {
    const state = { date: nextDate, time: nextTime }
    if (state.date === initial.date && state.time === initial.time) onCancel()
    else onCommit({ state, preview: previewCell(column, state) })
  }

  const pick = (next: string) => {
    setDate(next)
    commit(next)
  }

  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta
      return { year: Math.floor(index / 12), month: (index % 12) + 1 }
    })

  const goToday = () => {
    setDate(today)
    setText(today)
    setView({ year: thisYear, month: Number(today.slice(5, 7)) })
    setTouched(true)
  }

  const toggleTime = () => {
    setWithTime((on) => !on)
    if (!time) setTime(koreaTime())
    setTouched(true)
  }

  const typed = (value: string) => {
    setText(value)
    const parsed = parseDate(value)
    if (!parsed) return
    setDate(parsed)
    setView({ year: Number(parsed.slice(0, 4)), month: Number(parsed.slice(5, 7)) })
    setTouched(true)
  }

  return (
    <MonPopover
      anchor={anchor}
      width={276}
      escapeCommits={false}
      className="mon-date"
      onClose={(save) => (save && touched ? commit(date) : onCancel())}
    >
      <div className="mon-date__top">
        <button type="button" className="mon-date__today" onClick={goToday}>
          오늘
        </button>
        <button
          type="button"
          className={cx('mon-date__clock', withTime && 'is-on')}
          aria-pressed={withTime}
          aria-label={withTime ? '시각 빼기' : '시각 넣기'}
          title={withTime ? '시각 빼기' : '시각 넣기'}
          onClick={toggleTime}
        >
          <Clock size={16} aria-hidden />
        </button>
      </div>

      <div className="mon-date__inputs">
        <input
          className="mon-date__text"
          aria-label={`${column.title} 날짜`}
          value={text}
          placeholder="YYYY-MM-DD"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => typed(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const parsed = parseDate(text)
              if (parsed) pick(parsed)
            }
          }}
        />
        {withTime && (
          <input
            className="mon-date__time"
            type="time"
            aria-label={`${column.title} 시각`}
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              setTouched(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(date, time)
              }
            }}
          />
        )}
      </div>

      <div className="mon-date__nav">
        <label className="mon-date__select">
          <select
            aria-label="월"
            value={view.month}
            onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden />
        </label>
        <label className="mon-date__select">
          <select
            aria-label="연도"
            value={view.year}
            onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
          >
            {Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => thisYear - YEARS_BACK + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden />
        </label>
        <span className="mon-date__arrows">
          <button type="button" aria-label="이전 달" onClick={() => shift(-1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="다음 달" onClick={() => shift(1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </span>
      </div>

      <div className="mon-date__grid" role="grid" aria-label={`${view.year}년 ${view.month}월`}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="mon-date__weekday" role="columnheader">
            {w}
          </span>
        ))}
        {monthGrid(view.year, view.month).map((d) => (
          <button
            key={d.date}
            type="button"
            role="gridcell"
            className={cx('mon-date__day', !d.inMonth && 'is-outside', d.date === date && 'is-selected', d.date === today && 'is-today')}
            aria-selected={d.date === date}
            onClick={() => pick(d.date)}
          >
            {d.day}
          </button>
        ))}
      </div>

      {initial.date && (
        <div className="mon-date__footer">
          <button type="button" onClick={() => onCommit({ state: { date: '', time: '' }, preview: previewCell(column, { date: '', time: '' }) })}>
            날짜 지우기
          </button>
        </div>
      )}
    </MonPopover>
  )
}
