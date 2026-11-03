import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import type { LoaderProps } from './types'

interface LoaderFrameProps extends LoaderProps {
  /** 로더마다 붙는 클래스(d2-…) — 움직임은 전부 _design2.scss 의 키프레임이 맡는다 */
  name: string
  children: ReactNode
}

/**
 * 로더 공통 틀. 참고 영상의 칸 하나를 62×62 뷰박스로 그대로 옮겨 재 둔 좌표를 그대로 쓰고,
 * 흰색은 currentColor 라 바탕색에 맞춰 color 만 바꾸면 된다.
 */
export function LoaderFrame({ size = 62, className, name, children }: LoaderFrameProps) {
  return (
    <svg
      className={cx('d2-loader', name, className)}
      viewBox="0 0 62 62"
      width={size}
      height={size}
      role="img"
      aria-label="불러오는 중"
    >
      {children}
    </svg>
  )
}
