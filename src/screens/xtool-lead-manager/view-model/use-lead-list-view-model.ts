import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SortField,
  type PageSize,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import type { ToastType } from '@/screens/xtool-lead-manager/components'
import {
  filterLeadsByDevice,
  filterLeadsByKeywords,
  sortLeads,
} from '@/screens/xtool-lead-manager/utils'
import type { Lead } from '@/screens/xtool-lead-manager/entity'
import { leadClient } from '@/screens/xtool-lead-manager/client'

/**
 * 리드 탭의 목록 — 서버에서 받은 전체 리드(rows)와, 거기에 검색어·정렬·기기
 * 필터·페이지를 적용한 결과. 받아오는 중 표시(loading)는 저장·삭제 같은
 * 작업과 같이 쓰는 값이라 메인 view-model이 넘겨준다.
 */
export const useLeadListViewModel = ({
  setLoading,
  showToast,
}: {
  setLoading: (loading: boolean) => void
  showToast: (type: ToastType) => void
}) => {
  const [rows, setRows] = useState<Lead[]>([])
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  // 처음 목록을 받기 전인지 — 그동안은 표 자리에 스켈레톤을 그리고, 그 뒤의
  // 저장·삭제 같은 작업 중에는 전체 화면 로딩으로 중복 클릭을 막는다.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [pageSize, setPageSize] = useState<PageSize>(15)
  const [page, setPage] = useState(1)

  const { searchValue, selectedDevices } = useFilterContext()

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const res = await leadClient.getAll()

    if (!res.ok) {
      console.error('fetchLeads 실패:', res.error)
      showToast('error')
      setLoading(false)
      setHasLoaded(true)
      return
    }

    setRows(res.data.leads)
    setLoading(false)
    setHasLoaded(true)
  }, [setLoading, showToast])

  useEffect(() => {
    ;(async () => {
      await fetchLeads()
    })()
  }, [fetchLeads])

  const keywordFilteredRows = useMemo(
    () => filterLeadsByKeywords(rows, searchValue),
    [rows, searchValue],
  )

  const sortedRows = useMemo(
    () => sortLeads(keywordFilteredRows, sortField, sortDirection),
    [keywordFilteredRows, sortField, sortDirection],
  )

  const deviceFilteredRows = useMemo(
    () => filterLeadsByDevice(sortedRows, selectedDevices),
    [sortedRows, selectedDevices],
  )

  const totalRows = deviceFilteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const pagedRows = useMemo(
    () => deviceFilteredRows.slice((page - 1) * pageSize, page * pageSize),
    [deviceFilteredRows, page, pageSize],
  )

  // 검색어·정렬·기기 필터·페이지당 개수 중 뭐든 바뀌면 지금 보던 페이지 번호가
  // 더 이상 유효하지 않을 수 있어(예: 3페이지를 보다가 검색으로 결과가 1페이지
  // 분량으로 줄어드는 경우) 항상 1페이지로 되돌린다. setState를 이펙트 안에서
  // 동기 호출하면 렌더가 한 번 더 연쇄되므로, 렌더 중에 이전 키와 비교해서
  // 바뀌었을 때만 즉시 되돌리는 패턴을 쓴다(React가 권장하는 "prop이 바뀌면
  // state를 초기화" 대체 방식).
  const selectedDevicesKey = [...selectedDevices].sort().join(',')
  const paginationResetKey = `${searchValue}|${selectedDevicesKey}|${sortField}|${sortDirection}|${pageSize}`
  const [prevPaginationResetKey, setPrevPaginationResetKey] =
    useState(paginationResetKey)
  if (paginationResetKey !== prevPaginationResetKey) {
    setPrevPaginationResetKey(paginationResetKey)
    setPage(1)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const goToPrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1))
  }

  return {
    rows,
    setRows,
    fetchLeads,
    hasLoaded,
    // 표에는 검색어·정렬·기기 필터에 더해 페이지당 개수·현재 페이지까지
    // 적용된 한 페이지 분량만 넘긴다.
    pagedRows,
    // 상세 모달 왼쪽의 고객 목록용 — 같은 검색어·정렬·기기 필터가 걸린
    // 결과지만, 훑어보기용이라 페이지네이션은 적용하지 않고 전체를 준다.
    filteredRows: deviceFilteredRows,
    sortField,
    sortDirection,
    toggleSort,
    pageSize,
    setPageSize,
    page,
    totalPages,
    totalRows,
    goToPrevPage,
    goToNextPage,
  }
}
