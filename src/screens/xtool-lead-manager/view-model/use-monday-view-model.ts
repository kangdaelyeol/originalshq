import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type {
  MondayCustomer,
  MondayCustomerListItem,
  MondayItemUpdates,
  MondayMissingPhoneItem,
  MondayPaymentIssueItem,
} from '@/screens/xtool-lead-manager/entity'
import { usePagination } from '@/screens/xtool-lead-manager/hooks/use-pagination'
import {
  buildMondayHighlights,
  buildMondayOverview,
  filterMondayCustomers,
  todayInKorea,
  matchesMondayCategory,
  sortMondayCustomers,
  type MondayCategory,
  type MondaySort,
} from '@/screens/xtool-lead-manager/utils'

/** 받아 둔 메모·파일을 다시 받지 않고 쓰는 시간 — Monday 파일 주소가 한 시간쯤
 * 뒤 만료되므로 그보다 짧게. */
const UPDATES_FRESH_MS = 45 * 60 * 1000

/** 기록 하나의 메모·파일 받기 상태. */
export type ItemUpdatesState =
  | { status: 'loading'; at: number }
  | { status: 'ready'; at: number; data: MondayItemUpdates }
  | { status: 'error'; at: number; error: string }

const CATEGORIES: MondayCategory[] = [
  'all',
  'consultation',
  'visit',
  'purchase',
  'online',
  'tech',
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

  const [detailPhone, setDetailPhone] = useState<string | null>(null)
  const [detail, setDetail] = useState<MondayCustomer | null>(null)
  const [detailFailed, setDetailFailed] = useState(false)
  // 상세를 연 동안 받아 둔 고객 — 왼쪽 목록에서 방향키로 오가며 다시 볼 때
  // 바로 보이게. 상세를 닫으면 비운다(다시 열 땐 새로 받는다).
  const detailCache = useRef(new Map<string, MondayCustomer>())
  // 상세에서 펼친 기록의 메모·파일 — itemId별. 파일 주소가 한 시간쯤 뒤
  // 만료되어, 상세를 닫으면 비우고 오래된 것은 다시 받는다.
  const [itemUpdates, setItemUpdates] = useState<
    Record<string, ItemUpdatesState>
  >({})
  const itemUpdatesRef = useRef(itemUpdates)
  useEffect(() => {
    itemUpdatesRef.current = itemUpdates
  }, [itemUpdates])
  const [missingOpen, setMissingOpen] = useState(false)
  // 요약 카드의 "이번 달"·경과 일수 기준일 — 탭을 연 날로 고정한다.
  const [today] = useState(todayInKorea)

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

  // 검색어·분류·정렬이 바뀌면 1페이지로.
  const pagination = usePagination(filtered, `${search}|${category}|${sort}`)

  const openDetail = useCallback(async (phone: string) => {
    setDetailPhone(phone)
    setDetailFailed(false)
    const cached = detailCache.current.get(phone)
    setDetail(cached ?? null)
    if (cached) return

    const res = await mondayClient.getCustomer(phone)
    if (!res.ok) {
      console.error('Monday 고객 상세 실패:', res.error)
      // 받아오는 사이 다른 고객으로 넘어갔으면 그 고객의 실패가 아니다.
      setDetailPhone((current) => {
        if (current === phone) setDetailFailed(true)
        return current
      })
      return
    }
    detailCache.current.set(phone, res.data.customer)
    // 받아오는 사이 다른 고객을 눌렀으면 늦게 온 응답은 버린다.
    setDetailPhone((current) => {
      if (current === phone) setDetail(res.data.customer)
      return current
    })
  }, [])

  /** 기록 하나의 메모·파일을 받는다 — 이미 받았고 아직 주소가 살아 있으면
   * 그대로 둔다. */
  const loadItemUpdates = useCallback(async (itemId: string, force = false) => {
    const current = itemUpdatesRef.current[itemId]
    if (
      !force &&
      current !== undefined &&
      current.status !== 'error' &&
      Date.now() - current.at < UPDATES_FRESH_MS
    )
      return
    setItemUpdates((prev) => ({
      ...prev,
      [itemId]: { status: 'loading', at: Date.now() },
    }))
    const res = await mondayClient.getItemUpdates(itemId)
    setItemUpdates((prev) =>
      // 받는 사이 상세를 닫았으면(비워졌으면) 버린다.
      prev[itemId] === undefined
        ? prev
        : {
            ...prev,
            [itemId]: res.ok
              ? { status: 'ready', at: Date.now(), data: res.data }
              : { status: 'error', at: Date.now(), error: res.error },
          },
    )
  }, [])

  const closeDetail = useCallback(() => {
    setItemUpdates({})
    detailCache.current.clear()
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

  // 표 아래 요약 카드 — 검색·분류와 무관하게 고객 전체 기준.
  const highlights = useMemo(
    () => buildMondayHighlights(customers, today),
    [customers, today],
  )

  // 표 위 숫자 타일 — 이것도 고객 전체 기준.
  const overview = useMemo(
    () => buildMondayOverview(customers, today),
    [customers, today],
  )

  return {
    state: {
      status,
      highlights,
      overview,
      /** 걸러내지 않은 전체 고객 — 퍼널 통계가 쓴다. */
      customers,
      rows: pagination.pagedItems,
      /** 검색·분류·정렬이 걸린 전체(페이지 나누기 전) — 상세 왼쪽 목록이 쓴다. */
      filteredRows: filtered,
      totalCustomers: customers.length,
      search,
      category,
      categories: CATEGORIES,
      categoryCounts,
      sort,
      pageSize: pagination.pageSize,
      page: pagination.page,
      totalPages: pagination.totalPages,
      totalRows: pagination.totalRows,
      detailPhone,
      detailSummary,
      detail,
      detailFailed,
      missingItems,
      paymentIssues,
      missingOpen,
      itemUpdates,
    },
    actions: {
      reload: load,
      changeSearch: setSearch,
      changeCategory: setCategory,
      changeSort: setSort,
      changePageSize: pagination.setPageSize,
      goToPrevPage: pagination.goToPrevPage,
      goToNextPage: pagination.goToNextPage,
      openDetail,
      closeDetail,
      loadItemUpdates,
      openMissing,
      closeMissing,
    },
  }
}
