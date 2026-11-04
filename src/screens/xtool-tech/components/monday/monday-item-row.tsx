import { ChevronDown, ChevronRight, MessageCircle, MessageCirclePlus } from 'lucide-react'
import type { TechColumn, TechItemDoc } from '../../data/tech-boards'
import { isWritable } from '../../data/tech-edit'
import { cx } from '@/ohq-ui/lib/cx'
import { InlineInput } from './monday-editors'
import { EditableCell } from './monday-editable-cell'
import type { GroupTableProps } from './monday-group'
import { selectionKey, useSelection } from './monday-selection'
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

/**
 * 항목 한 줄 — 고르기 체크박스, 하위 아이템 펼치기, 이름(누르면 그 자리에서 고친다)·하위 수·말풍선, 칸들.
 * 펼치면 줄 아래로 하위 표(SubTable).
 */
export function ItemRow({ item, ...props }: GroupTableProps & { item: TechItemDoc }) {
  const { columns, editing, setEditing, nameOf, commitName, subColumns, expanded, commitSubCell, commitSubName, removeSubitem } = props
  const key = rowKey(item)
  const nameKey = `${key}:name`
  const subCount = item.subitems?.length ?? 0
  const open = expanded.has(key)
  const Chevron = open ? ChevronDown : ChevronRight
  const selection = useSelection()
  const picked = selection?.selected.has(selectionKey(props.boardKey, key)) ?? false

  return (
    <>
      <div className={cx('mon-row', picked && 'is-selected')} role="row" aria-selected={picked}>
        <div className="mon-cell mon-cell--name" role="rowheader">
          {selection && (
            <RowCheck
              checked={picked}
              label={`${nameOf(item)} 고르기`}
              onChange={(on) => selection.set(props.boardKey, [key], on)}
            />
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
              active={props.updatesOpenFor === key}
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
}

function ItemCell({
  item,
  column,
  editing,
  setEditing,
  commitCell,
  openFiles,
}: GroupTableProps & { item: TechItemDoc; column: TechColumn }) {
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
