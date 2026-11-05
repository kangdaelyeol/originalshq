import { ArrowRight, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '@/ohq-ui/components/button'
import { ConfirmDialog } from '@/ohq-ui/components/confirm-dialog'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import type { TechBoardKey, TechBoardMeta } from '../../data/tech-boards'
import { useCenterOnMain } from '../../lib/use-center-on-main'
import { DELETE_CONFIRM_MESSAGE } from './record-selection'
import { useSelectionActions } from './use-selection-actions'

interface RecordSelectionBarProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  selected: ReadonlySet<string>
  onClear: () => void
}

/**
 * 고르기 막대(대시보드) — 표에서 줄을 고르면 화면 아래 가운데에 뜬다. Monday 표의 선택 막대와 같은 기능:
 * 진행 단계(그룹) 옮기기, 삭제(Monday 휴지통, 확인), 선택 해제. 옮기기·지우기는 표에 바로 보이고 Monday에는
 * 뒤에서 쓴다(저장 대기열 — 실패하면 토스트, 지운 줄은 다시 보인다). 하는 일은 useSelectionActions, 여기는 모양만.
 */
export function RecordSelectionBar({ boardKey, meta, selected, onClear }: RecordSelectionBarProps) {
  const root = usePortalRoot()
  const actions = useSelectionActions({ byBoard: new Map([[boardKey, [...selected]]]), clear: onClear })
  const { count, confirming } = actions
  const moving = actions.moveAnchor !== null
  // 창 가운데가 아니라 본문(사이드바 오른쪽) 가운데에
  const barRef = useCenterOnMain<HTMLDivElement>(count > 0)
  if (!root || (count === 0 && !confirming)) return null

  return createPortal(
    <>
      {count > 0 && (
        <div ref={barRef} className="glass selbar" role="toolbar" aria-label={`${count}개 선택됨`}>
          <span className="selbar__count">{count}</span>
          <span className="selbar__label">개 선택</span>
          {meta.groups.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              aria-expanded={moving}
              aria-haspopup="menu"
              onClick={(e) => actions.toggleMove(e.currentTarget)}
            >
              이동
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={Trash2} onClick={actions.askDelete}>
            삭제
          </Button>
          <button type="button" className="icon-button" aria-label="선택 해제" onClick={onClear}>
            <X size={16} aria-hidden />
          </button>

          {moving && (
            <div className="glass selbar__menu" role="menu" aria-label="어느 진행 단계로 옮길까요">
              <p className="selbar__menu-title">어느 진행 단계로 옮길까요</p>
              {meta.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="menuitem"
                  className="selbar__menu-item"
                  onClick={() => actions.move(group.id)}
                >
                  {group.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
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
