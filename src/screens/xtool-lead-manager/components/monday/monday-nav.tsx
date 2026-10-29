import '@/screens/xtool-lead-manager/styles/nav.scss'
import type { ReactNode } from 'react'
import { Segmented } from '@/components/glass'
import { SearchIcon } from '@/screens/xtool-lead-manager/illustration'
import {
  CloseIcon,
  PaginationBar,
} from '@/screens/xtool-lead-manager/components'
import type { useMondayViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  MONDAY_CATEGORY_LABEL,
  MONDAY_SORT_LABEL,
  type MondayCategory,
  type MondaySort,
} from '@/screens/xtool-lead-manager/utils'

type MondayNavProps = Pick<
  ReturnType<typeof useMondayViewModel>,
  'state' | 'actions'
>

/** Monday 고객 탭의 상단 줄 — 검색, 분류, 정렬, 확인 필요 경고, 페이지. 리드
 * 탭의 Nav와 같은 자리·같은 모양(lead_manager_nav)이다. */
export const MondayNav = ({ state, actions }: MondayNavProps) => {
  const {
    search,
    category,
    categories,
    categoryCounts,
    sort,
    pageSize,
    page,
    totalPages,
    totalRows,
    missingItems,
    paymentIssues,
  } = state
  const {
    changeSearch,
    changeCategory,
    changeSort,
    changePageSize,
    goToPrevPage,
    goToNextPage,
    openMissing,
  } = actions

  const typed = search.trim() !== ''
  // 분류 버튼 — 이름 옆에 그 분류의 고객 수(검색 결과 안에서).
  const categoryOptions = Object.fromEntries(
    categories.map((each) => [
      each,
      <span key={each} className="monday_category_label">
        {MONDAY_CATEGORY_LABEL[each]}
        <span className="count">
          {categoryCounts[each].toLocaleString('ko-KR')}
        </span>
      </span>,
    ]),
  ) as Record<MondayCategory, ReactNode>
  const reviewCount = missingItems.length + paymentIssues.length

  return (
    <div className="lead_manager_nav monday_nav glass_theme">
      <div className="inner">
        <div className="search-box">
          <SearchIcon />
          <div className="search-container">
            <input
              className={['search-input', typed ? 'typed' : ''].join(' ')}
              type="text"
              name="monday-search"
              placeholder="이름 · 번호 · 담당자"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
            {typed && (
              <div className="reset-btn">
                <CloseIcon onClick={() => changeSearch('')} />
              </div>
            )}
          </div>
        </div>

        <Segmented
          options={categoryOptions}
          value={category}
          onChange={changeCategory}
          label="분류"
          size="md"
        />

        <div className="page_size_select monday_sort">
          <select
            value={sort}
            aria-label="정렬"
            onChange={(e) => changeSort(e.target.value as MondaySort)}
          >
            {(Object.keys(MONDAY_SORT_LABEL) as MondaySort[]).map((each) => (
              <option key={each} value={each}>
                {MONDAY_SORT_LABEL[each]}
              </option>
            ))}
          </select>
        </div>

        {reviewCount > 0 && (
          <button
            type="button"
            className="monday_missing_btn"
            onClick={openMissing}
          >
            확인 필요 {reviewCount}건
          </button>
        )}

        <PaginationBar
          pageSize={pageSize}
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          onSetPageSize={changePageSize}
          onPrevPage={goToPrevPage}
          onNextPage={goToNextPage}
        />
      </div>
    </div>
  )
}
