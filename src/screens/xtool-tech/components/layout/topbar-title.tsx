import { useLocation } from 'react-router-dom'
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards'
import { useTechBoard } from '@xtool-core/tech-boards-store'
import { NAV_SECTIONS } from '../../nav'
import { MY_WORK_PATH, XT_BASE, xtPath } from '../../paths'

/** 지금 주소의 보드(/xtool-tech/boards/<slug>) */
const boardOf = (pathname: string) => BOARD_TABS.find((tab) => pathname.startsWith(xtPath(`/boards/${tab.slug}`)))

/** 지금 주소의 메뉴 이름 — 개요는 정확히, 나머지는 앞부분으로 찾는다. */
const navLabelOf = (pathname: string): string | null => {
  const path = pathname.replace(/\/$/, '')
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.to === XT_BASE ? path === XT_BASE : path.startsWith(item.to)) return item.label
    }
  }
  return null
}

/** 상단바 왼쪽 — 보드면 Monday 보드 이름, 내 업무에서 다른 직원을 보면 그 사람 이름, 그 밖은 메뉴 이름. */
export function TopbarTitle() {
  const { pathname, search } = useLocation()
  const tab = boardOf(pathname)
  if (tab) return <BoardTitle boardKey={tab.key} fallback={tab.label} />
  const who = pathname.startsWith(MY_WORK_PATH) ? new URLSearchParams(search).get('who') : null
  const label = who ? `${who}님의 업무` : navLabelOf(pathname)
  return label ? (
    <div className="topbar-title">
      <h1>{label}</h1>
    </div>
  ) : null
}

function BoardTitle({ boardKey, fallback }: { boardKey: TechBoardKey; fallback: string }) {
  const { board } = useTechBoard(boardKey)
  return (
    <div className="topbar-title">
      <h1>{board?.name ?? fallback}</h1>
    </div>
  )
}
