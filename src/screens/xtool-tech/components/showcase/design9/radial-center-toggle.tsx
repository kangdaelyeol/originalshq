import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../../../lib/cx'
import { RadialPlusIcon } from './radial-icons'

interface CenterToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  open: boolean
  /** 올린 상태 — 판이 더 떠오르고 아이콘이 1.3배 */
  hovered?: boolean
  ref?: Ref<HTMLButtonElement>
}

/**
 * 메뉴 가운데 여닫는 버튼(Design 9).
 * 열 때 판이 세로축으로 반 바퀴 뒤집히며(그래서 그림자가 왼아래로 간다) 앞면의 청록 +가 뒷면의 빨간 ×로 바뀐다.
 * 앞·뒷면은 같은 + 두 장 — 뒤집히는 동안 45° 돌고 1.3배가 되어 ×가 된다.
 */
export function CenterToggle({ open, hovered = false, className, ref, ...rest }: CenterToggleProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('d9-center', open && 'is-open', hovered && 'is-hovered', className)}
      aria-expanded={open}
      aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
      {...rest}
    >
      <span className="d9-center__disc" aria-hidden>
        <span className="d9-center__glyph">
          <span className="d9-center__zoom">
            <RadialPlusIcon className="d9-center__icon d9-center__icon--front" />
            <RadialPlusIcon className="d9-center__icon d9-center__icon--back" />
          </span>
        </span>
      </span>
    </button>
  )
}
