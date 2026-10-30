import { motion } from 'motion/react'
import { useId } from 'react'
import type { Option } from '../../data/types'
import { cx } from '../../lib/cx'

interface SegmentedControlProps<T extends string> {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  /** segmented: 한 판 위의 버튼들(상단 기간 선택) · chips: 따로 떨어진 알약(표 필터) */
  variant?: 'segmented' | 'chips'
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  variant = 'segmented',
}: SegmentedControlProps<T>) {
  // 선택 표시(thumb)가 옆 버튼으로 미끄러져 가도록 컨트롤마다 고유한 layoutId.
  const layoutId = `segment-${useId()}`
  return (
    <div className={cx('segmented', `segmented--${size}`, `segmented--${variant}`)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cx('segmented__option', active && 'is-active')}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="segmented__thumb"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="segmented__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
