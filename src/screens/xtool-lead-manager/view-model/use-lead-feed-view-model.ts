import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import { useLoadWhenActive } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import { usePagination } from '@/screens/xtool-lead-manager/hooks/use-pagination'
import type {
  MondayCustomerListItem,
  MondayLeadFeed,
  MondayLeadFeedRow,
} from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import {
  ALL_BOARDS,
  ALL_CHANNELS,
  ALL_STATUSES,
  countLeadsBy,
  filterLeads,
  groupByCreative,
  groupLeads,
  isMisentry,
  LEAD_FEED_PERIODS,
  LEAD_GROUP_BYS,
  leadFacets,
  leadFeedFrom,
  leadFeedRange,
  customersInOrder,
  leadStatuses,
  searchLeads,
  sortLeadGroups,
  type LeadFeedPageSize,
  type CreativeGroup,
  type LeadFeedPeriod,
  type LeadGroup,
  type LeadGroupBy,
} from '@/screens/xtool-lead-manager/utils'
import { koreaDate } from '@/screens/xtool-lead-manager/utils/calc'

/** 기간을 '전체'로 바꾼 뒤 전부를 받기 시작할 때까지 기다리는 시간. */
const PERIOD_SETTLE_MS = 400

const fetchLeadFeed = async (from?: string) => {
  const res = await mondayClient.getLeadFeed(from)
  if (!res.ok) {
    console.error('리드 분석 실패:', res)
    return null
  }
  return res.data
}

/** 최근 30일 — "전체"가 아닌 기간 보기가 쓴다. */
const fetchRecentLeadFeed = () => fetchLeadFeed(leadFeedFrom(koreaDate()))
/** 상담 보드의 기록 전부 — 기간에서 "전체"를 고를 때만 받는다(수천 건이라). */
const fetchAllLeadFeed = () => fetchLeadFeed()

/**
 * "리드 분석" 탭 — 상담 보드에 들어온 리드를 한 건씩, 클릭 없이 읽는 표.
 * 탭을 처음 열 때 지난 30일 치를 한 번 받고, 기간·검색·상태·보드·매체는 받은 것에서
 * 거른다. 기간에서 "전체"를 고르면 그때 전부를 한 번 받고, 그 뒤로는 다른 기간도
 * 그것으로 거른다. 같은 번호의 리드는 한 묶음으로 — 가장 최근 리드가 맨 앞
 * 줄이고, 나머지는 그 줄을 펼치면 보인다. 표는 묶음 30개씩(50·100개로 바꿀 수
 * 있다) 쪽으로 나눠 그린다. 기간은 이 브라우저에 남는다.
 *
 * customers(Monday 고객 목록)는 이름을 눌러 여는 고객 상세의 왼쪽 목록에 쓴다.
 */
export const useLeadFeedViewModel = (
  active: boolean,
  customers: readonly MondayCustomerListItem[],
) => {
  const [period, setPeriod] = usePersistentState<LeadFeedPeriod>(
    'xtool.leadFeed.period',
    'week',
    oneOf(LEAD_FEED_PERIODS),
  )
  const wantAll = period === 'all'
  // '전체'는 무거운 조회라 잠깐 머물러야 받기 시작한다 — 방향키로 기간을 지나가기만
  // 해도 전부를 받지 않게. 처음부터 '전체'면(기억된 값) 바로 받는다.
  const [settledPeriod, setSettledPeriod] = useState(period)
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSettledPeriod(period),
      PERIOD_SETTLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [period])
  const all = useLoadWhenActive<MondayLeadFeed | null>(
    active && wantAll && settledPeriod === 'all',
    fetchAllLeadFeed,
    null,
  )
  const recent = useLoadWhenActive<MondayLeadFeed | null>(
    active && !wantAll && all.data === null,
    fetchRecentLeadFeed,
    null,
  )
  // 지금 보는 데이터 — 전체를 받아 두었으면 어느 기간이든 그것으로.
  const source = wantAll || all.data !== null ? all : recent
  const data = source.data

  const [boardId, setBoardId] = useState<string>(ALL_BOARDS)
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES)
  const [channelFilter, setChannelFilter] = useState<string>(ALL_CHANNELS)
  const [search, setSearch] = useState('')
  // 전체(수천 건)를 글자마다 거르면 입력이 밀린다 — 입력창은 바로, 표는 한 박자
  // 늦게 따라온다.
  const deferredSearch = useDeferredValue(search)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  // 표를 고객(같은 번호)으로 묶을지, 소재(utm_campaign)로 묶을지 — 이 브라우저에
  // 남는다.
  const [groupBy, setGroupBy] = usePersistentState<LeadGroupBy>(
    'xtool.leadFeed.groupBy',
    'customer',
    oneOf(LEAD_GROUP_BYS),
  )
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  // 이름을 눌러 연 오기입 리드 — 고객 상세 오른쪽(번호가 없으면 따로 뜨는 창)에
  // 그 리드의 오기입 추적(GA4 이벤트)을 붙인다.
  const [trackingLead, setTrackingLead] = useState<MondayLeadFeedRow | null>(
    null,
  )
  const closeTracking = useCallback(() => setTrackingLead(null), [])

  const today = koreaDate()
  const range = useMemo(() => leadFeedRange(period, today), [period, today])
  // 기간·검색까지 건 리드.
  const base = useMemo(
    () =>
      data
        ? searchLeads(filterLeads(data.leads, range, null), deferredSearch)
        : [],
    [data, range, deferredSearch],
  )
  // 상태·보드·매체 거르기와 버튼마다의 건수(위에서 아래로 좁혀 간다 — leadFacets).
  const facets = useMemo(
    () =>
      leadFacets(base, {
        status: statusFilter,
        boardId,
        channel: channelFilter,
      }),
    [base, boardId, statusFilter, channelFilter],
  )
  const { leads } = facets
  // 건수 배지의 자리(글자 수) — 받은 리드 전체에서 그 버튼이 가질 수 있는 가장
  // 큰 건수의 글자 수. 기간·검색·거르기는 건수를 줄이기만 해서, 무엇을 바꿔도
  // 버튼 폭이 그대로다(받은 데이터가 바뀔 때만 — 전체를 처음 불러올 때 — 다시 잰다).
  const countChars = useMemo(() => {
    const all = data?.leads ?? []
    const chars = (count: number) => count.toLocaleString('ko-KR').length
    const charsBy = (keyOf: (row: MondayLeadFeedRow) => string) =>
      Object.fromEntries(
        Object.entries(countLeadsBy(all, keyOf)).map(([key, count]) => [
          key,
          chars(count),
        ]),
      )
    return {
      total: chars(all.length),
      boards: charsBy((row) => row.boardId),
      channels: charsBy((row) => row.channel),
    }
  }, [data])
  // 상태 항목은 받은 리드 전체에서 — 거르기에 따라 항목이 사라지지 않게.
  const statuses = useMemo(() => (data ? leadStatuses(data.leads) : []), [data])
  const groups = useMemo(
    () => sortLeadGroups(groupLeads(leads), sortDirection),
    [leads, sortDirection],
  )
  // 소재별로 볼 때의 묶음 — 같은 소재로 들어온 리드를 한 덩어리로.
  const creativeGroups = useMemo(
    () => (groupBy === 'creative' ? groupByCreative(leads, sortDirection) : []),
    [groupBy, leads, sortDirection],
  )
  // 거르기·검색·정렬·묶기가 바뀌면 1쪽으로.
  const pagination = usePagination<LeadGroup | CreativeGroup, LeadFeedPageSize>(
    groupBy === 'creative' ? creativeGroups : groups,
    `${period}|${deferredSearch}|${boardId}|${statusFilter}|${channelFilter}|${sortDirection}|${groupBy}`,
    30,
  )
  // 고객 상세 왼쪽 목록 — 표에 보이는 순서(소재별이면 소재 묶음 안의 리드 순)라
  // ↑/↓가 표의 바로 옆 줄로 간다.
  const detailCustomers = useMemo(
    () =>
      customersInOrder(
        groupBy === 'creative'
          ? creativeGroups.flatMap((group) => group.leads)
          : groups.map((group) => group.head),
        customers,
      ),
    [groupBy, creativeGroups, groups, customers],
  )

  const toggleGroup = useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const toggleSort = useCallback(
    () => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc')),
    [],
  )

  return {
    state: {
      status: source.status,
      /** 보여 줄 데이터를 받았는지 — 다시 받는 중에는 받아 둔 것을 그대로 보인다. */
      loaded: data !== null,
      period,
      range,
      search,
      boardId,
      boards: data?.boards ?? [],
      boardCounts: facets.boardCounts,
      /** 보드 "전체" 버튼의 건수. */
      boardTotal: facets.boardTotal,
      statusFilter,
      statuses,
      statusCounts: facets.statusCounts,
      /** 상태 "전체" 항목의 건수. */
      statusTotal: facets.statusTotal,
      channelFilter,
      channelCounts: facets.channelCounts,
      /** 매체 "전체" 버튼의 건수. */
      channelTotal: facets.channelTotal,
      /** 보드·매체 버튼 건수 배지의 자리(글자 수) — 키가 없으면 한 글자. */
      countChars,
      sortDirection,
      groups,
      groupBy,
      /** 쪽 넘기기의 줄 수 — 고객별이면 고객 수, 소재별이면 소재 수. */
      pageRowCount:
        groupBy === 'creative' ? creativeGroups.length : groups.length,
      /** 지금 쪽의 묶음(고객 또는 소재) — 표가 그린다. */
      pagedGroups: pagination.pagedItems,
      pageSize: pagination.pageSize,
      page: pagination.page,
      totalPages: pagination.totalPages,
      leadCount: leads.length,
      misentryCount: leads.filter(isMisentry).length,
      openKeys,
      /** 이름을 눌러 연 고객 상세의 왼쪽 목록 — 표의 묶음 순서. */
      detailCustomers,
      /** 오기입 추적을 붙일 리드(이름을 누른 오기입 리드) — 없으면 null. */
      trackingLead,
      syncedAt: data?.syncedAt ?? null,
    },
    actions: {
      changePeriod: setPeriod,
      changeSearch: setSearch,
      changeBoard: setBoardId,
      changeStatus: setStatusFilter,
      changeChannel: setChannelFilter,
      toggleSort,
      toggleGroup,
      changeGroupBy: setGroupBy,
      openTracking: setTrackingLead,
      closeTracking,
      changePageSize: pagination.setPageSize,
      goToPrevPage: pagination.goToPrevPage,
      goToNextPage: pagination.goToNextPage,
      reload: source.reload,
    },
  }
}
