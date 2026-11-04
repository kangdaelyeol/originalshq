// 초점 도구 — 모달(대화상자·서랍) 안에서 Tab이 돌게 한다. 이벤트 처리기에서만 부른다(레이아웃을 읽는다).

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** root 안에서 Tab으로 갈 수 있는 것 — inert 안쪽과 보이지 않는 것(크기 없음)은 뺀다 */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

/**
 * Tab·Shift+Tab을 root 안에서 돌린다(모달) — 끝에서 처음으로, 처음(또는 root)에서 끝으로. 갈 곳이 없으면
 * root에 초점을 둔다. 처리했으면 true
 */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault: () => void }, root: HTMLElement): boolean {
  if (e.key !== 'Tab') return false
  const list = focusablesIn(root)
  if (list.length === 0) {
    e.preventDefault()
    root.focus()
    return true
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault()
    last.focus()
    return true
  }
  if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
    return true
  }
  return false
}
