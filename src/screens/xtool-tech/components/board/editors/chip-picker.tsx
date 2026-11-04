import { useState } from 'react'
import { cx } from '@/ohq-ui/lib/cx'

// 편집 판의 칸 부품 — 물 레이아웃은 같은 props의 WaterChipPicker(components/water/board/chip-picker.tsx)로 바꿔 끼운다.

interface ChipPickerProps {
  id: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string[]) => void
  searchable?: boolean
  empty?: string
}

/** 여러 개 고르기 — 알약을 눌러 켜고 끈다. 사람처럼 많으면 검색 칸이 붙는다. */
export function ChipPicker({ id, options, selected, onChange, searchable, empty = '고를 값이 없어요' }: ChipPickerProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = options.filter((o) => selected.includes(o.value) || !needle || o.label.toLowerCase().includes(needle))
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <div className="chip-picker" id={id} role="group">
      {searchable && options.length > 10 && (
        <input
          className="field__input chip-picker__search"
          placeholder="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="검색"
        />
      )}
      {shown.length === 0 ? (
        <p className="chip-picker__empty">{empty}</p>
      ) : (
        <div className="chip-picker__chips">
          {shown.map((o) => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                className={cx('chip-toggle', on && 'is-on')}
                aria-pressed={on}
                onClick={() => toggle(o.value)}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
