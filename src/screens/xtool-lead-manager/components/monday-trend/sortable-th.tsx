import type { ReactNode } from 'react'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import type { TableSort } from '@/screens/xtool-lead-manager/utils'

/** 눌러서 정렬하는 머리글 칸 — 방치·개인 KPI 표가 같이 쓴다. 칸 전체가
 * 눌리고, 글자 뒤에 정렬 화살표가 붙는다. */
export const SortableTh = ({
  columnKey,
  sort,
  onSort,
  className,
  children,
}: {
  columnKey: string
  sort: TableSort | undefined
  onSort: (key: string) => void
  className?: string
  children: ReactNode
}) => {
  const active = sort?.key === columnKey
  return (
    <th
      className={['sortable', className ?? ''].join(' ').trim()}
      aria-sort={
        !active ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending'
      }
      onClick={() => onSort(columnKey)}
    >
      {children}
      <SortButton
        columnKey={columnKey}
        sortField={sort?.key ?? ''}
        sortDirection={sort?.direction ?? 'desc'}
        onSort={onSort}
      />
    </th>
  )
}
