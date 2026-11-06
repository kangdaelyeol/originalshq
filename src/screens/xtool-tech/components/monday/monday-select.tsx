import { Check, ChevronDown, Search } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { isComposing } from '../../lib/ime'
import { MonPopover } from './monday-popover'

export interface MonSelectOption<T extends string | number> {
  value: T
  label: string
}

interface MonSelectProps<T extends string | number> {
  value: T
  options: readonly MonSelectOption<T>[]
  onChange: (value: T) => void
  'aria-label': string
  /** 'field' — 입력 칸 모양(보기 모달), 'bare' — 테두리 없이(달력 머리의 월·연도) */
  variant?: 'field' | 'bare'
  className?: string
  /** 목록 최소 폭 — 단추가 이보다 좁으면 목록이 더 넓게 뜬다 */
  minWidth?: number
  /** 목록 위 찾기 칸 — 기본은 고를 것이 많을 때만(월·연도처럼 뻔한 목록은 끈다) */
  searchable?: boolean
}

// 고를 것이 이보다 많으면 목록 위에 찾기 칸을 둔다(보드 칸 목록 등).
const SEARCH_FROM = 9

/**
 * Monday 드롭다운 — 브라우저 기본 목록 대신 Monday 팝오버로 연다. 초점은 단추(찾기 칸이 있으면 그 칸)에 두고
 * 위아래 화살표·Home·End로 옮겨 Enter로 고른다(aria-activedescendant). Esc·바깥 누르기는 팝오버가 닫는다.
 */
export function MonSelect<T extends string | number>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  variant = 'field',
  className,
  minWidth = 180,
  searchable = options.length >= SEARCH_FROM,
}: MonSelectProps<T>) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const open = anchor !== null
  const needle = query.trim().toLowerCase()
  const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options
  const current = options.find((o) => o.value === value)
  const optionId = (index: number) => `${id}-${index}`

  const show = () => {
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setAnchor(trigger.current)
  }
  const close = () => setAnchor(null)
  const choose = (option: MonSelectOption<T> | undefined) => {
    if (!option) return
    close()
    if (option.value !== value) onChange(option.value)
    trigger.current?.focus()
  }

  // 열 때는 고른 줄을 목록 가운데로, 키보드로 옮긴 줄이 목록 밖이면 그만큼만 스크롤(scrollIntoView는 바깥
  // 화면까지 움직인다)
  const centered = useRef(false)
  useLayoutEffect(() => {
    const el = list.current?.children[active] as HTMLElement | undefined
    const box = list.current
    if (!open) centered.current = false
    if (!open || !el || !box) return
    if (!centered.current) {
      centered.current = true
      box.scrollTop = el.offsetTop - (box.clientHeight - el.offsetHeight) / 2
    } else if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight
  }, [open, active, needle])

  const onKey = (e: KeyboardEvent) => {
    if (isComposing(e)) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    const last = shown.length - 1
    const move: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    }
    if (e.key in move) {
      e.preventDefault()
      setActive(Math.max(0, move[e.key]))
    } else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) {
      e.preventDefault()
      choose(shown[active])
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const activeId = open && shown[active] ? optionId(active) : undefined
  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={searchable ? undefined : activeId}
        className={cx('mon-select', variant === 'bare' && 'mon-select--bare', open && 'is-open', className)}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
      >
        <span className="mon-select__value">{current?.label ?? ''}</span>
        <ChevronDown size={14} className="mon-select__chevron" aria-hidden />
      </button>
      {anchor && (
        <MonPopover
          anchor={anchor}
          width={Math.max(minWidth, anchor.offsetWidth)}
          onClose={close}
          align="start"
          className="mon-select__pop"
        >
          {searchable && (
            <label className="mon-pick__search mon-select__search">
              <Search size={13} aria-hidden />
              <input
                value={query}
                placeholder="찾기"
                aria-label={`${ariaLabel} 찾기`}
                aria-controls={`${id}-list`}
                aria-activedescendant={activeId}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKey}
              />
            </label>
          )}
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className="mon-select__list"
            // 목록을 눌러도 초점은 단추·찾기 칸에 그대로
            onMouseDown={(e) => e.preventDefault()}
          >
            {shown.map((option, index) => {
              const on = option.value === value
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={on}
                  className={cx('mon-select__option', index === active && 'is-active', on && 'is-on')}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {on && <Check size={14} aria-hidden />}
                </li>
              )
            })}
            {shown.length === 0 && <li className="mon-pick__empty">찾는 것이 없어요</li>}
          </ul>
        </MonPopover>
      )}
    </>
  )
}
