import { useCallback, useMemo, useState } from 'react'
import type { PageSize } from '@/screens/xtool-lead-manager/types'

/**
 * 목록 페이지 나누기 — 리드 표와 Monday 고객 표가 같이 쓴다.
 *
 * - resetKey(검색어·필터·정렬 등을 이어 붙인 문자열)나 페이지당 개수가
 *   바뀌면 1페이지로 돌아간다. setState를 이펙트에서 부르면 렌더가 한 번 더
 *   연쇄되므로, 렌더 중에 이전 키와 비교해 바뀌었을 때만 되돌린다(React가
 *   권장하는 "값이 바뀌면 state 초기화" 방식).
 * - 지우기 등으로 목록이 줄어 지금 쪽이 범위를 벗어나면 보여줄 때 마지막
 *   쪽으로 당긴다(빈 페이지가 보이지 않게).
 */
export const usePagination = <T>(items: readonly T[], resetKey: string) => {
  const [pageSize, setPageSize] = useState<PageSize>(15)
  const [page, setPage] = useState(1)

  const key = `${resetKey}|${pageSize}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setPage(1)
  }

  const totalRows = items.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pagedItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  const goToPrevPage = useCallback(
    () => setPage(Math.max(1, currentPage - 1)),
    [currentPage],
  )

  const goToNextPage = useCallback(
    () => setPage(Math.min(totalPages, currentPage + 1)),
    [currentPage, totalPages],
  )

  return {
    pagedItems,
    pageSize,
    setPageSize,
    page: currentPage,
    totalPages,
    totalRows,
    goToPrevPage,
    goToNextPage,
  }
}
