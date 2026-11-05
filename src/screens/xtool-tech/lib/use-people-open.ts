import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MY_WORK_PATH } from '../paths'

export interface PeopleOpen {
  /** 직원 목록이 보이는지 — 펼쳐져 있고 사이드바가 펼쳐져 있을 때(아이콘 줄이면 숨는다) */
  shown: boolean
  setOpen: (update: boolean | ((open: boolean) => boolean)) => void
}

/**
 * 사이드바 "내 업무" 아래 직원 목록의 펼침 — 지금 사이드바와 물 사이드바가 같이 쓴다. 처음에는 내 업무 화면이면
 * 펴 두고, 다른 곳(개요 카드 등)에서 내 업무로 들어와도 편다. 갈매기로는 목록만 접고 편다.
 */
export function usePeopleOpen(collapsed: boolean): PeopleOpen {
  const { pathname } = useLocation()
  const onMyWork = pathname.startsWith(MY_WORK_PATH)
  const [open, setOpen] = useState(onMyWork)
  // 내 업무로 들어오면 편다 — 렌더 중에 이전 값과 비교
  const [wasOnMyWork, setWasOnMyWork] = useState(onMyWork)
  if (onMyWork !== wasOnMyWork) {
    setWasOnMyWork(onMyWork)
    if (onMyWork) setOpen(true)
  }
  return { shown: open && !collapsed, setOpen }
}
