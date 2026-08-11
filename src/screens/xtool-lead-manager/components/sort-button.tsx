import type { SortDirection, SortField } from '../types'
import '../styles/sort-button.scss'

export const SortButton = ({
  columnKey,
  sortField,
  sortDirection,
  onSort,
}: {
  columnKey: SortField
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
}) => {
  const isActive = sortField === columnKey

  return (
    <button
      type="button"
      className={['sort_btn', isActive ? sortDirection : ''].join(' ')}
      onClick={(e) => {
        e.stopPropagation()
        onSort(columnKey)
      }}
      aria-label="정렬 기준 변경"
    >
      <svg viewBox="0 0 10 14" fill="none">
        <path className="arrow_up" d="M5 1 8 5.5H2L5 1Z" />
        <path className="arrow_down" d="M5 13 2 8.5h6L5 13Z" />
      </svg>
    </button>
  )
}
