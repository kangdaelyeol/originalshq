import { ArrowRight, Trash2, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { TechBoardKey } from '@xtool-core/tech-boards'
import { useTechBoard } from '@xtool-core/tech-boards-store'
import { cx } from '@/ohq-ui/lib/cx'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { DELETE_CONFIRM_MESSAGE } from '../board/record-selection'
import { useSelectionActions } from '../board/use-selection-actions'
import { useCenterOnMain } from '../../lib/use-center-on-main'
import { groupColor } from './monday-colors'
import { MonPopover } from './monday-popover'
import { selectedByBoard, SelectionContext, selectionKey, type SelectionState } from './monday-selection'
import { ITEM_NOUN } from './monday-values'

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
 * Monday에는 뒤에서 쓴다. 하는 일은 대시보드·물 고르기 막대와 같은 useSelectionActions(여러 보드는 보드마다
 * 지운다) — 옮긴 뒤에도 고른 채로 둔다.
 */
function SelectionBar({ state }: { state: SelectionState }) {
  const root = usePortalRoot()
  const actions = useSelectionActions({ byBoard: selectedByBoard(state.selected), clear: state.clear })
  const { count, moveAnchor } = actions
  const single = actions.moveBoard
  // 창 가운데가 아니라 본문(사이드바 오른쪽) 가운데에
  const barRef = useCenterOnMain<HTMLDivElement>(count > 0)

  if (!root || count === 0) return null
  const noun = single ? ITEM_NOUN[single] : '항목'

  return createPortal(
    <>
      <div ref={barRef} className="mon-selbar" role="toolbar" aria-label={`${count}개 선택됨`}>
        <span className="mon-selbar__count">{count}</span>
        <span className="mon-selbar__label">{noun} 선택</span>
        <span className="mon-selbar__actions">
          {single && (
            <button
              type="button"
              className={cx('mon-selbar__action', moveAnchor && 'is-on')}
              aria-haspopup="dialog"
              onClick={(e) => actions.toggleMove(e.currentTarget)}
            >
              <ArrowRight size={18} aria-hidden />
              이동
            </button>
          )}
          <button type="button" className="mon-selbar__action" onClick={actions.askDelete}>
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
        <MoveMenu boardKey={single} anchor={moveAnchor} onClose={actions.closeMove} onMove={actions.move} />
      )}
      <ConfirmDialog
        open={actions.confirming}
        title={`${count}건을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>,
    root,
  )
}

/** 그룹(진행 단계) 고르기 — 고르면 선택한 항목을 모두 그 그룹으로 옮긴다(onMove). */
function MoveMenu({
  boardKey,
  anchor,
  onClose,
  onMove,
}: {
  boardKey: TechBoardKey
  anchor: HTMLElement
  onClose: () => void
  onMove: (groupId: string) => void
}) {
  const { meta } = useTechBoard(boardKey)
  return (
    <MonPopover anchor={anchor} width={260} onClose={onClose}>
      <p className="mon-menu__title">어느 진행 단계로 옮길까요</p>
      <ul className="mon-menu">
        {(meta?.groups ?? []).map((g, i) => (
          <li key={g.id}>
            <button type="button" className="mon-menu__item" onClick={() => onMove(g.id)}>
              <span className="mon-selbar__dot" style={{ background: groupColor(i) }} aria-hidden />
              {g.title}
            </button>
          </li>
        ))}
      </ul>
    </MonPopover>
  )
}
