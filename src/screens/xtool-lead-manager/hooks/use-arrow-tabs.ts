import { useEffect } from 'react'

const FOCUSABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * 좌/우 방향키로 탭(토글)을 이전/다음으로 옮긴다 — Monday 고객 상세의 기록
 * 종류 토글이 쓴다. 위/아래는 왼쪽 고객 목록(useSideListKeys)이 쓰므로 겹치지
 * 않는다. 입력창에 포커스가 있으면 커서 이동에 써야 해서 가로채지 않고,
 * enabled가 false면(위에 다른 모달이 떠 있을 때) 듣지 않는다. 끝에서 더 가면
 * 반대쪽 끝으로 돌아간다.
 */
export const useArrowTabs = <T extends string>(
  tabs: readonly T[],
  active: T,
  onChange: (next: T) => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled || tabs.length < 2) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      // 이 탭에 초점이 있어 화면 공통 처리(segmented-keys.ts)가 이미 옮겼으면
      // 한 번 더 옮기지 않는다.
      if (e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target && FOCUSABLE_TAGS.has(target.tagName)) return
      const index = Math.max(0, tabs.indexOf(active))
      const step = e.key === 'ArrowLeft' ? -1 : 1
      e.preventDefault()
      onChange(tabs[(index + step + tabs.length) % tabs.length])
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [tabs, active, onChange, enabled])
}
