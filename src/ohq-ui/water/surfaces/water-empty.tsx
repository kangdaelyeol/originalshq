import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { WaterBead } from '../glass'

interface WaterEmptyProps {
  /** 한 줄 안내(예: "자료가 없어요") */
  title: ReactNode
  /** 더 자세한 설명 — md에서만 */
  description?: ReactNode
  /** 아이콘 — 없으면 물방울 한 알 */
  icon?: LucideIcon
  /** 다음 할 일(버튼 등) — md에서만 */
  action?: ReactNode
  /** sm: 목록·차트 안 한 줄(.bar-list__empty 자리) · md: 판 하나를 채우는 빈 화면(.card.empty 자리) */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * 빈 상태(D7) — sm은 작은 물방울 한 알 + 한 줄, md는 불투명 유리 단추(D7 접힌 버튼 속, 가운데 196 → 가장자리
 * 183) 안에 흰 아이콘(없으면 물방울)과 제목·설명·할 일. 움직이지 않는다(rAF 0).
 */
export function WaterEmpty({ title, description, icon: Icon, action, size = 'sm', className }: WaterEmptyProps) {
  if (size === 'sm') {
    return (
      <p className={cx('water-empty', 'water-empty--sm', className)}>
        <svg className="water-empty__bead" viewBox="-7 -7 14 14" aria-hidden focusable="false">
          <WaterBead />
        </svg>
        {title}
      </p>
    )
  }
  return (
    <div className={cx('water-empty', 'water-empty--md', className)}>
      <span className="water-empty__well" aria-hidden>
        {Icon ? (
          <Icon className="water-empty__icon" size={24} strokeWidth={2} />
        ) : (
          <svg className="water-empty__drop" viewBox="-7 -7 14 14" focusable="false">
            <WaterBead />
          </svg>
        )}
      </span>
      <p className="water-empty__title">{title}</p>
      {description && <p className="water-empty__text">{description}</p>}
      {action && <div className="water-empty__action">{action}</div>}
    </div>
  )
}
