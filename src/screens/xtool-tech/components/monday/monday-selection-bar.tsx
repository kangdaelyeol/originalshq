import { ArrowRight, Trash2, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { deleteTechItems, MAX_DELETE, updateTechItem, type TechBoardKey } from '../../data/tech-boards'
import { useTechBoard } from '../../data/tech-boards-store'
import { batchInBackground } from '../../data/tech-save-queue'
import { cx } from '../../lib/cx'
import { usePortalRoot } from '../../lib/portal-root'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { groupColor } from './monday-colors'
import { MonPopover } from './monday-popover'
import { selectedByBoard, SelectionContext, selectionKey, type SelectionState } from './monday-selection'
import { releaseLater, setHidden, setMoved } from './monday-optimistic'
import { NAME_TITLE } from './monday-values'

// 그룹 옮기기를 같이 보내는 수
const MOVE_CHUNK = 4

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
 * 변환 등 Monday의 나머지는 우리에게 없어서 뺐다.
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
    for (const [boardKey, ids] of byBoard) {
      batchInBackground(
        { pending: `${ids.length}건 지우는 중…`, done: `${ids.length}건을 지웠어요 — Monday 휴지통에 있어요`, failed: '일부를 지우지 못했어요' },
        ids,
        MAX_DELETE,
        async (chunk) => (await deleteTechItems(boardKey, chunk)).failed.map((f) => f.itemId),
        {
          // 표에서 바로 숨기고, 실패한 것만 다시 보이게 한다.
          onStart: (keys) => setHidden(keys.map((id) => selectionKey(boardKey, id)), true),
          onSettled: (done, failed) => {
            setHidden(failed.map((id) => selectionKey(boardKey, id)), false)
            state.remove(done.map((id) => selectionKey(boardKey, id)))
            releaseLater(() => setHidden(done.map((id) => selectionKey(boardKey, id)), false))
          },
        },
      )
    }
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
  const move = (groupId: string, title: string) => {
    onClose()
    batchInBackground(
      { pending: `${itemIds.length}건을 '${title}'(으)로 옮기는 중…`, done: `${itemIds.length}건을 '${title}'(으)로 옮겼어요`, failed: '일부를 옮기지 못했어요' },
      itemIds,
      MOVE_CHUNK,
      async (chunk) => {
        const results = await Promise.allSettled(chunk.map((itemId) => updateTechItem({ boardKey, itemId, groupId })))
        return chunk.filter((_, i) => results[i].status === 'rejected')
      },
      {
        // 새 그룹에 바로 보이고, 실패한 것은 원래 그룹으로 돌아간다.
        onStart: (keys) => setMoved(keys.map((id) => selectionKey(boardKey, id)), groupId),
        onSettled: (done, failed) => {
          setMoved(failed.map((id) => selectionKey(boardKey, id)), null)
          releaseLater(() => setMoved(done.map((id) => selectionKey(boardKey, id)), null))
        },
      },
    )
  }
  return (
    <MonPopover anchor={anchor} width={260} onClose={onClose}>
      <p className="mon-menu__title">어느 그룹으로 옮길까요</p>
      <ul className="mon-menu">
        {(meta?.groups ?? []).map((g, i) => (
          <li key={g.id}>
            <button type="button" className="mon-menu__item" onClick={() => move(g.id, g.title)}>
              <span className="mon-selbar__dot" style={{ background: groupColor(i) }} aria-hidden />
              {g.title}
            </button>
          </li>
        ))}
      </ul>
    </MonPopover>
  )
}
