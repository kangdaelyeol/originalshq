import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'xtool-tech:sidebar-collapsed'
/** 사이드바 펼침/접힘 단축키(Design 8과 같은 키) */
export const SIDEBAR_TOGGLE_KEY = '['

const load = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** 글자를 치는 중인지 — 입력칸에서 [를 누르면 접지 않는다 */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * 사이드바를 아이콘 줄로 접었는지 — 이 브라우저에 기억한다. [ 키로도 바꾼다.
 * (화면이 좁으면 CSS가 늘 접으니 이 값은 넓은 화면에서만 보인다.)
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(load)
  const toggle = useCallback(() => {
    setCollapsed((was) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, was ? '0' : '1')
      } catch {
        /* 저장소를 못 쓰면 이번 방문 동안만 */
      }
      return !was
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== SIDEBAR_TOGGLE_KEY || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return [collapsed, toggle]
}
