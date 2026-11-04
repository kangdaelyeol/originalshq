import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

/** 유리 판 그림자 높이 — 값과 근거는 styles/_surfaces.scss .water-card */
export type WaterLift = 'flat' | 'low' | 'raised'

interface WaterCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** 제목 오른쪽 — 탭·필터·버튼 자리 */
  actions?: ReactNode
  /** lg: 좁은 카드의 큰 제목 */
  titleSize?: 'md' | 'lg'
  className?: string
  children?: ReactNode
  /** 그림자 높이 — low(기본): 카드 사이 20px 틈 안에서 사라진다 · raised: 홀로 선 카드 · flat: 판 안의 판 */
  lift?: WaterLift
  /** 불러오는 중 — 유리 위로 은은한 빛이 지나가고(합성 단계 transform 하나) aria-busy */
  busy?: boolean
  /** 바깥 요소(기본 section) */
  as?: 'section' | 'article' | 'div'
}

/**
 * 물 유리 판(D7) — GlassCard와 같은 자리(제목·부제·actions·내용)에 바꿔 끼운다. 유리는 SVG 필터 대신 CSS
 * 그림자(w-glass)로 칠해 한 번 그리고 다시 칠하지 않는다. 흐림(backdrop-filter)이 없어 뒤 벽 격자선이 그대로
 * 비친다(D7 유리 몸 — F24~F80 x125 선). 판 자체는 움직이지 않는다 — 움직이는 것(막대·숫자)은 제 층에서.
 */
export function WaterCard({
  title,
  subtitle,
  actions,
  titleSize = 'md',
  className,
  children,
  lift = 'low',
  busy = false,
  as: Tag = 'section',
}: WaterCardProps) {
  return (
    <Tag className={cx('water-card', `water-card--${lift}`, className)} aria-busy={busy || undefined}>
      {busy && <span className="water-card__sheen" aria-hidden />}
      {(title || actions) && (
        <header className="water-card__header">
          <div className="water-card__heading">
            {title && (
              <h2 className={cx('water-card__title', titleSize === 'lg' && 'water-card__title--lg')}>{title}</h2>
            )}
            {subtitle && <p className="water-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="water-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
}
