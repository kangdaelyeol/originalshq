import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '@/screens/xtool-lead-manager/types'

/** 표 페이지네이션 컨트롤 — 원래 표 바로 아래 있었는데, 표가 길면 스크롤을
 * 내려야만 보여서 상단 nav(검색·기기 필터 옆)로 옮겼다. */
export const PaginationBar = ({
  pageSize,
  page,
  totalPages,
  totalRows,
  onSetPageSize,
  onPrevPage,
  onNextPage,
}: {
  pageSize: PageSize
  page: number
  totalPages: number
  totalRows: number
  onSetPageSize: (size: PageSize) => void
  onPrevPage: () => void
  onNextPage: () => void
}) => {
  return (
    <div className="pagination_bar">
      <span className="total_count">총 {totalRows}건</span>

      <div className="page_size_select">
        <select
          value={pageSize}
          onChange={(e) => onSetPageSize(Number(e.target.value) as PageSize)}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}개씩 보기
            </option>
          ))}
        </select>
      </div>

      <div className="page_nav">
        <button
          type="button"
          className="page_nav_btn"
          onClick={onPrevPage}
          disabled={page <= 1}
          aria-label="이전 페이지"
        >
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 5 7.5 10l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="page_indicator">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="page_nav_btn"
          onClick={onNextPage}
          disabled={page >= totalPages}
          aria-label="다음 페이지"
        >
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M7.5 5 12.5 10l-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
