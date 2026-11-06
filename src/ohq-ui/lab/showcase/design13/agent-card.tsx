import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from '../../../lib/cx'

interface AgentCardProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  sub: string
  /** 불빛 0~1 — 선이 닿으면 1, 사건이 하나 지날 때마다 0.48 → 0.2 → 0.06 → 0(장면에서는 엔진이 고친다) */
  heat?: number
}

/**
 * 궤도 위 이름 카드 — 굵은 이름 + 작은 설명. 불빛(--d13-heat)이 오르면 번짐·속 빛이 켜지고 이름이 분홍빛으로,
 * 테두리는 √heat(--d13-edge)만큼 분홍이 된다. 장면 안에서는 엔진이 자리·크기(뒤 0.78배)를 transform으로,
 * 깊이(--d13-depth, 뒤로 갈수록 글자가 흐려진다)·불빛을 CSS 변수로 직접 고친다. 바탕은 불투명(입자가 비치지 않게).
 */
export function AgentCard({ name, sub, heat = 0, className, style, ...rest }: AgentCardProps) {
  return (
    <div
      className={cx('d13-card', className)}
      style={{ '--d13-heat': heat, '--d13-edge': Math.sqrt(heat), ...style } as CSSProperties}
      {...rest}
    >
      <span className="d13-card__name">{name}</span>
      <span className="d13-card__sub">{sub}</span>
    </div>
  )
}
