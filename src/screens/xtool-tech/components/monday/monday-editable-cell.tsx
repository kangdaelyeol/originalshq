import type { TechCellValue, TechColumn } from '../../data/tech-boards'
import {
  formatPhoneTyping,
  initialState,
  isPartialPhone,
  isPhoneColumn,
  isPhoneLike,
  type EditState,
} from '../../data/tech-edit'
import { pushToast } from '../../data/tech-save-queue'
import { cx } from '@/ohq-ui/lib/cx'
import { CellView } from './monday-cells'
import { CellEditor, InlineInput, type CellCommit } from './monday-editors'
import type { EditingCell } from './monday-group'
import { cellClass, cellStyle, INLINE_TYPES, previewCell } from './monday-values'

interface EditableCellProps {
  /** 편집 열쇠 — 지금 고치는 칸(editing.key)과 견준다. */
  editKey: string
  column: TechColumn
  cell: TechCellValue | undefined
  /** 고칠 수 있는 칸인지 — 아니면 보기만 */
  writable: boolean
  editing: EditingCell | null
  setEditing: (editing: EditingCell | null) => void
  onCommit: (commit: CellCommit) => void
  /** 파일 칸 누르기(파일 모달) — 없으면 파일 칸도 보기만 */
  onOpenFiles?: () => void
  /** 고칠 수 없는 칸에 올렸을 때 안내 — 없으면 "Monday에서만 고칠 수 있어요" */
  lockedTitle?: string
  /** 연결 칸에 하나만 잇는다(AS 청구 부품 줄) */
  single?: boolean
}

/** 칸 하나(항목 줄·하위 아이템 줄) — 누르거나 엔터·F2로 그 자리에서 고친다. */
export function EditableCell({
  editKey: key,
  column,
  cell,
  writable,
  editing,
  setEditing,
  onCommit,
  onOpenFiles,
  lockedTitle,
  single,
}: EditableCellProps) {
  const active = editing?.key === key
  const opens = writable || (column.type === 'file' && !!onOpenFiles)
  const commit = (c: CellCommit) => {
    setEditing(null)
    onCommit(c)
  }

  const start = (target: HTMLElement) => {
    if (column.type === 'file') {
      onOpenFiles?.()
      return
    }
    if (!writable) return
    if (column.type === 'checkbox') {
      // 연달아 눌러도 저장 대기열이 순서대로(마지막 값으로) 보낸다.
      const next = !(initialState(column, cell) as boolean)
      onCommit({ state: next, preview: previewCell(column, next) })
      return
    }
    setEditing({ key, anchor: target })
  }

  if (active && INLINE_TYPES.has(column.type)) {
    const initial = initialState(column, cell) as string
    return (
      <div className={cx(cellClass(column), 'is-editing')} role="gridcell">
        <InlineInput
          initial={initial}
          label={column.title}
          inputMode={column.type === 'numbers' ? 'decimal' : isPhoneColumn(column) ? 'tel' : column.type === 'email' ? 'email' : undefined}
          // 번호 하나로 적힌 값만 치는 대로 하이픈을 넣는다(번호 두 개 등은 적힌 그대로).
          format={isPhoneColumn(column) && isPhoneLike(initial) ? formatPhoneTyping : undefined}
          onCommit={(value) => {
            if (isPhoneColumn(column) && isPhoneLike(value) && isPartialPhone(value)) {
              setEditing(null)
              pushToast({ tone: 'error', title: `${column.title}: 번호를 끝까지 적어 주세요`, message: '9자리가 안 되는 번호는 저장하지 않았어요.' })
              return
            }
            commit({ state: value as EditState, preview: previewCell(column, value) })
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div
      className={cx(cellClass(column), writable && 'is-writable', active && 'is-active')}
      style={cellStyle(column, cell)}
      role="gridcell"
      tabIndex={opens ? 0 : -1}
      title={opens ? undefined : (lockedTitle ?? `${column.title} — Monday에서만 고칠 수 있어요`)}
      onClick={(e) => start(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault()
          start(e.currentTarget)
        }
      }}
    >
      <CellView column={column} cell={cell} />
      {active && editing && (
        <CellEditor
          column={column}
          cell={cell}
          anchor={editing.anchor}
          single={single}
          onCommit={commit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
