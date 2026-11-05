import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SortField,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { usePagination } from '@/screens/xtool-lead-manager/hooks/use-pagination'
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
  active,
  setLoading,
  showToast,
}: {
  /** 리드 탭이 열려 있는지 — 처음 열 때 목록을 받는다. */
  active: boolean
  setLoading: (loading: boolean) => void
  showToast: (type: ToastType) => void
}) => {
  const [rows, setRows] = useState<Lead[]>([])
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  // 처음 목록을 받기 전인지 — 그동안은 표 자리에 스켈레톤을 그리고, 그 뒤의
  // 저장·삭제 같은 작업 중에는 전체 화면 로딩으로 중복 클릭을 막는다.
  const [hasLoaded, setHasLoaded] = useState(false)

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

  // 처음 리드 탭을 열 때 받는다 — 기본 탭(Monday 고객)만 보고 가는 동안에는
  // 리드 전체를 받지 않는다. 그 전에 다른 곳(Monday CAPI 전송 뒤 등)에서 이미
  // 받았으면 다시 받지 않는다.
  const requested = useRef(false)
  useEffect(() => {
    if (!active || requested.current || hasLoaded) return
    requested.current = true
    ;(async () => {
      await fetchLeads()
    })()
  }, [active, hasLoaded, fetchLeads])

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

  const pagination = usePagination(
    deviceFilteredRows,
    `${searchValue}|${[...selectedDevices].sort().join(',')}|${sortField}|${sortDirection}`,
  )

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  return {
    rows,
    setRows,
    fetchLeads,
    hasLoaded,
    // 표에는 검색어·정렬·기기 필터에 더해 페이지당 개수·현재 페이지까지
    // 적용된 한 페이지 분량만 넘긴다.
    pagedRows: pagination.pagedItems,
    // 상세 모달 왼쪽의 고객 목록용 — 같은 검색어·정렬·기기 필터가 걸린
    // 결과지만, 훑어보기용이라 페이지네이션은 적용하지 않고 전체를 준다.
    filteredRows: deviceFilteredRows,
    sortField,
    sortDirection,
    toggleSort,
    pageSize: pagination.pageSize,
    setPageSize: pagination.setPageSize,
    page: pagination.page,
    totalPages: pagination.totalPages,
    totalRows: pagination.totalRows,
    goToPrevPage: pagination.goToPrevPage,
    goToNextPage: pagination.goToNextPage,
  }
}
