import type { Ref } from 'react'
import { CursorArrow } from './d15-icons'

/** 둘러보기 화살표 — 맥 기본 화살표와 누를 때 퍼지는 회색 고리(F854~F858, 녹화 프로그램의 누름 표시) */
export function TourCursor({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="d15-cursor" aria-hidden>
      <i className="d15-cursor__ring" />
      <CursorArrow />
    </div>
  )
}

/**
 * 영상 편집자의 설명 알약(F77·F259·F351·F826) — 창 왼쪽 아래, 창 밖(x=32)까지 나온 짙은 알약과 하늘색 점.
 * 둘러보기만 글을 넣고 움직인다(들어옴 아래 0.8em에서 0.19초, 나감 위로 0.2em 0.11초).
 */
export function TourCaption({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="d15-caption" aria-live="polite">
      <i className="d15-caption__dot" />
      <span className="d15-caption__text" />
    </div>
  )
}
