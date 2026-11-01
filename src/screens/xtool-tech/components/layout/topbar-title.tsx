import { ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { BOARD_TABS, type TechBoardKey } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import { NAV_SECTIONS } from '../../nav'
import { XT_BASE, xtPath } from '../../paths'

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

/** 상단바 왼쪽 — 보드면 Monday 보드 이름, 그 밖은 메뉴 이름. */
export function TopbarTitle() {
  const { pathname } = useLocation()
  const tab = boardOf(pathname)
  if (tab) return <BoardTitle boardKey={tab.key} fallback={tab.label} />
  const label = navLabelOf(pathname)
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

/** 상단바 오른쪽 — 보드 화면에서만 "Monday 보드" 바로가기 */
export function TopbarBoardLink() {
  const { pathname } = useLocation()
  const tab = boardOf(pathname)
  return tab ? <BoardLink boardKey={tab.key} /> : null
}

function BoardLink({ boardKey }: { boardKey: TechBoardKey }) {
  const { board } = useTechBoard(boardKey)
  // 보드 주소 — 기록 주소(…/boards/<id>/pulses/<item>)에서 앞부분만
  const url = board?.records.find((r) => r.url)?.url?.split('/pulses/')[0]
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="button button--ghost button--md topbar__board-link">
      <ExternalLink size={14} aria-hidden />
      Monday 보드
    </a>
  )
}
