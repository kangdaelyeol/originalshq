import './select.scss'
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { useDismiss } from './use-dismiss'

export interface SelectOption<T extends string | number> {
  value: T
  label: ReactNode
}

/**
 * 유리 드롭다운 — 기본 <select>는 펼친 목록을 꾸밀 수 없어 직접 그린다. 알약
 * 버튼을 누르면 아래로 유리 목록이 펼쳐지고(살짝 내려오며 나타난다), 고른
 * 항목은 밝은 알약 + 체크 자리. 바깥을 누르거나 Esc면 접힌다.
 *
 * 키보드: 버튼에서 ↓/↑/Enter/Space로 열고, 목록에서 ↑/↓/Home/End로 옮기고
 * Enter/Space로 고른다(listbox 역할).
 */
export const Select = <T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (next: T) => void
  /** 읽어 주는 이름 — "정렬", "시작 월" 등. */
  label: string
  /** 화면 쪽 배치용 클래스. */
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  // 키보드로 옮겨 다니는 항목(고른 것과 따로).
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const selected = Math.max(
    0,
    options.findIndex((each) => each.value === value),
  )

  const close = useCallback(() => setOpen(false), [])
  useDismiss(boxRef, open, close)

  const openList = () => {
    setActive(selected)
    setOpen(true)
  }
  const choose = (index: number) => {
    onChange(options[index].value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  // 열면 목록에 초점을 두고 고른 항목이 보이게 스크롤한다.
  useLayoutEffect(() => {
    if (!open) return
    listRef.current?.focus()
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const items =
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    items?.[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onButtonKey = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    }
  }
  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1
    const move: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    }
    if (event.key in move) {
      event.preventDefault()
      setActive(move[event.key])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(active)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={boxRef}
      className={['glass_select', open ? 'is-open' : '', className ?? '']
        .join(' ')
        .trim()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="glass_select_button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
      >
        <span className="glass_select_value">{options[selected]?.label}</span>
        <ChevronDown
          className="glass_select_chevron"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          className="glass_select_list"
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((each, index) => (
            <li
              key={String(each.value)}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selected}
              className={[
                'glass_select_option',
                index === active ? 'is-active' : '',
              ]
                .join(' ')
                .trim()}
              style={{ '--glass-i': index } as CSSProperties}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {each.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
