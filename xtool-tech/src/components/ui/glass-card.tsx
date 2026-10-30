import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { cardEnter } from '../../lib/motion'

interface GlassCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** 제목 오른쪽 — 탭·필터·버튼 자리. */
  actions?: ReactNode
  /** lg: 오른쪽 좁은 카드의 큰 제목(샘플의 "Telecom Provider Health"). */
  titleSize?: 'md' | 'lg'
  className?: string
  children?: ReactNode
}

/** 모든 화면의 기본 판 — 반투명 바탕 + 배경 흐림(backdrop-filter) + 얇은 빛 테두리. */
export function GlassCard({ title, subtitle, actions, titleSize = 'md', className, children }: GlassCardProps) {
  return (
    <motion.section className={cx('glass', 'card', className)} variants={cardEnter}>
      {(title || actions) && (
        <header className="card__header">
          <div className="card__heading">
            {title && <h2 className={cx('card__title', titleSize === 'lg' && 'card__title--lg')}>{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </motion.section>
  )
}
