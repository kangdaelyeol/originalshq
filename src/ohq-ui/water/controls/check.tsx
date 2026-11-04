import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface WaterCheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** 옆에 보이는 이름 — 없으면 aria-label을 적는다 */
  label?: ReactNode
  size?: 'sm' | 'md'
  /** 일부만 골랐음 — 체크 대신 가로줄 */
  indeterminate?: boolean
}

/**
 * 물 체크 — 작은 유리 상자. 고르면 어두운 알약이 제자리에서 진해지며(0.1s, D7 표시 알약 F82 → F85) 반쯤에서
 * 스프링으로 차오르고, 흰 체크가 12ms 뒤 55ms 동안 나타난다(WATER_REVEAL). 풀면 15ms 뒤 30ms 동안 반으로
 * 줄며 흐려진다(D7 접힘 F23). 진짜 체크박스라 Space·폼·라벨 누르기가 그대로 된다 — 움직임은 CSS 전환뿐.
 */
export function WaterCheck({ label, size = 'md', indeterminate = false, className, ...rest }: WaterCheckProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label
      className={cx(
        'water-check',
        `water-check--${size}`,
        indeterminate && 'is-mixed',
        rest.disabled && 'is-disabled',
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="water-check__input" {...rest} />
      <span className="water-check__box" aria-hidden>
        <span className="water-check__fill" />
        <svg className="water-check__mark" viewBox="0 0 16 16" focusable="false">
          <path d={indeterminate ? 'M4.4 8h7.2' : 'M3.9 8.3l2.75 2.75L12.2 5.3'} />
        </svg>
      </span>
      {label && <span className="water-check__label">{label}</span>}
    </label>
  )
}

interface WaterRadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * 물 라디오 — 둥근 유리 상자. 고르면 어두운 알약으로 차고 흰 점이 나타난다(WaterCheck와 같은 시간표). 같은
 * name끼리 묶이면 화살표로 옮겨 고른다(브라우저 기본).
 */
export function WaterRadio({ label, size = 'md', className, ...rest }: WaterRadioProps) {
  return (
    <label
      className={cx(
        'water-check',
        'water-check--radio',
        `water-check--${size}`,
        rest.disabled && 'is-disabled',
        className,
      )}
    >
      <input type="radio" className="water-check__input" {...rest} />
      <span className="water-check__box" aria-hidden>
        <span className="water-check__fill" />
        <span className="water-check__dot" />
      </span>
      {label && <span className="water-check__label">{label}</span>}
    </label>
  )
}
