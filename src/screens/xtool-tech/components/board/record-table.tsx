import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, MessageCircle, MessageCirclePlus, Plus, Search } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { usePendingSaves } from '@xtool-core/tech-save-queue'
import { UPDATE_BOARDS } from '@xtool-core/use-item-updates'
import { useItemParam } from '../../lib/use-item-param'
import { cx } from '@/ohq-ui/lib/cx'
import { useBoardEdit } from './board-edit-context'
import { useRecordSelection } from './record-selection'
import { RecordSelectionBar } from './record-selection-bar'
import { sortHeader } from './record-sort'
import { useRecordRows, type RecordLike } from './use-record-rows'
import { Button } from '@/ohq-ui/components/button'
import { GlassCard } from '@/ohq-ui/components/glass-card'
import { SegmentedControl } from '@/ohq-ui/components/segmented-control'

export interface RecordColumn<T> {
  key: string
  header: string
  cell: (record: T) => ReactNode
  className?: string
  /** 있으면 머리글을 눌러 이 값으로 정렬한다(빈 값은 방향과 상관없이 맨 뒤). */
  sortValue?: (record: T) => string | number | null | undefined
}

interface RecordTableProps<T extends RecordLike> {
  title: string
  records: readonly T[]
  columns: readonly RecordColumn<T>[]
  assigneesOf: (record: T) => string[]
  /** 검색에 쓰는 글자(이름·기기·내용 등을 이어 붙인 것) */
  searchOf: (record: T) => string
  /** 진행 중 / 완료 목록의 순서 — 생략하면 Monday 순서 그대로. */
  sortOpen?: (a: T, b: T) => number
  sortDone?: (a: T, b: T) => number
  onSelect: (record: T) => void
  selectedId?: string | null
  searchPlaceholder?: string
  /** 진행 중/완료 구분이 없는 보드(부품·대여품·SN 등)는 false — 칩 없이 전체를 보인다. */
  progress?: boolean
}

/**
 * 보드 기록 표 — 진행 중·완료·전체 / 담당자 / 검색으로 거르고, 줄을 누르면 상세를 연다. 거르기·정렬·"더 보기"는
 * 물 표와 같이 쓴다(useRecordRows).
 */
export function RecordTable<T extends RecordLike>({
  title,
  records,
  columns,
  assigneesOf,
  searchOf,
  sortOpen,
  sortDone,
  onSelect,
  selectedId,
  searchPlaceholder = '이름·내용 검색',
  progress = true,
}: RecordTableProps<T>) {
  const edit = useBoardEdit()
  const saving = usePendingSaves()
  const [, openItem] = useItemParam()
  // 말풍선 보드(출장업무·아톡문의)는 이름 칸 옆에 업데이트 수 — 누르면 서랍이 업데이트 탭으로 열린다
  const updateCountOf =
    edit && UPDATE_BOARDS.has(edit.boardKey) ? (itemId: string) => edit.itemOf(itemId)?.updateCount ?? 0 : null
  // 줄 고르기(체크) — 고르면 아래에 이동·삭제 막대(Monday 표 선택 막대와 같은 기능). 고칠 수 있는 보드만
  const ids = useMemo(() => records.map((r) => r.itemId), [records])
  const selection = useRecordSelection(ids)
  const {
    view,
    setView,
    viewOptions,
    assignee,
    setAssignee,
    people,
    query,
    setQuery,
    sort,
    toggleSort,
    rows,
    visible,
    limit,
    more,
    emptyText,
  } = useRecordRows({ records, columns, assigneesOf, searchOf, sortOpen, sortDone, progress })

  return (
    <GlassCard
      title={title}
      subtitle={`${rows.length}건`}
      actions={
        <>
          {progress && (
            <SegmentedControl
              ariaLabel="진행 상태"
              options={viewOptions}
              value={view}
              onChange={setView}
            />
          )}
          {edit && (
            <Button size="sm" icon={Plus} onClick={() => edit.openEditor(null)}>
              새로 만들기
            </Button>
          )}
        </>
      }
      className="record-card"
    >
      <div className="record-filters">
        <label className="record-search">
          <Search size={14} aria-hidden />
          <span className="sr-only">검색</span>
          <input
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {people.length > 0 && (
          <label className="record-select">
            <span className="sr-only">담당자</span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">담당자 전체</option>
              {people.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="table-wrap">
        <table className="table record-table">
          <thead>
            <tr>
              {edit && (
                <th scope="col" className="record-table__check">
                  <PickAll
                    ids={visible.map((r) => r.itemId)}
                    selected={selection.selected}
                    onChange={selection.set}
                  />
                </th>
              )}
              {columns.map((column) => {
                const { dir: active, ariaSort, title: sortTitle } = sortHeader(sort, column.key)
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.className}
                    aria-sort={ariaSort}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={cx('th-sort', active && 'is-active')}
                        onClick={() => toggleSort(column.key)}
                        title={sortTitle}
                      >
                        {column.header}
                        {active === 'asc' ? (
                          <ArrowUp size={12} aria-hidden />
                        ) : active === 'desc' ? (
                          <ArrowDown size={12} aria-hidden />
                        ) : (
                          <ArrowUpDown
                            size={12}
                            aria-hidden
                            className="th-sort__idle"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (edit ? 1 : 0)} className="table__empty">
                  {emptyText}
                </td>
              </tr>
            )}
            {visible.map((record) => (
              <tr
                key={record.itemId}
                className={cx(
                  'record-row',
                  record.itemId === selectedId && 'is-selected',
                )}
                onClick={() => onSelect(record)}
              >
                {edit && (
                  <td className="record-table__check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="이 줄 고르기"
                      checked={selection.selected.has(record.itemId)}
                      onChange={(e) => selection.set([record.itemId], e.target.checked)}
                    />
                  </td>
                )}
                {columns.map((column, i) => (
                  <td key={column.key} className={column.className}>
                    {i === 0 ? (
                      <>
                        {/* 키보드로도 열 수 있게 첫 칸은 버튼으로(줄 전체 클릭은 마우스용). */}
                        <button
                          type="button"
                          className="record-row__open"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(record)
                          }}
                        >
                          {column.cell(record)}
                          {saving.has(record.itemId) && (
                            <span className="record-row__saving" title="Monday에 저장하는 중">
                              <LoaderCircle size={12} className="is-spinning" aria-hidden />
                              저장 중
                            </span>
                          )}
                        </button>
                        {updateCountOf && (
                          <UpdatesBadge
                            count={updateCountOf(record.itemId)}
                            onOpen={() => openItem(record.itemId, 'updates')}
                          />
                        )}
                      </>
                    ) : (
                      column.cell(record)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <RecordSelectionBar
          boardKey={edit.boardKey}
          meta={edit.meta}
          selected={selection.selected}
          onClear={selection.clear}
        />
      )}

      {rows.length > limit && (
        <button
          type="button"
          className="record-more"
          onClick={more}
        >
          더 보기 <span>{rows.length - limit}건 남음</span>
        </button>
      )}
    </GlassCard>
  )
}

/** 보이는 줄 전체 고르기 — 일부만 골랐으면 가운데 줄(indeterminate) */
function PickAll({
  ids,
  selected,
  onChange,
}: {
  ids: string[]
  selected: ReadonlySet<string>
  onChange: (ids: readonly string[], on: boolean) => void
}) {
  const picked = ids.filter((id) => selected.has(id)).length
  const all = ids.length > 0 && picked === ids.length
  return (
    <input
      type="checkbox"
      aria-label={all ? '보이는 줄 고르기 해제' : '보이는 줄 모두 고르기'}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = picked > 0 && !all
      }}
      disabled={ids.length === 0}
      onChange={() => onChange(ids, !all)}
    />
  )
}

/** 말풍선(업데이트 수) — 누르면 상세 서랍이 업데이트 탭으로 열린다(Monday 표 말풍선과 같은 기능) */
function UpdatesBadge({ count, onOpen }: { count: number; onOpen: () => void }) {
  const Icon = count ? MessageCircle : MessageCirclePlus
  const label = count ? `업데이트 ${count}개` : '업데이트 쓰기'
  return (
    <button
      type="button"
      className={cx('record-row__updates', !count && 'is-empty')}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      <Icon size={14} aria-hidden />
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
