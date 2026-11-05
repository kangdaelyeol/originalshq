import type { KeyboardEvent } from 'react'

// 사이드바 메뉴 방향키 — 사이드바 안에 초점이 있으면 ↑·↓로 보이는 메뉴(개요·내 업무·보드, 펼친 직원 목록)를 위아래로
// 옮겨 가며 그 화면으로 바로 간다(Home·End는 처음·끝). 지금 사이드바(대시보드·Monday 표)와 물 사이드바가 같이 쓴다 —
// 메뉴 링크 선택자만 다르다.

const KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

/** 사이드바(aside) onKeyDown — items: 메뉴 링크 선택자. 화면에 보이는 것만 문서 순서대로 고른다. */
export function navArrowKeys(items: string) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    // 움직임용으로 겹쳐 그린 메뉴(inert)·접어서 숨긴 직원 목록은 뺀다
    const links = [...e.currentTarget.querySelectorAll<HTMLElement>(items)].filter(
      (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
    )
    if (links.length === 0) return
    // 메뉴 링크에 초점이 없으면(사이드바의 다른 단추 등) 지금 화면의 메뉴에서 출발한다
    let from = links.findIndex((el) => el === document.activeElement)
    if (from < 0) from = links.findIndex((el) => el.getAttribute('aria-current') === 'page' || el.classList.contains('is-active'))
    const step = e.key === 'ArrowDown' ? 1 : -1
    const to =
      e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : Math.min(links.length - 1, Math.max(0, from < 0 ? 0 : from + step))
    e.preventDefault()
    links[to].focus()
    if (to !== from) links[to].click()
  }
}
