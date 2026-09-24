import '@/screens/xtool-lead-manager/styles/nav.scss'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { SearchIcon } from '@/screens/xtool-lead-manager/illustration'
import {
  CloseIcon,
  DeviceFilter,
  PaginationBar,
} from '@/screens/xtool-lead-manager/components'
import type { useMainViewModel } from '@/screens/xtool-lead-manager/view-model'

// 페이지네이션 상태(pageSize/page/totalPages/totalRows)와 그 액션은
// useMainViewModel이 갖고 있다 — Nav는 Main의 형제(둘 다 FilterContextProvider의
// 자식)라 그 훅을 직접 부를 수 없어, 부모(index.tsx)에서 한 번만 호출해 내려준다.
type NavProps = Pick<ReturnType<typeof useMainViewModel>, 'state' | 'actions'>

export const Nav = ({ state, actions }: NavProps) => {
  const {
    searchActive,
    searchRef,
    searchValue,
    resetSearchValue,
    activeSearch,
    handleSearchChange,
    selectedDevices,
    toggleDevice,
  } = useFilterContext()
  const { pageSize, page, totalPages, totalRows } = state
  const { setPageSize, goToPrevPage, goToNextPage } = actions

  const typed = searchValue?.trim() !== ''

  return (
    <div className="lead_manager_nav">
      <div className="inner">
        <div className="search-box">
          <SearchIcon />
          {searchActive ? (
            <div className="search-container" ref={searchRef}>
              <input
                className={['search-input', typed ? 'typed' : ''].join(' ')}
                type="text"
                name="search"
                id="search"
                autoFocus
                value={searchValue}
                onChange={handleSearchChange}
              />
              {typed && (
                <div className="reset-btn">
                  <CloseIcon onClick={resetSearchValue} />
                </div>
              )}
            </div>
          ) : (
            <button className="search-btn" onClick={activeSearch}>
              검색
            </button>
          )}
        </div>
        <DeviceFilter
          selectedDevices={selectedDevices}
          onToggleDevice={toggleDevice}
        />
        <PaginationBar
          pageSize={pageSize}
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          onSetPageSize={setPageSize}
          onPrevPage={goToPrevPage}
          onNextPage={goToNextPage}
        />
      </div>
    </div>
  )
}
