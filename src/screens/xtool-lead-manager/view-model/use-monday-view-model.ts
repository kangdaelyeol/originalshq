import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type {
  MondayCustomer,
  MondayCustomerListItem,
  MondayMissingPhoneItem,
  MondayPaymentIssueItem,
} from '@/screens/xtool-lead-manager/entity'
import type { PageSize } from '@/screens/xtool-lead-manager/types'
import {
  filterMondayCustomers,
  matchesMondayCategory,
  sortMondayCustomers,
  type MondayCategory,
  type MondaySort,
} from '@/screens/xtool-lead-manager/utils'

const CATEGORIES: MondayCategory[] = [
  'all',
  'consultation',
  'visit',
  'purchase',
  'balance',
  'multiple',
]

/** Monday 고객 탭의 상태 — 목록(검색·분류·정렬·페이지), 고객 상세, 확인이
 * 필요한 기록(번호·결제). `active`가 처음 true가 될 때 목록을 받아온다(리드
 * 탭만 쓰는 동안에는 받지 않는다). */
export const useMondayViewModel = (active: boolean) => {
  const [customers, setCustomers] = useState<MondayCustomerListItem[]>([])
  const [missingItems, setMissingItems] = useState<MondayMissingPhoneItem[]>([])
  const [paymentIssues, setPaymentIssues] = useState<MondayPaymentIssueItem[]>(
    [],
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MondayCategory>('all')
  const [sort, setSort] = useState<MondaySort>('updated')
  const [pageSize, setPageSize] = useState<PageSize>(15)
  const [page, setPage] = useState(1)

  const [detailPhone, setDetailPhone] = useState<string | null>(null)
  const [detail, setDetail] = useState<MondayCustomer | null>(null)
  const [detailFailed, setDetailFailed] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)

  const load = useCallback(async () => {
    setStatus('loading')
    const [customersRes, missingRes, issuesRes] = await Promise.all([
      mondayClient.getCustomers(),
      mondayClient.getMissingPhoneItems(),
      mondayClient.getPaymentIssues(),
    ])

    if (!customersRes.ok) {
      console.error('Monday 고객 목록 실패:', customersRes.error)
      setStatus('error')
      return
    }

    setCustomers(customersRes.data.customers)
    // 경고 목록은 부가 정보라, 실패해도 표는 보여준다.
    setMissingItems(missingRes.ok ? missingRes.data.items : [])
    setPaymentIssues(issuesRes.ok ? issuesRes.data.issues : [])
    setStatus('ready')
  }, [])

  useEffect(() => {
    if (!active || status !== 'idle') return
    ;(async () => {
      await load()
    })()
  }, [active, status, load])

  // 7천 명을 글자마다 걸러내면 입력이 밀린다 — 입력창은 바로 반응하고 표는
  // 한 박자 늦게 따라오게 한다.
  const deferredSearch = useDeferredValue(search)

  const searched = useMemo(
    () => filterMondayCustomers(customers, deferredSearch),
    [customers, deferredSearch],
  )

  /** 분류 버튼에 붙는 건수 — 검색 결과 안에서 센다. */
  const categoryCounts = useMemo(() => {
    const counts = {} as Record<MondayCategory, number>
    for (const each of CATEGORIES) {
      counts[each] = searched.filter((customer) =>
        matchesMondayCategory(customer, each),
      ).length
    }
    return counts
  }, [searched])

  const filtered = useMemo(
    () =>
      sortMondayCustomers(
        searched.filter((customer) =>
          matchesMondayCategory(customer, category),
        ),
        sort,
      ),
    [searched, category, sort],
  )

  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  // 검색·분류를 바꿔 결과가 줄면 지금 쪽 번호가 범위를 벗어날 수 있다 —
  // 상태를 고치는 대신 보여줄 때 범위 안으로 당긴다.
  const currentPage = Math.min(page, totalPages)

  const rows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  )

  const changeSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const changeCategory = useCallback((value: MondayCategory) => {
    setCategory(value)
    setPage(1)
  }, [])

  const changeSort = useCallback((value: MondaySort) => {
    setSort(value)
    setPage(1)
  }, [])

  const changePageSize = useCallback((value: PageSize) => {
    setPageSize(value)
    setPage(1)
  }, [])

  const goToPrevPage = useCallback(
    () => setPage(Math.max(1, currentPage - 1)),
    [currentPage],
  )

  const goToNextPage = useCallback(
    () => setPage(Math.min(totalPages, currentPage + 1)),
    [currentPage, totalPages],
  )

  const openDetail = useCallback(async (phone: string) => {
    setDetailPhone(phone)
    setDetail(null)
    setDetailFailed(false)

    const res = await mondayClient.getCustomer(phone)
    if (!res.ok) {
      console.error('Monday 고객 상세 실패:', res.error)
      setDetailFailed(true)
      return
    }
    // 받아오는 사이 다른 고객을 눌렀으면 늦게 온 응답은 버린다.
    setDetailPhone((current) => {
      if (current === phone) setDetail(res.data.customer)
      return current
    })
  }, [])

  const closeDetail = useCallback(() => {
    setDetailPhone(null)
    setDetail(null)
    setDetailFailed(false)
  }, [])

  const openMissing = useCallback(() => setMissingOpen(true), [])
  const closeMissing = useCallback(() => setMissingOpen(false), [])

  /** 상세 모달 머리에 바로 보여줄 요약 — 전체 기록이 오기 전에도 이름과
   * 번호는 목록에서 알 수 있다. */
  const detailSummary = useMemo(
    () => customers.find((customer) => customer.phone === detailPhone) ?? null,
    [customers, detailPhone],
  )

  return {
    state: {
      status,
      rows,
      totalCustomers: customers.length,
      search,
      category,
      categories: CATEGORIES,
      categoryCounts,
      sort,
      pageSize,
      page: currentPage,
      totalPages,
      totalRows,
      detailPhone,
      detailSummary,
      detail,
      detailFailed,
      missingItems,
      paymentIssues,
      missingOpen,
    },
    actions: {
      reload: load,
      changeSearch,
      changeCategory,
      changeSort,
      changePageSize,
      goToPrevPage,
      goToNextPage,
      openDetail,
      closeDetail,
      openMissing,
      closeMissing,
    },
  }
}
