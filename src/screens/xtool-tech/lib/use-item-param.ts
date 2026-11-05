import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards'

/** 상세 서랍의 탭 — 정보(기본) · 업데이트(Monday 댓글, 말풍선 보드만). 주소의 ?panel=updates와 같이 간다. */
export type ItemPanel = 'info' | 'updates'

/**
 * 보드에서 열린 항목 — 주소의 ?item=<id>와 같이 간다. 개요(나의 진행 중 업무)에서 누르면 그 보드로
 * 가서 바로 상세가 열리고, 주소를 공유해도 같은 항목이 열린다. 열고 닫는 건 기록을 쌓지 않는다.
 * 다른 항목을 열거나 닫으면 서랍 탭(?panel)은 정보로 돌아간다 — panel을 주면 그 탭으로 연다(표의 말풍선).
 */
export function useItemParam(): [string | null, (itemId: string | null, panel?: ItemPanel) => void] {
  const [params, setParams] = useSearchParams()
  const selected = params.get('item')
  const select = useCallback(
    (itemId: string | null, panel?: ItemPanel) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (itemId) next.set('item', itemId)
          else next.delete('item')
          if (itemId && panel === 'updates') next.set('panel', panel)
          else next.delete('panel')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return [selected, select]
}

/** 열린 상세 서랍의 탭 — 항목은 그대로 두고 탭만 바꾼다 */
export function useItemPanel(): [ItemPanel, (panel: ItemPanel) => void] {
  const [params, setParams] = useSearchParams()
  const panel: ItemPanel = params.get('panel') === 'updates' ? 'updates' : 'info'
  const select = useCallback(
    (next: ItemPanel) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          if (next === 'updates') out.set('panel', next)
          else out.delete('panel')
          return out
        },
        { replace: true },
      ),
    [setParams],
  )
  return [panel, select]
}

/** 보드 밖(내 업무)에서 연 항목 — 어느 보드의 어느 항목인지 */
export interface BoardItemRef {
  boardKey: TechBoardKey
  itemId: string
}

/**
 * 내 업무에서 연 항목 — 주소의 ?board=<보드 키>&item=<id>. 여러 보드의 줄이 한 목록에 섞여 있어 보드도 주소에
 * 둔다(?who는 그대로 간다). 여는 건 줄 링크(boardItemSearch)이고, 닫으면 board·item·panel을 같이 지운다.
 * 탭(?panel)은 보드 화면처럼 useItemPanel이 다룬다.
 */
export function useBoardItemParam(): [BoardItemRef | null, () => void] {
  const [params, setParams] = useSearchParams()
  const boardKey = BOARD_TABS.find((t) => t.key === params.get('board'))?.key ?? null
  const itemId = params.get('item')
  const opened = useMemo(() => (boardKey && itemId ? { boardKey, itemId } : null), [boardKey, itemId])
  const close = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('board')
          next.delete('item')
          next.delete('panel')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return [opened, close]
}

/** 내 업무 줄이 가는 주소(?…) — 지금 주소(?who 등)에 board·item을 얹는다. 탭(?panel)은 정보로 돌아간다. */
export function boardItemSearch(params: URLSearchParams, { boardKey, itemId }: BoardItemRef): string {
  const next = new URLSearchParams(params)
  next.set('board', boardKey)
  next.set('item', itemId)
  next.delete('panel')
  return `?${next}`
}
