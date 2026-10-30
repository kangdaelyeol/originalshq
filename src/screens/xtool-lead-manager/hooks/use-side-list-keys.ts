import { useEffect } from 'react'

const FOCUSABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * 상세 모달 왼쪽 목록 — 위/아래 방향키로 이전/다음 항목으로 넘어간다. 리드
 * 상세(detail-side-list.tsx)와 Monday 고객 상세(monday-side-list.tsx)가 같이
 * 쓴다.
 *
 * 입력창(고객명 수정, 기기 선택 등)에 포커스가 있을 때의 방향키는 그 입력창의
 * 커서 이동 등에 써야 해서 가로채지 않는다. 지금 항목이 목록에 없으면(다른
 * 경로로 연 고객) 움직이지 않는다. enabled가 false면(위에 다른 모달이 떠 있을
 * 때) 듣지 않는다.
 */
export const useSideListKeys = (
  ids: readonly string[],
  activeId: string | null,
  onSelect: (id: string) => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const target = e.target as HTMLElement | null
      if (target && FOCUSABLE_TAGS.has(target.tagName)) return

      const currentIndex = activeId === null ? -1 : ids.indexOf(activeId)
      if (currentIndex === -1) return

      const nextIndex =
        e.key === 'ArrowUp'
          ? Math.max(0, currentIndex - 1)
          : Math.min(ids.length - 1, currentIndex + 1)

      if (nextIndex === currentIndex) return
      e.preventDefault()
      onSelect(ids[nextIndex])
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [ids, activeId, onSelect, enabled])
}
