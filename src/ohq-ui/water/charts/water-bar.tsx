import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useWaterFill } from './use-water-fill'

interface WaterBarProps {
  /** 막대 끝 자리 0~1(홈 길이 비율) */
  value: number
  /** 차례(0부터) — 나타날 때 WATER_REVEAL.stagger(21ms)씩 늦게 출발 */
  index?: number
  /** 채움 색 — 없으면 어두운 알약(D7 표시 알약 #555358 → #2b292e) */
  color?: string
  /** md: 12px 홈(이름 아래 막대) · sm: 10px 홈(한 줄 안 막대) */
  size?: 'sm' | 'md'
  /** 화면 낭독기 이름 — 주면 role="img", 없으면 숨김(값을 옆 글자가 이미 말할 때) */
  label?: string
  className?: string
  /** 홈 위에 겹칠 것(목표선 등) — 채움과 같은 좌표(왼쪽 0% ~ 오른쪽 100%) */
  children?: ReactNode
}

/**
 * 막대 하나(D7) — 유리에 파인 홈(w-groove) 안의 어두운 알약 채움. 처음 나타날 때·값이 바뀔 때 끝이 extend
 * 스프링으로 뻗는다(16% 넘쳤다 돌아옴 — useWaterFill). 채움은 transform만 움직여 다시 칠하지 않는다.
 */
export function WaterBar({ value, index = 0, color, size = 'md', label, className, children }: WaterBarProps) {
  const fill = useWaterFill<HTMLSpanElement>(value, index)
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <span className={cx('water-bar', `water-bar--${size}`, className)} {...a11y}>
      <span className="water-bar__clip">
        <span
          ref={fill}
          className={cx('water-bar__fill', color && 'is-color')}
          style={color ? ({ '--w-fill': color } as CSSProperties) : undefined}
        />
      </span>
      {children && <span className="water-bar__over">{children}</span>}
    </span>
  )
}
