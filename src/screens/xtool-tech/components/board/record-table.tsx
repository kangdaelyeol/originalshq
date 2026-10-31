import { Plus, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { isDone } from '../../data/tech-stage'
import { cx } from '../../lib/cx'
import { useBoardEdit } from './board-edit-context'
import { Button } from '../ui/button'
import { GlassCard } from '../ui/glass-card'
import { SegmentedControl } from '../ui/segmented-control'

export interface RecordColumn<T> {
  key: string
  header: string
  cell: (record: T) => ReactNode
  className?: string
}

type View = 'open' | 'done' | 'all'

interface RecordLike {
  itemId: string
  stage: string | null
  status: string | null
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
}

// 처음에 보여 줄 줄 수 — 완료 목록은 수백 건이라 "더 보기"로 늘린다.
const PAGE = 30

/** 보드 기록 표 — 진행 중·완료·전체 / 담당자 / 검색으로 거르고, 줄을 누르면 상세를 연다. */
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
}: RecordTableProps<T>) {
  const edit = useBoardEdit()
  const [view, setView] = useState<View>('open')
  const [assignee, setAssignee] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const openCount = records.filter((r) => !isDone(r)).length
  const viewOptions = [
    { value: 'open' as const, label: `진행 중 ${openCount}` },
    { value: 'done' as const, label: `완료 ${records.length - openCount}` },
    { value: 'all' as const, label: `전체 ${records.length}` },
  ]

  // 담당자 목록 — 맡은 건이 많은 순.
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of records) for (const name of assigneesOf(r)) counts.set(name, (counts.get(name) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [records, assigneesOf])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = records.filter(
      (r) =>
        (view === 'all' || (view === 'done') === isDone(r)) &&
        (!assignee || assigneesOf(r).includes(assignee)) &&
        (!needle || searchOf(r).toLowerCase().includes(needle)),
    )
    if (view === 'open' && sortOpen) return [...filtered].sort(sortOpen)
    if (view !== 'open' && sortDone) return [...filtered].sort(sortDone)
    return filtered
  }, [records, view, assignee, query, assigneesOf, searchOf, sortOpen, sortDone])

  // 거르는 조건이 바뀌면 다시 처음 줄 수로.
  const reset = <V,>(set: (value: V) => void) => (value: V) => {
    set(value)
    setLimit(PAGE)
  }

  return (
    <GlassCard
      title={title}
      subtitle={`${rows.length}건`}
      actions={
        <>
          <SegmentedControl
            variant="chips"
            size="sm"
            ariaLabel="진행 상태"
            options={viewOptions}
            value={view}
            onChange={reset(setView)}
          />
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
            onChange={(e) => reset(setQuery)(e.target.value)}
          />
        </label>
        <label className="record-select">
          <span className="sr-only">담당자</span>
          <select value={assignee} onChange={(e) => reset(setAssignee)(e.target.value)}>
            <option value="">담당자 전체</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table className="table record-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={column.className}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="table__empty">
                  {query || assignee ? '조건에 맞는 기록이 없어요.' : view === 'open' ? '진행 중인 건이 없어요.' : '기록이 없어요.'}
                </td>
              </tr>
            )}
            {rows.slice(0, limit).map((record) => (
              <tr
                key={record.itemId}
                className={cx('record-row', record.itemId === selectedId && 'is-selected')}
                onClick={() => onSelect(record)}
              >
                {columns.map((column, i) => (
                  <td key={column.key} className={column.className}>
                    {i === 0 ? (
                      // 키보드로도 열 수 있게 첫 칸은 버튼으로(줄 전체 클릭은 마우스용).
                      <button
                        type="button"
                        className="record-row__open"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(record)
                        }}
                      >
                        {column.cell(record)}
                      </button>
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

      {rows.length > limit && (
        <button type="button" className="record-more" onClick={() => setLimit((n) => n + PAGE)}>
          더 보기 <span>{rows.length - limit}건 남음</span>
        </button>
      )}
    </GlassCard>
  )
}
