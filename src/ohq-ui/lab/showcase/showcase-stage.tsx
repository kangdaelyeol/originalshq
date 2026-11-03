import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { cardEnter } from '../../lib/motion'

interface ShowcaseStageProps {
  title: ReactNode
  /** 제목 아래 한 줄 — 출처 영상·쓰는 법 */
  note?: ReactNode
  /** 오른쪽 위 — 다시 재생·보기 방식 같은 조작 */
  actions?: ReactNode
  /** 바탕을 칠할 클래스(예: showcase-stage--d1) */
  className?: string
  children: ReactNode
}

/**
 * 디자인 화면의 견본 무대 — 참고 영상의 디자인을 그 디자인 바탕색 위에 그대로 띄운다.
 * 머리(제목·조작)는 ohq-ui 판 스타일, 몸통(__body)은 각 디자인이 자기 바탕을 칠한다.
 */
export function ShowcaseStage({ title, note, actions, className, children }: ShowcaseStageProps) {
  return (
    <motion.section className={cx('showcase-stage', className)} variants={cardEnter}>
      <header className="showcase-stage__head">
        <div className="showcase-stage__heading">
          <h2 className="showcase-stage__title">{title}</h2>
          {note && <p className="showcase-stage__note">{note}</p>}
        </div>
        {actions && <div className="showcase-stage__actions">{actions}</div>}
      </header>
      <div className="showcase-stage__body">{children}</div>
    </motion.section>
  )
}
