import { useMemo, useState } from 'react'
import { isDone } from '@xtool-core/tech-stage'
import { useBoardEdit } from './board-edit-context'
import { compareValues, RECORD_PAGE, type RecordSort } from './record-sort'
import type { RecordColumn } from './record-table'

// 기록 표의 줄 — 대시보드 표(RecordTable)와 물 표(WaterRecordTable)가 같이 쓴다. 모양은 저마다 그리고, 거르기
// (진행 중·완료·전체 / 담당자 / 검색)·정렬(머리글·보드 기본 순서)·"더 보기"의 규칙은 여기 하나다(레이아웃은
// 달라도 기능은 같게).

/** 표에 올리는 기록 — 진행 중/완료는 단계·상태로 가른다(isDone) */
export interface RecordLike {
  itemId: string
  stage: string | null
  status: string | null
}

/** 진행 상태 칩 — 진행 중 / 완료 / 전체 */
export type RecordView = 'open' | 'done' | 'all'

interface RecordRowsOptions<T extends RecordLike> {
  records: readonly T[]
  columns: readonly RecordColumn<T>[]
  assigneesOf: (record: T) => string[]
  /** 검색에 쓰는 글자(이름·기기·내용 등을 이어 붙인 것) */
  searchOf: (record: T) => string
  /** 진행 중 / 완료 목록의 순서 — 생략하면 Monday 순서 그대로. */
  sortOpen?: (a: T, b: T) => number
  sortDone?: (a: T, b: T) => number
  /** 진행 중/완료 구분이 있는 보드 — 없으면(false) 처음부터 전체 */
  progress: boolean
  /** 처음 보일 줄 수 — "더 보기"마다 이만큼 는다 */
  pageSize?: number
}

/**
 * 거른·늘어놓은 줄과 고르는 상태. 머리글 정렬이 있으면 그 칸 값으로(단계 칸은 Monday 그룹 순서, 빈 값은 늘 뒤),
 * 없으면 보드 기본 순서(진행 중 sortOpen, 완료·전체 sortDone). 거르는 조건·정렬을 바꾸면 다시 처음 줄 수로.
 */
export function useRecordRows<T extends RecordLike>({
  records,
  columns,
  assigneesOf,
  searchOf,
  sortOpen,
  sortDone,
  progress,
  pageSize = RECORD_PAGE,
}: RecordRowsOptions<T>) {
  const edit = useBoardEdit()
  const [view, setView] = useState<RecordView>(progress ? 'open' : 'all')
  const [assignee, setAssignee] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(pageSize)
  const [sort, setSort] = useState<RecordSort | null>(null)
  // 단계 칸은 이름이 아니라 Monday 그룹 순서(신규 → … → 완료)로 정렬한다.
  const groupOrder = edit?.meta.groups.map((g) => g.title)

  const openCount = records.filter((r) => !isDone(r)).length
  const viewOptions = [
    { value: 'open' as const, label: `진행 중 ${openCount}` },
    { value: 'done' as const, label: `완료 ${records.length - openCount}` },
    { value: 'all' as const, label: `전체 ${records.length}` },
  ]

  // 담당자 목록 — 맡은 건이 많은 순.
  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of records)
      for (const name of assigneesOf(r))
        counts.set(name, (counts.get(name) ?? 0) + 1)
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
    const column = sort && columns.find((c) => c.key === sort.key)
    if (sort && column?.sortValue) {
      const valueOf =
        column.key === 'stage' && groupOrder
          ? (r: T) => {
              const i = groupOrder.indexOf(r.stage ?? '')
              return i < 0 ? null : i
            }
          : column.sortValue
      return [...filtered].sort((a, b) =>
        compareValues(valueOf(a), valueOf(b), sort.dir),
      )
    }
    if (view === 'open' && sortOpen) return [...filtered].sort(sortOpen)
    if (view !== 'open' && sortDone) return [...filtered].sort(sortDone)
    return filtered
  }, [
    records,
    view,
    assignee,
    query,
    assigneesOf,
    searchOf,
    sortOpen,
    sortDone,
    sort,
    columns,
    groupOrder,
  ])

  // 머리글 클릭 — 오름차순 → 내림차순 → 기본 순서
  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key !== key
        ? { key, dir: 'asc' }
        : s.dir === 'asc'
          ? { key, dir: 'desc' }
          : null,
    )
    setLimit(pageSize)
  }

  // 거르는 조건이 바뀌면 다시 처음 줄 수로.
  const reset =
    <V>(set: (value: V) => void) =>
    (value: V) => {
      set(value)
      setLimit(pageSize)
    }

  return {
    view,
    setView: reset(setView),
    viewOptions,
    assignee,
    setAssignee: reset(setAssignee),
    /** 담당자 고르기 목록 — 맡은 건이 많은 순 */
    people,
    query,
    setQuery: reset(setQuery),
    sort,
    toggleSort,
    /** 거르고 늘어놓은 줄 전부 */
    rows,
    /** 지금 보이는 줄(처음 limit줄) */
    visible: rows.slice(0, limit),
    limit,
    /** 더 보기 — pageSize줄 더 */
    more: () => setLimit((n) => n + pageSize),
    /** 줄이 없을 때의 안내 */
    emptyText:
      query || assignee
        ? '조건에 맞는 기록이 없어요.'
        : view === 'open'
          ? '진행 중인 건이 없어요.'
          : '기록이 없어요.',
  }
}
