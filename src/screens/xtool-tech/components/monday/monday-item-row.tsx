import { ChevronDown, ChevronRight, MessageCircle, MessageCirclePlus } from 'lucide-react'
import { memo } from 'react'
import type { TechBoardKey, TechColumn, TechItemDoc } from '@xtool-core/tech-boards'
import { isWritable } from '@xtool-core/tech-edit'
import { cx } from '@/ohq-ui/lib/cx'
import { InlineInput } from './monday-editors'
import { EditableCell } from './monday-editable-cell'
import type { EditingCell, GroupTableProps } from './monday-group'
import type { SelectionState } from './monday-selection'
import { SubTable } from './monday-subitems'
import { RowCheck } from './monday-table-controls'
import { rowKey } from './monday-values'

// 서버가 업데이트를 이 수까지만 센다(functions-xtool monday-api.ts UPDATE_COUNT_LIMIT)
const UPDATE_COUNT_LIMIT = 20

/** 이름 칸 오른쪽 말풍선 — 업데이트가 있으면 개수 배지, 없으면 +가 붙은 말풍선(Monday). */
function UpdatesButton({ count, active, label, onClick }: { count: number; active: boolean; label: string; onClick: () => void }) {
  const Icon = count > 0 ? MessageCircle : MessageCirclePlus
  return (
    <button
      type="button"
      className={cx('mon-updates', count > 0 && 'has-updates', active && 'is-active')}
      aria-label={`${label} 업데이트 ${count}개`}
      title={count > 0 ? `업데이트 ${count}개` : '업데이트 쓰기'}
      onClick={onClick}
    >
      <Icon size={19} strokeWidth={2.6} aria-hidden />
      {count > 0 && <span className="mon-updates__count">{count >= UPDATE_COUNT_LIMIT ? `${UPDATE_COUNT_LIMIT}+` : count}</span>}
    </button>
  )
}

/** 줄이 받는 것 — 함수는 늘 같은 것(MondaySection useStableHandlers), 나머지는 이 줄 몫만(memo가 견준다) */
type ItemRowProps = Pick<
  GroupTableProps,
  | 'setEditing'
  | 'nameOf'
  | 'commitCell'
  | 'commitName'
  | 'openFiles'
  | 'addSubitem'
  | 'commitSubCell'
  | 'commitSubName'
  | 'removeSubitem'
  | 'subNameTitle'
  | 'openUpdates'
  | 'subColumns'
  | 'toggleExpanded'
> & {
  item: TechItemDoc
  boardKey: TechBoardKey
  columns: TechColumn[]
  /** 이 줄(또는 펼친 하위 줄)을 고치는 중일 때만 — 아니면 null */
  editing: EditingCell | null
  /** 업데이트 패널이 이 줄에 열렸는지 */
  updatesOpen: boolean
  /** 하위 아이템을 펼쳤는지 */
  open: boolean
  /** 골랐는지(체크박스) */
  picked: boolean
  /** 고르기 — 선택이 없는 화면이면 null */
  setPicked: SelectionState['set'] | null
}

/**
 * 항목 한 줄 — 고르기 체크박스, 하위 아이템 펼치기, 이름(누르면 그 자리에서 고친다)·하위 수·말풍선, 칸들.
 * 펼치면 줄 아래로 하위 표(SubTable). memo — 칸 하나를 고치거나 다른 줄을 골라도 이 줄은 다시 그리지 않는다.
 */
export const ItemRow = memo(function ItemRow({ item, ...props }: ItemRowProps) {
  const { columns, editing, setEditing, nameOf, commitName, subColumns, open, commitSubCell, commitSubName, removeSubitem, picked } = props
  const key = rowKey(item)
  const nameKey = `${key}:name`
  const subCount = item.subitems?.length ?? 0
  const Chevron = open ? ChevronDown : ChevronRight
  const setPicked = props.setPicked

  return (
    <>
      <div className={cx('mon-row', picked && 'is-selected')} role="row" aria-selected={picked}>
        <div
          className="mon-cell mon-cell--name is-name-editable"
          role="rowheader"
          // 칸 어디를 눌러도 이름을 고친다 — 이름 글자(.mon-name)만 누르던 것을 칸 전체로. 체크·펼치기·업데이트 단추는 제 일만
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, input, label, [role="checkbox"]')) return
            setEditing({ key: nameKey, anchor: e.currentTarget })
          }}
        >
          {setPicked && (
            <RowCheck checked={picked} label={`${nameOf(item)} 고르기`} onChange={(on) => setPicked(props.boardKey, [key], on)} />
          )}
          {subColumns && (
            <button
              type="button"
              className={cx('mon-expand', subCount === 0 && !open && 'is-empty')}
              aria-expanded={open}
              aria-label={`하위 아이템 ${subCount}개 ${open ? '접기' : '펼치기'}`}
              onClick={() => props.toggleExpanded(key)}
            >
              <Chevron size={14} strokeWidth={2.2} aria-hidden />
            </button>
          )}
          {editing?.key === nameKey ? (
            <InlineInput
              initial={nameOf(item)}
              label="이름"
              onCommit={(name) => {
                setEditing(null)
                if (name.trim()) commitName(item, name.trim())
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button
              type="button"
              className="mon-name"
              title={nameOf(item)}
              onClick={(e) => setEditing({ key: nameKey, anchor: e.currentTarget })}
            >
              {nameOf(item)}
            </button>
          )}
          {subCount > 0 && <span className="mon-subcount">{subCount}</span>}
          {/* 만드는 중인 항목은 Monday에 아직 없어 업데이트를 쓸 곳이 없다. */}
          {props.openUpdates && !item.draft && (
            <UpdatesButton
              count={item.updateCount ?? 0}
              active={props.updatesOpen}
              label={nameOf(item)}
              onClick={() => props.openUpdates?.(item)}
            />
          )}
        </div>
        {columns.map((column) => (
          <ItemCell key={column.id} item={item} column={column} {...props} />
        ))}
        <div className="mon-cell mon-cell--end" aria-hidden />
      </div>
      {open && subColumns && (
        <SubTable
          item={item}
          columns={subColumns}
          nameTitle={props.subNameTitle}
          editing={editing}
          setEditing={setEditing}
          onAdd={(name) => props.addSubitem(item, name)}
          onCommitCell={commitSubCell ? (sub, column, commit) => commitSubCell(item, sub, column, commit) : undefined}
          onCommitName={commitSubName ? (sub, name) => commitSubName(item, sub, name) : undefined}
          onRemove={removeSubitem ? (sub) => removeSubitem(item, sub) : undefined}
        />
      )}
    </>
  )
})

function ItemCell({
  item,
  column,
  editing,
  setEditing,
  commitCell,
  openFiles,
}: ItemRowProps & { column: TechColumn }) {
  return (
    <EditableCell
      editKey={`${rowKey(item)}:${column.id}`}
      column={column}
      cell={item.values[column.id]}
      writable={isWritable(column)}
      editing={editing}
      setEditing={setEditing}
      onCommit={(commit) => commitCell(item, column, commit)}
      onOpenFiles={() => {
        // 만드는 중인 항목은 Monday에 아직 없어 파일을 올릴 곳이 없다.
        if (!item.draft) openFiles(item, column)
      }}
    />
  )
}
