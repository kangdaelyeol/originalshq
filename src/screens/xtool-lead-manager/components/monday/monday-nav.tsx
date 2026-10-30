import '@/screens/xtool-lead-manager/styles/nav.scss'
import type { ReactNode } from 'react'
import { Segmented, Select } from '@/components/glass'
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

/** Monday 고객 탭의 상단 줄 — 위에 분류, 아래에 검색·정렬·페이지. 리드 탭의
 * Nav와 같은 자리·같은 모양(lead_manager_nav)이다. 확인 필요는 아래 숫자
 * 타일(monday-main.tsx)에 있다. */
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
  } = state
  const {
    changeSearch,
    changeCategory,
    changeSort,
    changePageSize,
    goToPrevPage,
    goToNextPage,
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

  return (
    <div className="lead_manager_nav monday_nav glass_theme">
      <div className="inner">
        {/* 분류 — 고객 수가 붙어 길어서 한 줄을 따로 쓴다. */}
        <div className="monday_nav_categories">
          <Segmented
            options={categoryOptions}
            value={category}
            onChange={changeCategory}
            label="분류"
            size="md"
          />
        </div>

        <div className="monday_nav_tools">
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

          <Select
            className="page_size_select monday_sort"
            value={sort}
            options={(Object.keys(MONDAY_SORT_LABEL) as MondaySort[]).map(
              (each) => ({ value: each, label: MONDAY_SORT_LABEL[each] }),
            )}
            onChange={changeSort}
            label="정렬"
          />

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
    </div>
  )
}
