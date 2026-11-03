import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { StatCardData } from '../types'
import { cx } from '../lib/cx'
import { cardEnter, liftSpring } from '../lib/motion'
import { StatusPill } from './status-pill'

type StatCardProps = Omit<StatCardData, 'key'>

/** KPI 카드 — 제목·아이콘 / 큰 값 / 증감 알약 + 설명. hover 시 살짝 떠오른다. */
export function StatCard({ title, value, icon: Icon, tint = 'blue', delta, tag, caption }: StatCardProps) {
  return (
    <motion.article className="glass stat-card" variants={cardEnter} whileHover={{ y: -5 }} transition={liftSpring}>
      <header className="stat-card__header">
        <p className="stat-card__title">{title}</p>
        {Icon && (
          <span className={cx('icon-chip', `icon-chip--${tint}`)} aria-hidden>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </header>
      <p className="stat-card__value">{value}</p>
      {/* 증감·태그·설명이 다 없으면 아랫줄을 아예 그리지 않는다(빈 줄이 카드 높이를 차지하지 않게). */}
      {(delta || tag || caption) && (
        <footer className="stat-card__footer">
          {delta && (
            <span className={cx('delta', delta.good ? 'delta--good' : 'delta--bad')}>
              {delta.direction === 'up' ? (
                <ArrowUpRight size={12} strokeWidth={2.6} aria-hidden />
              ) : (
                <ArrowDownRight size={12} strokeWidth={2.6} aria-hidden />
              )}
              {delta.value}
            </span>
          )}
          {tag && <StatusPill tone={tag.tone}>{tag.label}</StatusPill>}
          {caption && <span className="stat-card__caption">{caption}</span>}
        </footer>
      )}
    </motion.article>
  )
}
