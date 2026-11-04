import { ArrowRight, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePortalRoot } from '@/ohq-ui/lib/portal-root'
import { WaterButton, WaterDialog, WaterIconButton } from '@/ohq-ui/water/controls'
import type { TechBoardKey, TechBoardMeta } from '../../../data/tech-boards'
import { deleteItems, moveItems } from '../../../data/tech-outbox'
import { DELETE_CONFIRM_MESSAGE } from '../../board/record-selection'

interface WaterSelectionBarProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  selected: ReadonlySet<string>
  onClear: () => void
}

/**
 * 고르기 막대(물) — 기존 RecordSelectionBar와 같은 기능(진행 단계 옮기기·삭제·선택 해제). 화면 아래 가운데
 * 떠 있는 유리 알약 막대, 고른 수는 어두운 알약(D7 표시 알약). 옮길 단계는 막대 위로 펼치는 유리 판에서
 * 고르고, 삭제는 물 확인창을 거친다.
 */
export function WaterSelectionBar({ boardKey, meta, selected, onClear }: WaterSelectionBarProps) {
  const root = usePortalRoot()
  const [moving, setMoving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const count = selected.size
  if (!root || (count === 0 && !confirming)) return null
  const ids = [...selected]

  return createPortal(
    <>
      {count > 0 && (
        <div className="water-selbar" role="toolbar" aria-label={`${count}개 선택됨`}>
          <span className="water-selbar__count">{count}</span>
          <span className="water-selbar__label">개 선택</span>
          {meta.groups.length > 0 && (
            <WaterButton
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              aria-expanded={moving}
              aria-haspopup="menu"
              onClick={() => setMoving((v) => !v)}
            >
              이동
            </WaterButton>
          )}
          <WaterButton variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirming(true)}>
            삭제
          </WaterButton>
          <WaterIconButton icon={X} label="선택 해제" size="sm" onClick={onClear} />

          {moving && (
            <div className="water-selbar__menu" role="menu" aria-label="어느 진행 단계로 옮길까요">
              <p className="water-selbar__menu-title">어느 진행 단계로 옮길까요</p>
              {meta.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="menuitem"
                  className="water-selbar__menu-item"
                  onClick={() => {
                    setMoving(false)
                    moveItems(boardKey, ids, group.id)
                    onClear()
                  }}
                >
                  {group.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <WaterDialog
        open={confirming}
        title={`${count}건을 지울까요?`}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel="삭제"
        tone="danger"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          deleteItems(boardKey, ids)
          onClear()
        }}
      />
    </>,
    root,
  )
}
