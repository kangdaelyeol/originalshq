import type { Ref } from 'react'
import { cx } from '../../../lib/cx'

interface TourCursorProps {
  ref?: Ref<HTMLDivElement>
  /** 혼자 보일 때(부품 견본) — 창 기준 자리(영상 px) */
  at?: [number, number]
  /** 누름 고리를 멈춘 모습으로 */
  ring?: boolean
  className?: string
}

/**
 * 둘러보기 커서 — 화면 녹화의 흰 화살표(9×12, 검은 테)와 누를 때 끝에서 퍼지는 흰 고리
 * (F137 r 7 → F140 16 → F142 18, 퍼지며 사라진다). 엔진이 transform을 직접 쓴다(React는 다시 그리지 않는다).
 */
export function TourCursor({ ref, at, ring, className }: TourCursorProps) {
  return (
    <div
      ref={ref}
      className={cx('d16-cursor', at && 'is-static', ring && 'is-ring', className)}
      style={at ? { translate: `calc(${at[0]} * var(--d16-px)) calc(${at[1]} * var(--d16-px))` } : undefined}
      aria-hidden
    >
      <span className="d16-cursor__ring" />
      <svg className="d16-cursor__arrow" viewBox="0 0 13 20">
        <path d="M1 1v15.2l3.9-3.6 2.7 6.1 2.6-1.1-2.6-5.9h5.3z" />
      </svg>
    </div>
  )
}
