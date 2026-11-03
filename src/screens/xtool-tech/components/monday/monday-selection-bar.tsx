import { ArrowRight, Trash2, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { TechBoardKey } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import { deleteItems, moveItems } from '../../data/tech-outbox'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { groupColor } from './monday-colors'
import { MonPopover } from './monday-popover'
import { selectedByBoard, SelectionContext, selectionKey, type SelectionState } from './monday-selection'
import { NAME_TITLE } from './monday-values'

/** 줄 선택 상태를 아래 표에 나눠 준다. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const set = useCallback((boardKey: TechBoardKey, itemIds: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of itemIds) {
        if (on) next.add(selectionKey(boardKey, id))
        else next.delete(selectionKey(boardKey, id))
      }
      return next
    })
  }, [])
  const remove = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.delete(key)
      return next
    })
  }, [])
  const clear = useCallback(() => setSelected(new Set()), [])
  const value = useMemo<SelectionState>(() => ({ selected, set, remove, clear }), [selected, set, remove, clear])
  return (
    <SelectionContext.Provider value={value}>
      {children}
      <SelectionBar state={value} />
    </SelectionContext.Provider>
  )
}

/**
 * 선택 막대 — 줄을 고르면 화면 아래 가운데에 뜬다(Monday). "N 고객명 선택"과 우리가 할 수
 * 있는 것만: 그룹 이동(한 보드만 골랐을 때), 삭제(Monday 휴지통), 닫기. 복제·내보내기·보관함·
 * 변환 등 Monday의 나머지는 우리에게 없어서 뺐다. 옮기기·지우기는 표에 바로 보이고(저장 대기열)
 * Monday에는 뒤에서 쓴다.
 */
function SelectionBar({ state }: { state: SelectionState }) {
  const root = usePortalRoot()
  const byBoard = selectedByBoard(state.selected)
  const boards = [...byBoard.keys()]
  const single = boards.length === 1 ? boards[0] : null
  const count = state.selected.size
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!root || count === 0) return null
  const noun = single ? NAME_TITLE[single] : '항목'

  const remove = () => {
    setConfirming(false)
    // 표에서 바로 빠진다 — 실패한 것은 다시 보인다(선택은 풀린 채로).
    for (const [boardKey, ids] of byBoard) deleteItems(boardKey, ids)
    state.clear()
  }

  return createPortal(
    <>
      <div className="mon-selbar" role="toolbar" aria-label={`${count}개 선택됨`}>
        <span className="mon-selbar__count">{count}</span>
        <span className="mon-selbar__label">{noun} 선택</span>
        <span className="mon-selbar__actions">
          {single && (
            <button
              type="button"
              className={cx('mon-selbar__action', moveAnchor && 'is-on')}
              aria-haspopup="dialog"
              onClick={(e) => setMoveAnchor(moveAnchor ? null : e.currentTarget)}
            >
              <ArrowRight size={18} aria-hidden />
              이동
            </button>
          )}
          <button type="button" className="mon-selbar__action" onClick={() => setConfirming(true)}>
            <Trash2 size={18} aria-hidden />
            삭제
          </button>
        </span>
        <span className="mon-selbar__divider" aria-hidden />
        <button type="button" className="mon-selbar__close" aria-label="선택 해제" onClick={state.clear}>
          <X size={18} aria-hidden />
        </button>
      </div>
      {single && moveAnchor && (
        <MoveMenu
          boardKey={single}
          itemIds={byBoard.get(single) ?? []}
          anchor={moveAnchor}
          onClose={() => setMoveAnchor(null)}
        />
      )}
      <ConfirmDialog
        open={confirming}
        title={`${count}건을 지울까요?`}
        message="Monday 휴지통으로 가요. 30일 안에는 Monday에서 되살릴 수 있어요."
        confirmLabel="삭제"
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>,
    root,
  )
}

/** 그룹(진행 단계) 고르기 — 고르면 선택한 항목을 모두 그 그룹으로 옮긴다. */
function MoveMenu({
  boardKey,
  itemIds,
  anchor,
  onClose,
}: {
  boardKey: TechBoardKey
  itemIds: string[]
  anchor: HTMLElement
  onClose: () => void
}) {
  const { meta } = useTechBoard(boardKey)
  // 새 그룹에 바로 보이고, 실패한 것은 원래 그룹으로 돌아간다.
  const move = (groupId: string) => {
    onClose()
    moveItems(boardKey, itemIds, groupId)
  }
  return (
    <MonPopover anchor={anchor} width={260} onClose={onClose}>
      <p className="mon-menu__title">어느 그룹으로 옮길까요</p>
      <ul className="mon-menu">
        {(meta?.groups ?? []).map((g, i) => (
          <li key={g.id}>
            <button type="button" className="mon-menu__item" onClick={() => move(g.id)}>
              <span className="mon-selbar__dot" style={{ background: groupColor(i) }} aria-hidden />
              {g.title}
            </button>
          </li>
        ))}
      </ul>
    </MonPopover>
  )
}
