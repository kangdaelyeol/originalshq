import type { ReactNode } from 'react'
import { cx } from '../../../lib/cx'
import type { MotionCardText } from './design10-data'

interface MotionCardProps {
  text: MotionCardText
  /** 판 높이 — 영상은 윗줄 판(213px)이 아랫줄(204px)보다 조금 크다 */
  tall?: boolean
  /** 판 안에 놓일 움직임 */
  children: ReactNode
}

/** 번호·한글/영문 제목 → 검은 판(움직임) → 두 줄 설명. 제목은 영상처럼 줄을 나눠 둔다. */
export function MotionCard({ text, tall, children }: MotionCardProps) {
  const oneLine = text.title.length === 1
  return (
    <article className="d10-card">
      <header className={cx('d10-card__head', oneLine && 'is-one-line')}>
        <span className="d10-card__no">{text.no}</span>
        <h3 className="d10-card__title">
          {text.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h3>
        <p className="d10-card__title-en" lang="en">
          {text.titleEn.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      </header>
      <div className={cx('d10-card__panel', tall && 'is-tall')}>{children}</div>
      <p className="d10-card__caption">{text.caption}</p>
      <p className="d10-card__caption-en" lang="en">
        {text.captionEn}
      </p>
    </article>
  )
}
