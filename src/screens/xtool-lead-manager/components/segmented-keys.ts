import type { KeyboardEvent, MouseEvent } from 'react'

// 버튼 묶음(Segmented)의 키보드 — 리드 매니저 화면 전체(pages/xtool-page)에 한
// 번 붙여, 맨 위 탭부터 각 탭의 메뉴·카드 머리·모달 안의 묶음까지 다 같은
// 방식으로 움직인다.

/** 버튼 묶음의 버튼 — 이벤트가 그 안에서 났으면 그 버튼. */
export const segmentButtonOf = (target: EventTarget) =>
  target instanceof Element
    ? target.closest<HTMLButtonElement>('.glass_segmented > button')
    : null

/** 모달이 떠 있는데 그 밖(뒤)에서 난 이벤트인지 — 맨 위 모달(aria-modal, 나중에
 * 그려진 것)만 본다. 모달은 초점을 가두지 않아 Tab으로 뒤의 버튼에 초점이 갈 수
 * 있는데, 그때 방향키가 뒤의 거르기나 맨 위 탭을 바꾸지 않게. */
export const isOutsideTopModal = (target: EventTarget): boolean => {
  const modals = document.querySelectorAll('[aria-modal="true"]')
  const top = modals[modals.length - 1]
  return top !== undefined && target instanceof Node && !top.contains(target)
}

/** 버튼 묶음을 누르면 그 버튼에 초점을 둔다 — 사파리(맥)는 눌러도 단추에
 * 초점이 가지 않아, 다음 방향키가 어느 묶음을 움직일지 알 수 없다. */
export const focusSegment = (event: MouseEvent<HTMLElement>) => {
  segmentButtonOf(event.target)?.focus()
}

/** 초점이 있는 버튼 묶음에서 좌/우 방향키로 바로 옆 버튼을 누른다(끝에서 더
 * 가면 반대쪽 끝). 검색창 같은 다른 칸의 방향키, 안쪽에서 이미 처리한 키
 * (preventDefault — 담당자 칩 등)는 건드리지 않는다. */
export const moveSegmentSideways = (event: KeyboardEvent<HTMLElement>) => {
  if (event.defaultPrevented) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const button = segmentButtonOf(event.target)
  const group = button?.parentElement
  if (!button || !group || isOutsideTopModal(button)) return
  const buttons = [
    ...group.querySelectorAll<HTMLButtonElement>(
      ':scope > button:not(:disabled)',
    ),
  ]
  if (buttons.length < 2) return
  const step = event.key === 'ArrowLeft' ? -1 : 1
  const next =
    buttons[(buttons.indexOf(button) + step + buttons.length) % buttons.length]
  event.preventDefault()
  next.focus()
  next.click()
}
