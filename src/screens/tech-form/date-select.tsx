import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { localDate } from './dates'

// 날짜 고르기 — 연도·월·일 드롭다운 세 개(휴대폰 기본 날짜 칸 대신 폼 모양에 맞춘 것). 고를 수 있는 날짜는 min~max
// (기본: YEARS_BACK년 전 1월 1일 ~ 오늘 — 기술문의 폼의 구매일자). 대여 폼은 오늘부터 앞날을 고른다. 연도·월을 바꿔 이미
// 고른 월·일이 범위에 맞지 않으면 그 칸만 비운다. 세 칸이 다 차면 'YYYY-MM-DD', 아니면 ''를 알린다.

// 연도 목록 — 올해부터 몇 년 전까지
const YEARS_BACK = 10
// 아래 공간이 이보다 좁으면(위가 더 넓을 때) 목록을 위로 연다
const LIST_SPACE = 260

interface Option<T> {
  value: T
  label: string
}

const range = (from: number, to: number) => {
  const out: number[] = []
  if (from <= to) for (let n = from; n <= to; n++) out.push(n)
  else for (let n = from; n >= to; n--) out.push(n)
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate()

/**
 * 부드러운 드롭다운 — 단추를 누르면 목록이 살짝 미끄러지며 열리고(고른 줄이 가운데), 고르면 닫힌다. 바깥을 누르거나
 * Esc면 닫힌다. 키보드: ↑↓·Home·End로 짚고 엔터로 고른다(listbox — 짚은 줄은 aria-activedescendant).
 */
function Dropdown<T extends number>({
  label,
  placeholder,
  value,
  options,
  onChange,
  invalid,
}: {
  label: string
  placeholder: string
  value: T | null
  options: readonly Option<T>[]
  onChange: (value: T) => void
  invalid?: boolean
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [active, setActive] = useState(-1)
  const selected = options.findIndex((o) => o.value === value)
  const current = selected >= 0 ? options[selected] : null

  const close = (focusButton = true) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  const openList = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setUp(below < LIST_SPACE && rect.top > below)
    }
    setActive(selected >= 0 ? selected : 0)
    setOpen(true)
  }

  // 열리면 목록에 초점을 두고 고른 줄을 가운데로 — 화면 전체가 굴러가지 않게 목록 안에서만 맞춘다
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    list?.focus({ preventScroll: true })
    const item = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2
    const outside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])

  // 키보드로 옮긴 줄이 목록 밖이면 보이게(목록 안에서만)
  useEffect(() => {
    const list = listRef.current
    const item = active >= 0 ? list?.querySelector<HTMLElement>(`#${CSS.escape(`${listId}-${active}`)}`) : null
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [active, listId])

  const choose = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    close()
  }

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1
    if (e.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(last)
    else if (e.key === 'Enter' || e.key === ' ') choose(active)
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') close(false)
    else return
    e.preventDefault()
  }

  const buttonClass = ['tech-form__dd-button', open && 'is-open', invalid && 'is-invalid', !current && 'is-empty']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="tech-form__dd" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={current ? `${label} ${current.label}` : `${label} 선택`}
        onClick={() => (open ? close() : openList())}
      >
        <span>{current?.label ?? placeholder}</span>
        <ChevronDown className="tech-form__dd-chevron" size={18} aria-hidden />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className={up ? 'tech-form__dd-list is-up' : 'tech-form__dd-list'}
          onKeyDown={onListKey}
        >
          {options.map((option, i) => {
            const on = option.value === value
            const cls = ['tech-form__dd-option', i === active && 'is-active', on && 'is-selected']
              .filter(Boolean)
              .join(' ')
            return (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={on}
                className={cls}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {option.label}
                {on && <Check size={16} strokeWidth={2.6} aria-hidden />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface Parts {
  y: number | null
  m: number | null
  d: number | null
}

const parse = (value: string): Parts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : { y: null, m: null, d: null }
}

/** 날짜 — 연도·월·일 드롭다운. labelledBy·describedBy는 칸 이름·안내(·오류) id. min·max(YYYY-MM-DD)는 고를 수 있는
 * 첫날·마지막 날(기본은 YEARS_BACK년 전 1월 1일 ~ 오늘), name은 드롭다운마다 읽어 주는 이름 앞말("구매" → "구매 연도"). 연도
 * 목록은 기본(지난 날짜)이면 최근 해부터, 앞날을 고르는 범위면 올해부터 차례로 */
export function DateSelect({
  value,
  onChange,
  invalid,
  labelledBy,
  describedBy,
  min,
  max,
  name = '구매',
}: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  labelledBy: string
  describedBy?: string
  min?: string
  max?: string
  name?: string
}) {
  const [parts, setParts] = useState<Parts>(() => parse(value))
  const today = localDate()
  const first = parse(min ?? `${new Date().getFullYear() - YEARS_BACK}-01-01`)
  const last = parse(max ?? today)
  const [minY, minM, minD] = [first.y ?? 1900, first.m ?? 1, first.d ?? 1]
  const [maxY, maxM, maxD] = [last.y ?? 2100, last.m ?? 12, last.d ?? 31]
  const future = (min ?? '') >= today

  // 고를 수 있는 첫·마지막 월·일 — 범위의 첫 해·첫 달, 마지막 해·마지막 달이면 그날까지
  const firstMonth = (y: number | null) => (y === minY ? minM : 1)
  const lastMonth = (y: number | null) => (y === maxY ? maxM : 12)
  const firstDay = (y: number | null, m: number | null) => (y === minY && m === minM ? minD : 1)
  const lastDay = (y: number | null, m: number | null) =>
    y && m ? (y === maxY && m === maxM ? maxD : daysIn(y, m)) : 31

  const update = (next: Parts) => {
    // 바꾼 연도·월에 맞지 않는 월·일은 비운다
    const m = next.m && (next.m < firstMonth(next.y) || next.m > lastMonth(next.y)) ? null : next.m
    const d = next.d && (next.d < firstDay(next.y, m) || next.d > lastDay(next.y, m)) ? null : next.d
    const fixed = { y: next.y, m, d }
    setParts(fixed)
    onChange(fixed.y && fixed.m && fixed.d ? `${fixed.y}-${pad(fixed.m)}-${pad(fixed.d)}` : '')
  }

  return (
    <div className="tech-form__date-row" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      <Dropdown
        label={`${name} 연도`}
        placeholder="연도"
        value={parts.y}
        options={(future ? range(minY, maxY) : range(maxY, minY)).map((y) => ({ value: y, label: `${y}년` }))}
        onChange={(y) => update({ ...parts, y })}
        invalid={invalid && !parts.y}
      />
      <Dropdown
        label={`${name} 월`}
        placeholder="월"
        value={parts.m}
        options={range(firstMonth(parts.y), lastMonth(parts.y)).map((m) => ({ value: m, label: `${m}월` }))}
        onChange={(m) => update({ ...parts, m })}
        invalid={invalid && !parts.m}
      />
      <Dropdown
        label={`${name} 일`}
        placeholder="일"
        value={parts.d}
        options={range(firstDay(parts.y, parts.m), lastDay(parts.y, parts.m)).map((d) => ({
          value: d,
          label: `${d}일`,
        }))}
        onChange={(d) => update({ ...parts, d })}
        invalid={invalid && !parts.d}
      />
    </div>
  )
}
