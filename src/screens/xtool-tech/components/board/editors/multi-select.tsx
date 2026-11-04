import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cx } from '@/ohq-ui/lib/cx'

// 편집 판의 칸 부품 — 물 레이아웃은 같은 props의 WaterMultiSelect(components/water/board/multi-select.tsx)로
// 바꿔 끼운다.

/** 여러 개 고르는 드롭다운 — 겉모습은 다른 선택 칸(select)과 같고, 누르면 체크 목록이 열린다. */
export function MultiSelect({
  id,
  options,
  selected,
  onChange,
}: {
  id: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 바깥을 누르면 닫는다. 열 때 목록이 패널 아래로 잘리지 않게 보이는 곳까지 내린다.
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('.multi-select__list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option])

  return (
    <div
      ref={ref}
      className="multi-select"
      // 열려 있으면 Esc는 목록만 닫는다(편집 패널은 그대로) — DrawerShell이 이 표시를 본다.
      data-popover-open={open || undefined}
      onKeyDown={(e) => {
        // 아래 판(편집 판 밑의 상세 판 — 이 목록이 자기 안에 없어 양보하지 않는다)까지 가서 같이 닫히지 않게 막는다.
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        id={id}
        type="button"
        className="field__input multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cx('multi-select__value', selected.length === 0 && 'is-empty')}>
          {selected.length ? selected.join(', ') : '선택 안 함'}
        </span>
      </button>
      {open && (
        <ul className="multi-select__list" role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const on = selected.includes(option)
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={cx('multi-select__option', on && 'is-on')}
                  onClick={() => toggle(option)}
                >
                  <span className="multi-select__check" aria-hidden>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  {option}
                </button>
              </li>
            )
          })}
          {selected.length > 0 && (
            <li>
              <button type="button" className="multi-select__clear" onClick={() => onChange([])}>
                모두 해제
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
