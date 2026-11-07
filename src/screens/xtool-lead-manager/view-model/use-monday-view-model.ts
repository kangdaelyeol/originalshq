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
import { useLoadWhenActive } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import {
  buildMondayHighlights,
  buildMondayOverview,
  countConsultationBoards,
  filterMondayCustomers,
  todayInKorea,
  matchesConsultationBoard,
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

const NO_CUSTOMERS: {
  customers: MondayCustomerListItem[]
  missingItems: MondayMissingPhoneItem[]
  paymentIssues: MondayPaymentIssueItem[]
} = { customers: [], missingItems: [], paymentIssues: [] }

const fetchCustomers = async () => {
  const [customersRes, missingRes, issuesRes] = await Promise.all([
    mondayClient.getCustomers(),
    mondayClient.getMissingPhoneItems(),
    mondayClient.getPaymentIssues(),
  ])
  if (!customersRes.ok) {
    console.error('Monday 고객 목록 실패:', customersRes.error)
    return null
  }
  return {
    customers: customersRes.data.customers,
    // 경고 목록은 부가 정보라, 실패해도 표는 보여준다.
    missingItems: missingRes.ok ? missingRes.data.items : [],
    paymentIssues: issuesRes.ok ? issuesRes.data.issues : [],
  }
}

/** Monday 고객 탭의 상태 — 목록(검색·분류·정렬·페이지), 고객 상세, 확인이
 * 필요한 기록(번호·결제). `active`가 처음 true가 될 때 목록을 받아온다(리드
 * 탭만 쓰는 동안에는 받지 않는다). */
/** 고객 상세를 연 탭 — 그 탭에서만 상세(와 그 위 CAPI 창)를 그린다. 탭은
 * 주소(?tab=)라, 상세를 연 채 뒤로 가기로 다른 탭에 가도 따라가지 않게. */
export type DetailOwner = 'monday' | 'feed'

/** 받아 둔 고객 상세를 다시 쓰는 시간. */
const DETAIL_CACHE_MS = 10 * 60_000
/** 미리 받기를 한 번에 몇 건씩 — 지금 보는 고객 응답이 밀리지 않게 조금씩. */
const PREFETCH_CONCURRENCY = 2

/** 받아 둔 고객 — 없거나 10분이 지났으면 null. */
const freshCustomer = (
  cache: Map<string, { customer: MondayCustomer; at: number }>,
  phone: string,
): MondayCustomer | null => {
  const hit = cache.get(phone)
  return hit && Date.now() - hit.at < DETAIL_CACHE_MS ? hit.customer : null
}

export const useMondayViewModel = (active: boolean) => {
  const {
    status,
    data: { customers, missingItems, paymentIssues },
    reload,
  } = useLoadWhenActive(active, fetchCustomers, NO_CUSTOMERS)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MondayCategory>('all')
  const [sort, setSort] = useState<MondaySort>('updated')
  // 상담 보드 — null이면 모두. 고르면 그 보드에서 상담이 들어온 고객만, 최근
  // 상담순은 그 보드의 최근 상담으로.
  const [consultationBoard, setConsultationBoard] = useState<string | null>(
    null,
  )

  const [detailPhone, setDetailPhone] = useState<string | null>(null)
  const [detailOwner, setDetailOwner] = useState<DetailOwner | null>(null)
  const [detail, setDetail] = useState<MondayCustomer | null>(null)
  const [detailFailed, setDetailFailed] = useState(false)
  // 받아 둔 고객 — 왼쪽 목록에서 방향키로 오가거나 상세를 다시 열 때 바로
  // 보이게. 상세를 닫아도 10분은 남겨 두고, 그보다 오래된 것은 다시 받는다
  // (동기화는 하루 여섯 번이라 10분 안에는 거의 바뀌지 않는다).
  const detailCache = useRef(
    new Map<string, { customer: MondayCustomer; at: number }>(),
  )
  // 받는 중인 고객 — 미리 받기와 상세 열기가 같은 고객을 두 번 부르지 않게.
  const detailRequests = useRef(
    new Map<string, Promise<MondayCustomer | null>>(),
  )
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

  const inCategory = useMemo(
    () =>
      searched.filter((customer) => matchesMondayCategory(customer, category)),
    [searched, category],
  )
  /** 상담 보드 고르기 — 검색·분류 결과 안에서 보드마다 고객 수. */
  const consultationBoards = useMemo(
    () => countConsultationBoards(inCategory),
    [inCategory],
  )

  const filtered = useMemo(
    () =>
      sortMondayCustomers(
        inCategory.filter((customer) =>
          matchesConsultationBoard(customer, consultationBoard),
        ),
        sort,
        consultationBoard,
      ),
    [inCategory, consultationBoard, sort],
  )

  // 검색어·분류·보드·정렬이 바뀌면 1페이지로.
  const pagination = usePagination(
    filtered,
    `${search}|${category}|${consultationBoard ?? ''}|${sort}`,
  )

  /** 고객 한 명의 전체 기록을 받는다 — 이미 받는 중이면 그 요청을 같이 기다린다.
   * 실패면 null. */
  const fetchCustomer = useCallback((phone: string) => {
    const pending = detailRequests.current.get(phone)
    if (pending) return pending
    const request = mondayClient.getCustomer(phone).then((res) => {
      detailRequests.current.delete(phone)
      if (!res.ok) {
        console.error('Monday 고객 상세 실패:', res.error)
        return null
      }
      const now = Date.now()
      // 오래된 것은 버린다 — 오래 켜 둔 화면에서 쌓이지 않게.
      for (const [key, hit] of detailCache.current) {
        if (now - hit.at >= DETAIL_CACHE_MS) detailCache.current.delete(key)
      }
      detailCache.current.set(phone, { customer: res.data.customer, at: now })
      return res.data.customer
    })
    detailRequests.current.set(phone, request)
    return request
  }, [])

  const openDetail = useCallback(
    async (phone: string, owner: DetailOwner = 'monday') => {
      setDetailOwner(owner)
      setDetailPhone(phone)
      setDetailFailed(false)
      const cached = freshCustomer(detailCache.current, phone)
      setDetail(cached)
      if (cached) return

      const customer = await fetchCustomer(phone)
      // 받아오는 사이 다른 고객을 눌렀으면 늦게 온 응답(실패도)은 버린다.
      setDetailPhone((current) => {
        if (current === phone) {
          if (customer) setDetail(customer)
          else setDetailFailed(true)
        }
        return current
      })
    },
    [fetchCustomer],
  )

  /** 고객 상세 왼쪽 목록에서 지금 고객 둘레를 미리 받는다(monday-side-list.tsx가
   * 순서대로 넘긴다) — 지금 고객(after)을 다 받은 뒤, 두 건씩. 받아 둔 것과
   * 받는 중인 것은 건너뛴다. */
  const prefetchCustomers = useCallback(
    (phones: readonly string[], after: string) => {
      void (async () => {
        await detailRequests.current.get(after)
        const todo = phones.filter(
          (phone) => !freshCustomer(detailCache.current, phone),
        )
        for (let i = 0; i < todo.length; i += PREFETCH_CONCURRENCY) {
          await Promise.all(
            todo.slice(i, i + PREFETCH_CONCURRENCY).map(fetchCustomer),
          )
        }
      })()
    },
    [fetchCustomer],
  )

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
    setDetailOwner(null)
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
      consultationBoard,
      consultationBoards,
      sort,
      pageSize: pagination.pageSize,
      page: pagination.page,
      totalPages: pagination.totalPages,
      totalRows: pagination.totalRows,
      detailPhone,
      /** 상세를 연 탭 — 그 탭만 상세를 그린다. */
      detailOwner,
      detailSummary,
      detail,
      detailFailed,
      missingItems,
      paymentIssues,
      missingOpen,
      itemUpdates,
    },
    actions: {
      reload,
      changeSearch: setSearch,
      changeCategory: setCategory,
      changeConsultationBoard: setConsultationBoard,
      changeSort: setSort,
      changePageSize: pagination.setPageSize,
      goToPrevPage: pagination.goToPrevPage,
      goToNextPage: pagination.goToNextPage,
      openDetail,
      closeDetail,
      prefetchCustomers,
      loadItemUpdates,
      openMissing,
      closeMissing,
    },
  }
}
