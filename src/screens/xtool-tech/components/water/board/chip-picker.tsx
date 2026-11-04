import { Search } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterTextField } from '@/ohq-ui/water/controls'
import { useReducedMotion, useWaterRipple } from '@/ohq-ui/water/hooks'
import { pressPoint, rippleAt } from '@/ohq-ui/water/ripple'

interface WaterChipPickerProps {
  id: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string[]) => void
  searchable?: boolean
  empty?: string
  /** 켤 때 칩 안에 작은 물결(물 판만, 기본 켬) */
  ripple?: boolean
}

/**
 * 여러 개 고르기(물) — 기본 부품 WaterChips와 같은 D7 칩(water-chips__chip — 꺼지면 반투명 흰 알약, 켜면
 * 어두운 알약에 흰 글자로 0.1초, F356 → F359). WaterChips는 하나만 고르는 radiogroup이라 여러 개를 켜고
 * 끄는(aria-pressed) 이 부품은 같은 모양만 빌려 쓴다. 켤 때 누른 자리에서 작은 물결이 칩 안으로 퍼진다.
 * 사람처럼 많으면(10개 넘게) 검색 칸(WaterTextField)이 붙는다 — 기존 ChipPicker와 같은 동작.
 */
export function WaterChipPicker({
  id,
  options,
  selected,
  onChange,
  searchable,
  empty = '고를 값이 없어요',
  ripple: withRipple = true,
}: WaterChipPickerProps) {
  const [query, setQuery] = useState('')
  const { ref: fxRef, engine: ripple } = useWaterRipple()
  const reduced = useReducedMotion()
  const needle = query.trim().toLowerCase()
  const shown = options.filter(
    (o) =>
      selected.includes(o.value) ||
      !needle ||
      o.label.toLowerCase().includes(needle),
  )

  const toggle = (value: string, e: MouseEvent<HTMLButtonElement>) => {
    const on = selected.includes(value)
    const layer = fxRef.current
    if (!on && withRipple && !reduced && layer)
      ripple.current?.play(
        rippleAt(layer, e.currentTarget, { point: pressPoint(e) }),
      )
    onChange(on ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className="water-chip-picker" id={id} role="group">
      {searchable && options.length > 10 && (
        <WaterTextField
          className="water-board-quiet-label water-chip-picker__search"
          label="이름 검색"
          icon={Search}
          placeholder="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {shown.length === 0 ? (
        <p className="water-chip-picker__empty">{empty}</p>
      ) : (
        <div className="water-chips water-chips--md water-chip-picker__chips">
          {shown.map((o) => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                className={cx('water-chips__chip', on && 'is-on')}
                aria-pressed={on}
                onClick={(e) => toggle(o.value, e)}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
      <svg
        ref={fxRef}
        className="water-chip-picker__fx"
        aria-hidden
        focusable="false"
      />
    </div>
  )
}
