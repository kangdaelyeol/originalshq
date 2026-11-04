import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cx } from '../../lib/cx'
import type { StatCardData } from '../../types'
import { WaterFlag } from './water-flag'
import { WaterNumber } from './water-number'

type WaterStatCardProps = Omit<StatCardData, 'key'> & { className?: string }

/**
 * 숫자 카드(D7) — StatCard와 같은 props. 유리 판 위에 제목·아이콘 / 큰 값 / 증감·태그·설명. 값이 바뀌면 바뀐
 * 숫자 칸만 굴러간다(WaterNumber — 표시 알약 스프링, 왼쪽부터 21ms 간격). 아이콘은 D7 불투명 유리 단추 속에
 * 아이콘(tint 색 — 장식, 기본 blue로 StatCard와 같다). hover면 2px 떠오른다(D7 move 스프링 — transform만이라 다시
 * 칠하지 않는다).
 */
export function WaterStatCard({
  title,
  value,
  icon: Icon,
  tint = 'blue',
  delta,
  tag,
  caption,
  className,
}: WaterStatCardProps) {
  return (
    <article className={cx('water-card', 'water-card--low', 'water-stat', className)}>
      <header className="water-stat__head">
        <p className="water-stat__title">{title}</p>
        {Icon && (
          <span className={cx('water-stat__icon', `is-${tint}`)} aria-hidden>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </header>
      <p className="water-stat__value">
        <WaterNumber value={value} />
      </p>
      {/* 증감·태그·설명이 다 없으면 아랫줄을 그리지 않는다(빈 줄이 카드 높이를 차지하지 않게) */}
      {(delta || tag || caption) && (
        <footer className="water-stat__foot">
          {delta && (
            <span className={cx('water-delta', delta.good ? 'is-good' : 'is-bad')}>
              {delta.direction === 'up' ? (
                <ArrowUpRight size={12} strokeWidth={2.6} aria-hidden />
              ) : (
                <ArrowDownRight size={12} strokeWidth={2.6} aria-hidden />
              )}
              {delta.value}
              <span className="sr-only">{delta.good ? ' 좋아짐' : ' 나빠짐'}</span>
            </span>
          )}
          {tag && <WaterFlag tone={tag.tone}>{tag.label}</WaterFlag>}
          {caption && <span className="water-stat__caption">{caption}</span>}
        </footer>
      )}
    </article>
  )
}
