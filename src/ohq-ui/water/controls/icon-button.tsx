import { useId, type ButtonHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import type { WaterIcon } from './types'

interface WaterIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: WaterIcon
  /** 읽어 주는 이름(aria-label·title) — 아이콘만 있으니 꼭 적는다 */
  label: string
  /** sm 32 · md 38 · lg 44px */
  size?: 'sm' | 'md' | 'lg'
  /** 켜진 상태(토글 단추) — aria-pressed, 어두운 알약으로 채운다 */
  pressed?: boolean
}

/**
 * 물 아이콘 단추(D7 접힌 메뉴 버튼을 작게) — 불투명 유리 원(가운데 196 → 가장자리 181) + 오른쪽 아래로 크게
 * 떨어지는 그림자, 왼쪽 위 테두리 안쪽의 가는 반사광과 왼쪽 아래 사선 윤광, 그림자 진 흰 아이콘. 누르면
 * D7 버튼이 떨어져 나갈 때처럼 5% 출렁이며 줄고(60.5 → 57.5, wobble), 떼면 부풀며 돌아온다(swell).
 */
export function WaterIconButton({
  icon: Icon,
  label,
  size = 'md',
  pressed,
  className,
  type = 'button',
  ...rest
}: WaterIconButtonProps) {
  const blurId = `water-ib-${useId().replace(/:/g, '')}`
  return (
    <button
      type={type}
      className={cx('water-icon-button', `water-icon-button--${size}`, pressed && 'is-pressed', className)}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      {/* 장식 좌표는 D7 버튼(반지름 60.5) 그대로 — viewBox로 줄인다 */}
      <svg className="water-icon-button__shine" viewBox="-60.5 -60.5 121 121" aria-hidden focusable="false">
        <defs>
          <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        {/* 왼쪽 위 테두리 안쪽 반사광(F49 210°~245°, 반지름 54.5) */}
        <path className="water-icon-button__arc" d="M-47.2-27.3A54.5 54.5 0 0 1-23-49.4" />
        {/* 왼쪽 아래 사선 윤광(F49 338,680 → 358,664) */}
        <path className="water-icon-button__glint" d="M-19.5 34.5L2.5 16" filter={`url(#${blurId})`} />
      </svg>
      <Icon className="water-icon-button__icon" />
    </button>
  )
}
