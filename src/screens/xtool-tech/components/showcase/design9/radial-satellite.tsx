import type { ButtonHTMLAttributes, Ref } from 'react'
import { cx } from '../../../lib/cx'
import type { RadialMenuItem } from './radial-menu-data'

interface SatelliteButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  item: RadialMenuItem
  /** 올린 상태 — 아이콘이 1.15배·청록, 판이 조금 더 떠오른다 */
  hovered?: boolean
  /** 고른 상태 — 판이 오목하게 눌리고 아이콘 아래 청록 점 */
  selected?: boolean
  ref?: Ref<HTMLButtonElement>
}

/**
 * 궤도 위 동그란 뉴모피즘 버튼(Design 9) — 바탕과 같은 색의 판이 그림자만으로 떠 있다.
 * 상태(올림·고름)는 부모가 정하고, 바뀌는 모양·타이밍은 _design9.scss가 맡는다.
 */
export function SatelliteButton({ item, hovered = false, selected = false, className, ref, ...rest }: SatelliteButtonProps) {
  const Icon = item.icon
  return (
    <button
      ref={ref}
      type="button"
      className={cx('d9-sat', hovered && 'is-hovered', selected && 'is-selected', className)}
      aria-label={item.name}
      {...rest}
    >
      <span className="d9-sat__face" aria-hidden />
      <span className="d9-sat__icon" aria-hidden>
        <Icon />
      </span>
      <span className="d9-sat__dot" aria-hidden />
    </button>
  )
}
