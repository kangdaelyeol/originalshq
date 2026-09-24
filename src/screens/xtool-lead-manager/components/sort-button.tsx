import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import '@/screens/xtool-lead-manager/styles/sort-button.scss'

/** 컬럼 정렬 토글 버튼 — 다른 컬럼 키 집합을 쓰는 표에서도 그대로 재사용할 수
 * 있게 제네릭으로 뒀다. */
export const SortButton = <T extends string>({
  columnKey,
  sortField,
  sortDirection,
  onSort,
}: {
  columnKey: T
  sortField: T
  sortDirection: SortDirection
  onSort: (field: T) => void
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
