import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/monday.scss'
import '@/screens/xtool-lead-manager/styles/monday-glass.scss'
import '@/screens/xtool-lead-manager/styles/funnel-glass.scss'
import '@/screens/xtool-lead-manager/styles/lead-feed.scss'
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import {
  AutoHeight,
  LoadingPanel,
  Segmented,
  Select,
  type SelectOption,
} from '@/components/glass'
import type { MondayLeadFeedRow } from '@/screens/xtool-lead-manager/entity'
import type { LoadStatus } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import { SearchIcon } from '@/screens/xtool-lead-manager/illustration'
import {
  ALL_CHANNELS,
  ALL_STATUSES,
  firstCallDays,
  formatLeadTime,
  formatPhoneNumber,
  isMisentry,
  LEAD_CHANNEL_LABEL,
  LEAD_CHANNEL_TITLE,
  LEAD_GROUP_BY_LABEL,
  leadKeywords,
  splitKeywords,
  LEAD_FEED_PAGE_SIZES,
  LEAD_FEED_PERIOD_LABEL,
  shortBoardName,
  type CreativeGroup,
  type GaTrackingRow,
  type LeadGroup,
} from '@/screens/xtool-lead-manager/utils'
import { formatKoreaTime } from '@/screens/xtool-lead-manager/utils/calc'
import {
  ALL_BOARDS,
  type useLeadFeedViewModel,
  type useMondayCapiViewModel,
  type useMondayViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { CloseIcon } from '../close-icon'
import { MondayCapiModal } from '../monday/monday-capi-modal'
import { MondayDetail } from '../monday/monday-detail'
import { MondaySideList } from '../monday/monday-side-list'
import { PaginationBar } from '../pagination-bar'
import { isOutsideTopModal, segmentButtonOf } from '../segmented-keys'
import { LeadTrackingModal, LeadTrackingPanel } from './lead-tracking'

type LeadFeedProps = ReturnType<typeof useLeadFeedViewModel> & {
  /** 이름을 누르면 여는 고객 상세 — Monday 고객 탭과 같은 상태·모달을 쓴다. */
  monday: Pick<ReturnType<typeof useMondayViewModel>, 'state' | 'actions'>
  /** 고객 상세의 상담·구매 기록 CAPI 전송 확인 모달. */
  capi: ReturnType<typeof useMondayCapiViewModel>
  /** 오기입 추적 재료(오기입 추적 탭과 같은 데이터) — 오기입 리드를 열 때 받는다. */
  tracking: { status: LoadStatus; rows: readonly GaTrackingRow[] }
}

/** 표 머리 — [이름, 마우스를 올리면 보이는 설명]. 맨 앞은 펼침 칸(이름 없음),
 * 그다음 인입 시각은 정렬 단추다. */
const TIME_COLUMN: [string, string] = [
  '인입 시각',
  'Monday에 기록이 만들어진 시각(웹 문의는 접수 직후) — 누르면 최신순·오래된 순이 바뀝니다',
]
const COLUMNS: [string, string | undefined][] = [
  ['보드', undefined],
  [
    '이름·연락처',
    '이름을 누르면 그 고객의 전체 기록(Monday 고객 상세)이 열립니다',
  ],
  [
    '유입',
    '매체(utm_source / utm_medium)와 캠페인(utm_campaign). 소재명(utm_content)은 아직 받지 않습니다 — Meta 광고는 캠페인 자리에 광고(소재) 이름이 들어옵니다.',
  ],
  [
    '문의 원문',
    '고객이 문의 폼에 적은 내용 — 그 칸이 있는 보드(기타 온라인 문의·[B2B] 보드)만',
  ],
  [
    '상담 메모',
    "Monday '상담내역' 칸 — 세 줄까지 보이고, 마우스를 올리면 전체가 뜹니다",
  ],
  [
    '콜백·진성·오기입',
    '상담 진행 상태와 콜백 단계. 진성 등급 칸이 아직 없어 구매확률을 대신 보입니다.',
  ],
  ['담당자', undefined],
  [
    '첫 콜',
    '인입 날부터 콜백 진행일(가장 이른 날)까지 — 콜백 칸이 날짜만 있어 일 단위입니다',
  ],
]

/** 표의 칸 수 — 맨 앞 펼침 칸 + 인입 시각 + 나머지. 소재 묶음의 머리 줄이 쓴다. */
const COLUMN_COUNT = COLUMNS.length + 2

/** 글 속 키워드(렌탈·할부·가격·원거리·학교·기관·견적)를 칠한다. */
const Highlighted = ({ text }: { text: string }) => (
  <>
    {splitKeywords(text).map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index} className="lead_feed_mark">
          {part}
        </mark>
      ) : (
        part
      ),
    )}
  </>
)

/** 보드 버튼의 키 — 보드 id가 숫자라 객체 키 순서가 바뀌지 않게 글자를 붙인다. */
const boardKey = (id: string) => `board:${id}`

/** 소재 묶음에서 처음 보이는 리드 수 — 나머지는 '더 보기'로. 한 쪽에 소재가
 * 30개라, 다 펼치면 수백~수천 줄이 된다. */
const CREATIVE_PREVIEW = 10

const firstCallLabel = (row: MondayLeadFeedRow): string => {
  const days = firstCallDays(row)
  if (days === null) return isMisentry(row) ? '-' : '아직'
  return days === 0 ? '당일' : `${days}일`
}

/** 위/아래 방향키로 위아래 버튼 묶음(기간·보드·매체)의 고른 버튼에 초점을
 * 옮긴다(고른 값은 그대로, 맨 위·맨 아래에서는 멈춘다). 메뉴 상자에 붙여 그
 * 안의 묶음끼리만 오간다. 누르면 초점이 가는 것과 좌/우는 화면 공통
 * (segmented-keys.ts). */
const moveBetweenRows = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  const group = segmentButtonOf(event.target)?.parentElement
  // 모달이 떠 있는데 초점이 그 뒤에 남아 있으면 건드리지 않는다(모달의 ↑/↓가 먼저).
  if (!group || isOutsideTopModal(event.target)) return
  const groups = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('.glass_segmented'),
  ]
  const to = groups[groups.indexOf(group) + (event.key === 'ArrowUp' ? -1 : 1)]
  // 끝에서도 막는다 — 안 막으면 화면이 스크롤된다.
  event.preventDefault()
  to?.querySelector<HTMLButtonElement>(':scope > button.active')?.focus()
}

/** 보드·매체 버튼의 이름과 건수 배지. 배지는 chars 글자만큼 자리를 미리 잡아
 * 건수가 바뀌어도 버튼 폭이 그대로다. 0건은 흐리게 — 리드가 있는 버튼이 한눈에
 * 보이게(누를 수는 있다). */
const optionLabel = (label: string, count: number, chars = 1): ReactNode => (
  <span
    className={count === 0 ? 'lead_feed_option is-empty' : 'lead_feed_option'}
  >
    {label}
    <small className="lead_feed_count" style={{ minWidth: `${chars}ch` }}>
      {count.toLocaleString('ko-KR')}
    </small>
  </span>
)

/** 상태 드롭다운에 보이는 이름 — 빈 상태는 따로 이름을 붙인다. */
const statusLabel = (status: string) => status || '(상태 없음)'

/** 이름 칸 — 번호가 있으면 고객 상세를, 오기입이면 그 리드의 오기입 추적도
 * 여는 단추. 둘 다 아니면(고객 통합에 없는 기록) 예전처럼 Monday 링크. */
const LeadName = ({
  row,
  onOpenLead,
}: {
  row: MondayLeadFeedRow
  onOpenLead: (row: MondayLeadFeedRow) => void
}) => {
  const name = row.name || '(이름 없음)'
  if (row.phone || isMisentry(row)) {
    return (
      <button
        type="button"
        className="lead_feed_name"
        title={
          row.phone ? '이 고객의 전체 기록 보기' : '이 리드의 오기입 추적 보기'
        }
        onClick={() => onOpenLead(row)}
      >
        {name}
      </button>
    )
  }
  return row.url ? (
    <a href={row.url} target="_blank" rel="noreferrer">
      {name}
    </a>
  ) : (
    <>{name}</>
  )
}

/** 리드 한 줄. 묶음의 맨 앞 줄(head)이면 맨 앞 칸에 펼침 갈매기를 두고 줄
 * 어디를 눌러도 펼친다. 펼친 줄(sub)은 옅게 칠한 모양을 쓴다. 줄이 수백 개라,
 * 받는 값이 그대로면 다시 그리지 않는다(memo — 그래서 값만 받고 함수는 고정된
 * 것만 받는다). */
const LeadRow = memo(function LeadRow({
  row,
  groupKey,
  moreCount = 0,
  open = false,
  onToggle,
  sub = false,
  onOpenLead,
}: {
  row: MondayLeadFeedRow
  /** 같은 번호의 다른 리드가 있으면 — 그 묶음의 키·남은 리드 수·펼쳤는지. */
  groupKey?: string
  moreCount?: number
  open?: boolean
  onToggle?: (key: string) => void
  sub?: boolean
  onOpenLead: (row: MondayLeadFeedRow) => void
}) {
  const toggle =
    groupKey !== undefined && moreCount > 0 && onToggle
      ? { count: moreCount, open, onToggle: () => onToggle(groupKey) }
      : null
  const misentry = isMisentry(row)
  const source = [row.utmSource, row.utmMedium].filter(Boolean).join(' / ')
  const statusHasCallback = /콜백/.test(row.status ?? '')
  const keywords = leadKeywords(row)
  // 줄을 누르면 펼친다 — 이름(고객 상세)·링크·갈매기 단추를 누른 것이거나 글자를
  // 끌어 고르던 중이면 펼치지 않는다(갈매기는 제 단추가 펼친다).
  const onRowClick = toggle
    ? (event: MouseEvent<HTMLTableRowElement>) => {
        if ((event.target as HTMLElement).closest('a, button')) return
        if (window.getSelection()?.toString()) return
        toggle.onToggle()
      }
    : undefined
  return (
    <tr
      className={[
        'lead_feed_row',
        sub ? 'is-sub' : '',
        toggle ? 'is-group' : '',
        toggle?.open ? 'is-open' : '',
      ]
        .join(' ')
        .trim()}
      onClick={onRowClick}
    >
      <td className="lead_feed_chevron_cell">
        {toggle && (
          <button
            type="button"
            className="lead_feed_chevron"
            aria-expanded={toggle.open}
            aria-label={`같은 번호의 리드 ${toggle.count}건 ${toggle.open ? '접기' : '펼치기'}`}
            onClick={toggle.onToggle}
          >
            <ChevronRight strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </td>
      <td className="lead_feed_time">
        <div className="lead_feed_time_cell">
          <span>{formatLeadTime(row)}</span>
          {toggle && (
            <span
              className="lead_feed_more"
              title={`같은 번호로 ${toggle.count}건 더 들어왔습니다`}
            >
              +{toggle.count}
            </span>
          )}
        </div>
      </td>
      <td title={row.boardName}>
        {shortBoardName(row.boardName)}
        {row.product && <small className="lead_feed_sub">{row.product}</small>}
      </td>
      <td>
        <LeadName row={row} onOpenLead={onOpenLead} />
        {row.phone ? (
          <small className="lead_feed_sub">
            {formatPhoneNumber(row.phone)}
          </small>
        ) : (
          <small
            className="lead_feed_sub is-warn"
            title="번호를 읽지 못했습니다 — Monday에서 확인이 필요합니다"
          >
            {row.phoneRaw ?? '번호 없음'}
          </small>
        )}
      </td>
      <td className="lead_feed_source">
        {source || row.utmCampaign ? (
          <>
            {source && <span>{source}</span>}
            {row.utmCampaign && (
              <small className="lead_feed_sub" title={row.utmCampaign}>
                {row.utmCampaign}
              </small>
            )}
          </>
        ) : (
          <span className="lead_feed_none">UTM 없음</span>
        )}
      </td>
      <td className="lead_feed_text">
        {/* 문의 원문·메모에 걸린 키워드 — 메모는 세 줄까지만 보여서 여기 모은다. */}
        {keywords.length > 0 && (
          <div className="lead_feed_tags">
            {keywords.map((keyword) => (
              <span key={keyword} className="lead_feed_tag">
                {keyword}
              </span>
            ))}
          </div>
        )}
        {row.inquiryMessage ? (
          <Highlighted text={row.inquiryMessage} />
        ) : (
          <span className="lead_feed_none">-</span>
        )}
      </td>
      <td className="lead_feed_text">
        {row.notes ? (
          <div className="lead_feed_memo" title={row.notes}>
            <Highlighted text={row.notes} />
          </div>
        ) : (
          <span className="lead_feed_none">-</span>
        )}
      </td>
      <td className="lead_feed_status">
        {row.status && (
          <span
            className={
              misentry ? 'lead_feed_badge is-danger' : 'lead_feed_badge'
            }
          >
            {row.status}
          </span>
        )}
        {row.callbackStage > 0 && !statusHasCallback && (
          <small className="lead_feed_sub">콜백 {row.callbackStage}단계</small>
        )}
        {row.probability && (
          <small className="lead_feed_sub">구매확률 {row.probability}</small>
        )}
        {!row.status && row.callbackStage === 0 && !row.probability && (
          <span className="lead_feed_none">-</span>
        )}
      </td>
      <td>{row.assignee ?? <span className="lead_feed_none">-</span>}</td>
      <td className="lead_feed_first_call">{firstCallLabel(row)}</td>
    </tr>
  )
})

const LeadGroupRows = memo(function LeadGroupRows({
  group,
  open,
  onToggle,
  onOpenLead,
}: {
  group: LeadGroup
  open: boolean
  onToggle: (key: string) => void
  onOpenLead: (row: MondayLeadFeedRow) => void
}) {
  return (
    <>
      <LeadRow
        row={group.head}
        groupKey={group.key}
        moreCount={group.rest.length}
        open={open}
        onToggle={onToggle}
        onOpenLead={onOpenLead}
      />
      {open &&
        group.rest.map((row) => (
          <LeadRow key={row.itemId} row={row} sub onOpenLead={onOpenLead} />
        ))}
    </>
  )
})

/** 소재 묶음 — 머리 줄(매체·소재 이름·건수) 아래 그 소재로 들어온 리드를
 * 펼쳐, 원문과 메모를 한 덩어리로 읽게 한다. 처음에는 앞 CREATIVE_PREVIEW건만,
 * 나머지는 '더 보기'로. */
const CreativeRows = memo(function CreativeRows({
  group,
  open,
  onToggle,
  onOpenLead,
}: {
  group: CreativeGroup
  /** 나머지까지 다 펼쳤는지. */
  open: boolean
  onToggle: (key: string) => void
  onOpenLead: (row: MondayLeadFeedRow) => void
}) {
  const shown = open ? group.leads : group.leads.slice(0, CREATIVE_PREVIEW)
  const hidden = group.leads.length - CREATIVE_PREVIEW
  const misentry = group.leads.filter(isMisentry).length
  const customers = new Set(group.leads.map((row) => row.phone ?? row.itemId))
    .size
  const kind =
    group.channel === 'unknown'
      ? null
      : group.channel === 'meta'
        ? '소재'
        : '캠페인'
  return (
    <>
      <tr className="lead_feed_creative_head">
        <td colSpan={COLUMN_COUNT}>
          <span className="lead_feed_creative_channel">
            {LEAD_CHANNEL_LABEL[group.channel]}
            {kind && ` ${kind}`}
          </span>
          <strong>
            {group.campaign ??
              (group.channel === 'unknown'
                ? 'UTM 없이 들어온 리드'
                : '캠페인 없음')}
          </strong>
          <span className="lead_feed_creative_counts">
            리드 {group.leads.length.toLocaleString('ko-KR')}건 · 고객{' '}
            {customers.toLocaleString('ko-KR')}명 · 오기입{' '}
            {misentry.toLocaleString('ko-KR')}건
          </span>
        </td>
      </tr>
      {shown.map((row) => (
        <LeadRow key={row.itemId} row={row} onOpenLead={onOpenLead} />
      ))}
      {hidden > 0 && (
        <tr className="lead_feed_creative_more">
          <td colSpan={COLUMN_COUNT}>
            <button type="button" onClick={() => onToggle(group.key)}>
              {open
                ? '접기'
                : `남은 ${hidden.toLocaleString('ko-KR')}건 더 보기`}
            </button>
          </td>
        </tr>
      )}
    </>
  )
})

/**
 * 리드 분석 탭 — 상담 보드에 들어온 리드를 클릭 없이 스크롤로 읽는 표(신규 인입
 * 피드). 위 줄에서 검색(이름·연락처)·상태와 쪽을, 아래 세 줄에서 기간·보드·
 * 매체를 고른다.
 * 같은 번호로 여러 번 들어온 리드는 가장 최근 리드 한 줄로 묶고, 그 줄을 누르면
 * 나머지를 펼친다. 이름을 누르면 Monday 고객 탭과 같은 고객 상세가 뜬다.
 */
export const LeadFeed = ({
  state,
  actions,
  monday,
  capi,
  tracking,
}: LeadFeedProps) => {
  const {
    status,
    loaded,
    period,
    search,
    boardId,
    boards,
    boardCounts,
    boardTotal,
    statusFilter,
    statuses,
    statusCounts,
    statusTotal,
    channelFilter,
    channelCounts,
    channelTotal,
    countChars,
    sortDirection,
    groups,
    pagedGroups,
    groupBy,
    pageRowCount,
    pageSize,
    page,
    totalPages,
    leadCount,
    misentryCount,
    openKeys,
    detailCustomers,
    trackingLead,
    syncedAt,
  } = state
  const {
    detailPhone,
    detailOwner,
    detailSummary,
    detail,
    detailFailed,
    itemUpdates,
  } = monday.state
  const { openDetail, closeDetail, loadItemUpdates, prefetchCustomers } =
    monday.actions
  const { openTracking, closeTracking, toggleGroup } = actions
  // 이 탭에서 연 상세만 그린다 — Monday 고객 탭에서 연 상세는 그 탭의 것.
  const feedDetail = detailOwner === 'feed'
  // 표 상자 — 쪽·거르기·정렬이 바뀌면(그려지는 줄이 바뀌면) 맨 위로 되돌린다.
  // 줄이 이 상자 안에서 스크롤해서, 그대로 두면 새 쪽의 중간부터 보인다.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pagedGroups])
  // 상세 머리(이름·번호) — 고객 목록을 아직 못 받았으면 받아 온 전체 기록으로.
  const detailHead = detailSummary ?? detail

  // 이름을 누르면 — 번호가 있으면 고객 상세를 열고, 오기입이면 그 리드의 오기입
  // 추적을 붙인다(번호가 없으면 추적만 따로 뜬다). 줄(memo)에 넘기므로 고정한다.
  const openLead = useCallback(
    (row: MondayLeadFeedRow) => {
      openTracking(isMisentry(row) ? row : null)
      if (row.phone) openDetail(row.phone, 'feed')
    },
    [openTracking, openDetail],
  )
  const openFeedDetail = useCallback(
    (phone: string) => openDetail(phone, 'feed'),
    [openDetail],
  )
  const closeLead = () => {
    closeDetail()
    closeTracking()
  }
  const trackingRow = trackingLead
    ? (tracking.rows.find(
        (row) => row.consultation.itemId === trackingLead.itemId,
      ) ?? null)
    : null
  const typed = search.trim() !== ''

  const boardOptions: Record<string, ReactNode> = {
    [ALL_BOARDS]: optionLabel('전체', boardTotal, countChars.total),
  }
  const boardTitles: Record<string, string> = {}
  for (const board of boards) {
    boardOptions[boardKey(board.id)] = optionLabel(
      shortBoardName(board.name),
      boardCounts[board.id] ?? 0,
      countChars.boards[board.id],
    )
    boardTitles[boardKey(board.id)] = board.name
  }

  // 매체 — 전체 + 다섯 매체 + 기타 UTM + UTM 없음, 이름 옆에 건수.
  const channelOptions: Record<string, ReactNode> = {
    [ALL_CHANNELS]: optionLabel('전체', channelTotal, countChars.total),
  }
  for (const [channel, label] of Object.entries(LEAD_CHANNEL_LABEL)) {
    channelOptions[channel] = optionLabel(
      label,
      channelCounts[channel] ?? 0,
      countChars.channels[channel],
    )
  }

  // 상태 — 받은 리드에 나온 상태 전부, 진행 순서. 고른 상태는 목록에 없어도 남긴다.
  const statusOptions: SelectOption<string>[] = [
    {
      value: ALL_STATUSES,
      label: `상태 전체 ${statusTotal.toLocaleString('ko-KR')}`,
    },
    ...[
      ...statuses,
      ...(statusFilter !== ALL_STATUSES && !statuses.includes(statusFilter)
        ? [statusFilter]
        : []),
    ].map((each) => ({
      value: each,
      label: `${statusLabel(each)} ${(statusCounts[each] ?? 0).toLocaleString('ko-KR')}`,
    })),
  ]

  return (
    <>
      {/* 버튼 묶음(기간·보드·매체)은 누르면 초점이 가고, 좌/우 방향키로 옆 버튼을
          고르며 위/아래 방향키로 묶음 사이를 오간다. */}
      <div
        className="lead_manager_nav monday_stats_nav lead_feed_nav glass_theme"
        onKeyDown={moveBetweenRows}
      >
        <div className="inner">
          <div className="search-box">
            <SearchIcon />
            <div className="search-container">
              <input
                className={['search-input', typed ? 'typed' : ''].join(' ')}
                type="text"
                name="lead-feed-search"
                placeholder="이름 · 연락처"
                value={search}
                onChange={(e) => actions.changeSearch(e.target.value)}
              />
              {typed && (
                <div className="reset-btn">
                  <CloseIcon onClick={() => actions.changeSearch('')} />
                </div>
              )}
            </div>
          </div>
          <Select
            className="lead_feed_select"
            value={statusFilter}
            options={statusOptions}
            onChange={actions.changeStatus}
            label="상담 진행 상태"
          />
          {/* 묶기 — 같은 번호(고객)로, 또는 같은 소재(utm_campaign)로. */}
          <Segmented
            options={LEAD_GROUP_BY_LABEL}
            value={groupBy}
            onChange={actions.changeGroupBy}
            label="묶기"
            size="md"
          />
          <button
            type="button"
            className="stats_reset"
            disabled={status === 'loading'}
            onClick={() => void actions.reload()}
          >
            <RefreshCw
              strokeWidth={1.8}
              className={status === 'loading' ? 'is-spinning' : undefined}
              aria-hidden="true"
            />
            새로 고침
          </button>
          {/* 쪽 넘기기 — 줄은 묶음(고객) 단위라 건수도 묶음 수다. */}
          <PaginationBar
            sizes={LEAD_FEED_PAGE_SIZES}
            pageSize={pageSize}
            page={page}
            totalPages={totalPages}
            totalRows={pageRowCount}
            onSetPageSize={actions.changePageSize}
            onPrevPage={actions.goToPrevPage}
            onNextPage={actions.goToNextPage}
          />
        </div>
        <div className="inner lead_feed_filter_row">
          <span className="stats_nav_label">기간</span>
          <Segmented
            options={LEAD_FEED_PERIOD_LABEL}
            value={period}
            onChange={actions.changePeriod}
            label="기간"
            size="md"
          />
        </div>
        <div className="inner lead_feed_filter_row">
          <span className="stats_nav_label">보드</span>
          <Segmented
            options={boardOptions}
            value={boardId === ALL_BOARDS ? ALL_BOARDS : boardKey(boardId)}
            onChange={(next) =>
              actions.changeBoard(
                next === ALL_BOARDS ? ALL_BOARDS : next.slice('board:'.length),
              )
            }
            optionTitles={boardTitles}
            label="보드"
            size="md"
          />
        </div>
        {/* 매체 — utm_source를 광고 채널로 묶은 값(cmip ROAS 탭과 같은 규칙). */}
        <div className="inner lead_feed_filter_row">
          <span className="stats_nav_label">매체</span>
          <Segmented
            options={channelOptions}
            value={channelFilter}
            onChange={actions.changeChannel}
            optionTitles={LEAD_CHANNEL_TITLE}
            label="매체"
            size="md"
          />
        </div>
      </div>

      <div className="xtool-main monday_stats lead_feed_main glass_theme">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>리드 목록을 불러오지 못했습니다.</p>
              <button type="button" onClick={() => void actions.reload()}>
                다시 시도
              </button>
            </div>
          ) : (
            <section className="stats_card">
              <AutoHeight>
                {!loaded ? (
                  <LoadingPanel
                    label={
                      period === 'all'
                        ? '리드 전체를 불러오는 중'
                        : '리드 목록을 불러오는 중'
                    }
                    minHeight={420}
                  />
                ) : (
                  <div className="glass_reveal">
                    <h2>
                      신규 인입 리드
                      <span className="lead_feed_counts">
                        리드 {leadCount.toLocaleString('ko-KR')}건 · 고객{' '}
                        {groups.length.toLocaleString('ko-KR')}명 · 오기입{' '}
                        {misentryCount.toLocaleString('ko-KR')}건
                      </span>
                    </h2>
                    <p className="stats_desc">
                      Monday 상담 보드에 들어온 기록을 한 건씩 보여 줍니다. 같은
                      번호로 여러 번 들어온 리드는 가장 최근 리드 한 줄로 묶고,
                      그 줄을 누르면 나머지가 펼쳐집니다. 이름을 누르면 그
                      고객의 전체 기록이 열립니다. '소재별'로 보면 같은
                      utm_campaign(Meta는 광고 이름)으로 들어온 리드를 한
                      덩어리로 보여 주고, 렌탈·할부·가격·원거리·학교·기관·견적은
                      색으로 칠합니다. Monday 동기화는 하루 여섯
                      번(09·11·13·15·17·22시)이라 Monday 화면보다 늦을 수
                      있습니다.
                      {syncedAt &&
                        ` 마지막 동기화 ${formatKoreaTime(syncedAt)}`}
                    </p>
                    {feedDetail &&
                      detailPhone &&
                      !detailHead &&
                      detailFailed && (
                        <p className="lead_feed_notice">
                          이 고객의 전체 기록을 찾지 못했습니다 — 다음 동기화
                          뒤에 다시 열어 보세요.
                          <button type="button" onClick={closeDetail}>
                            닫기
                          </button>
                        </p>
                      )}
                    {groups.length === 0 ? (
                      <p className="lead_feed_empty">
                        조건에 맞는 리드가 없습니다.
                      </p>
                    ) : (
                      <div className="lead_feed_scroll" ref={scrollRef}>
                        <table className="stats_table lead_feed_table">
                          <thead>
                            <tr>
                              <th
                                className="lead_feed_chevron_cell"
                                aria-label="같은 번호의 리드 펼치기"
                              />
                              <th
                                title={TIME_COLUMN[1]}
                                aria-sort={
                                  sortDirection === 'desc'
                                    ? 'descending'
                                    : 'ascending'
                                }
                              >
                                <button
                                  type="button"
                                  className="lead_feed_sort"
                                  onClick={actions.toggleSort}
                                >
                                  {TIME_COLUMN[0]}
                                  {sortDirection === 'desc' ? (
                                    <ArrowDown
                                      strokeWidth={2}
                                      aria-label="최신순"
                                    />
                                  ) : (
                                    <ArrowUp
                                      strokeWidth={2}
                                      aria-label="오래된 순"
                                    />
                                  )}
                                </button>
                              </th>
                              {COLUMNS.map(([label, title]) => (
                                <th key={label} title={title}>
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pagedGroups.map((group) =>
                              group.kind === 'creative' ? (
                                <CreativeRows
                                  key={group.key}
                                  group={group}
                                  open={openKeys.has(group.key)}
                                  onToggle={toggleGroup}
                                  onOpenLead={openLead}
                                />
                              ) : (
                                <LeadGroupRows
                                  key={group.key}
                                  group={group}
                                  open={openKeys.has(group.key)}
                                  onToggle={toggleGroup}
                                  onOpenLead={openLead}
                                />
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </AutoHeight>
            </section>
          )}
        </div>
      </div>

      {/* 고객 상세 — Monday 고객 탭과 같은 유리 모양(그 탭 이름 아래에 걸린
          스타일)이 들도록 같은 이름의 틀로 감싼다. 틀은 상자를 만들지 않는다
          (lead-feed.scss). */}
      <div className="xtool-main monday_main glass_theme lead_feed_detail">
        {feedDetail && detailPhone && detailHead && (
          <MondayDetail
            summary={detailHead}
            customer={detail}
            failed={detailFailed}
            onClose={closeLead}
            itemUpdates={itemUpdates}
            onLoadUpdates={loadItemUpdates}
            keysEnabled={!capi.state.source}
            onSendCapi={(source) => detail && capi.actions.open(detail, source)}
            sideList={
              <MondaySideList
                customers={detailCustomers}
                activePhone={detailHead.phone}
                onSelect={openFeedDetail}
                onPrefetch={prefetchCustomers}
                keysEnabled={!capi.state.source}
              />
            }
            sidePanel={
              // 왼쪽 목록으로 다른 고객으로 넘어가면 그 리드의 추적은 접는다.
              trackingLead && trackingLead.phone === detailHead.phone ? (
                <LeadTrackingPanel
                  lead={trackingLead}
                  row={trackingRow}
                  status={tracking.status}
                />
              ) : undefined
            }
          />
        )}
        {trackingLead && !trackingLead.phone && (
          <LeadTrackingModal
            lead={trackingLead}
            row={trackingRow}
            status={tracking.status}
            onClose={closeTracking}
          />
        )}
        {capi.state.source && feedDetail && <MondayCapiModal capi={capi} />}
      </div>
    </>
  )
}
