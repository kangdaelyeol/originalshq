import { useEffect, useRef, useState } from 'react'

export interface DeviceOption {
  value: string
  label: string
  count: number
}

/**
 * 기기 하나를 고르는 드롭다운 — 리드 관리자의 기기 필터와 같은 모양이고,
 * 고르면 바로 닫힌다. 바깥을 누르거나 Esc로 닫고, 열린 상태에서 ↑↓로 옮겨
 * Enter로 고른다. value가 null이면 전체.
 */
export function DeviceSelect({
  value,
  options,
  onChange,
}: {
  value: string | null
  options: readonly DeviceOption[]
  onChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const items: { value: string | null; label: string; count: number | null }[] =
    [{ value: null, label: '전체 기기', count: null }, ...options]
  const current = items.find((item) => item.value === value) ?? items[0]

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  const openMenu = () => {
    setActive(
      Math.max(
        0,
        items.findIndex((item) => item.value === value),
      ),
    )
    setOpen(true)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(items[active].value)
    }
  }

  return (
    <div className="inquiry-device" ref={wrapRef}>
      <button
        type="button"
        className={`inquiry-device__button${open ? ' is-open' : ''}${
          value !== null ? ' is-active' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className="inquiry-device__menu" role="listbox" aria-label="기기">
          {items.map((item, index) => (
            <li
              key={item.value ?? 'all'}
              role="option"
              aria-selected={item.value === value}
              className={`inquiry-device__option${
                index === active ? ' is-active' : ''
              }${item.value === value ? ' is-selected' : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item.value)}
            >
              <span>{item.label}</span>
              {item.count !== null && (
                <span className="inquiry-device__count">{item.count}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
