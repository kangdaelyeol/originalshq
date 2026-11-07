import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import { useLoadWhenActive } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import type {
  MondayCustomerListItem,
  MondayLeadFeed,
} from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import {
  ALL_STATUSES,
  countByBoard,
  countByStatus,
  filterLeads,
  groupLeads,
  isMisentry,
  LEAD_FEED_PERIODS,
  leadFeedFrom,
  leadFeedRange,
  leadGroupCustomers,
  leadStatusKey,
  leadStatuses,
  searchLeads,
  sortLeadGroups,
  type LeadFeedPeriod,
} from '@/screens/xtool-lead-manager/utils'
import { koreaDate } from '@/screens/xtool-lead-manager/utils/calc'

/** 보드 거르기의 "전체". */
export const ALL_BOARDS = 'all'

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
 * 탭을 처음 열 때 지난 30일 치를 한 번 받고, 기간·검색·상태·보드는 받은 것에서
 * 거른다. 기간에서 "전체"를 고르면 그때 전부를 한 번 받고, 그 뒤로는 다른 기간도
 * 그것으로 거른다. 같은 번호의 리드는 한 묶음으로 — 가장 최근 리드가 맨 앞
 * 줄이고, 나머지는 그 줄을 펼치면 보인다. 기간은 이 브라우저에 남는다.
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
  const all = useLoadWhenActive<MondayLeadFeed | null>(
    active && wantAll,
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
  const [search, setSearch] = useState('')
  // 전체(수천 건)를 글자마다 거르면 입력이 밀린다 — 입력창은 바로, 표는 한 박자
  // 늦게 따라온다.
  const deferredSearch = useDeferredValue(search)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())

  const today = koreaDate()
  const range = useMemo(() => leadFeedRange(period, today), [period, today])
  // 기간·검색까지 건 리드 — 보드 버튼과 상태 드롭다운의 건수는 여기서 서로의
  // 거르기만 더해 센다(고르면 그 건수만큼 보이게).
  const base = useMemo(
    () =>
      data
        ? searchLeads(filterLeads(data.leads, range, null), deferredSearch)
        : [],
    [data, range, deferredSearch],
  )
  const inStatus = useMemo(
    () =>
      statusFilter === ALL_STATUSES
        ? base
        : base.filter((row) => leadStatusKey(row) === statusFilter),
    [base, statusFilter],
  )
  const inBoard = useMemo(
    () =>
      boardId === ALL_BOARDS
        ? base
        : base.filter((row) => row.boardId === boardId),
    [base, boardId],
  )
  const boardCounts = useMemo(() => countByBoard(inStatus), [inStatus])
  const statusCounts = useMemo(() => countByStatus(inBoard), [inBoard])
  // 상태 항목은 받은 리드 전체에서 — 거르기에 따라 항목이 사라지지 않게.
  const statuses = useMemo(() => (data ? leadStatuses(data.leads) : []), [data])
  const leads = useMemo(
    () =>
      boardId === ALL_BOARDS
        ? inStatus
        : inStatus.filter((row) => row.boardId === boardId),
    [inStatus, boardId],
  )
  const groups = useMemo(
    () => sortLeadGroups(groupLeads(leads), sortDirection),
    [leads, sortDirection],
  )
  const detailCustomers = useMemo(
    () => leadGroupCustomers(groups, customers),
    [groups, customers],
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
      boardCounts,
      /** 보드 "전체" 버튼의 건수. */
      boardTotal: inStatus.length,
      statusFilter,
      statuses,
      statusCounts,
      /** 상태 "전체" 항목의 건수. */
      statusTotal: inBoard.length,
      sortDirection,
      groups,
      leadCount: leads.length,
      misentryCount: leads.filter(isMisentry).length,
      openKeys,
      /** 이름을 눌러 연 고객 상세의 왼쪽 목록 — 표의 묶음 순서. */
      detailCustomers,
      syncedAt: data?.syncedAt ?? null,
    },
    actions: {
      changePeriod: setPeriod,
      changeSearch: setSearch,
      changeBoard: setBoardId,
      changeStatus: setStatusFilter,
      toggleSort,
      toggleGroup,
      reload: source.reload,
    },
  }
}
