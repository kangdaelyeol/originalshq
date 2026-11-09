import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/monday.scss'
import '@/screens/xtool-lead-manager/styles/monday-glass.scss'
import '@/screens/xtool-lead-manager/styles/funnel-glass.scss'
import '@/screens/xtool-lead-manager/styles/lead-feed.scss'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AutoHeight, LoadingPanel, Segmented } from '@/components/glass'
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import type { MondayLeadFeedRow } from '@/screens/xtool-lead-manager/entity'
import type { LoadStatus } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import { SearchIcon } from '@/screens/xtool-lead-manager/illustration'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import {
  ALL_BOARDS,
  ALL_CHANNELS,
  ALL_CREATIVES,
  ALL_STATUSES,
  firstCallDays,
  formatLeadTime,
  formatPhoneNumber,
  isMisentry,
  LEAD_CHANNEL_LABEL,
  LEAD_CHANNEL_TITLE,
  LEAD_GROUP_BY_LABEL,
  splitKeywords,
  LEAD_FEED_PAGE_SIZES,
  LEAD_FEED_PERIOD_LABEL,
  shortBoardName,
  type CreativeGroup,
  type GaTrackingRow,
  type LeadGroup,
} from '@/screens/xtool-lead-manager/utils'
import { formatKoreaTime } from '@/screens/xtool-lead-manager/utils/calc'
import type {
  useLeadFeedViewModel,
  useMondayCapiViewModel,
  useMondayViewModel,
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

/** 글 속 키워드(렌탈·할부·가격·원거리·학교·기관·견적)를 칠한다. */
const Highlighted = ({ text }: { text: string }) => (
  <>
    {splitKeywords(text).map((part, index) =>
      part.keyword ? (
        <mark key={index} className="lead_feed_mark">
          {part.text}
        </mark>
      ) : (
        part.text
      ),
    )}
  </>
)

// 전체보기를 열고 닫을 때 — 표 카드가 제자리에서 화면 전체로(닫으면 거꾸로)
// 자라는 전환(View Transitions). 카드 이름(view-transition-name)은 전환하는
// 동안에만 붙인다(lead-feed.scss) — 이름이 붙은 요소는 흐림의 경계가 돼서.
const MORPHING = 'lead_feed_morphing'
const morph = (update: () => void) => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced) {
    update()
    return
  }
  const root = document.documentElement
  root.classList.add(MORPHING)
  const transition = document.startViewTransition(() => flushSync(update))
  transition.finished.finally(() => root.classList.remove(MORPHING))
}

// 문의 원문·상담 메모 전체 판 — 마우스를 올리고 이만큼 머물면 띄우고, 떠난 뒤
// 이만큼 지나면 닫는다(칸 사이, 칸에서 판으로 옮겨 가는 틈에 닫히지 않게).
const TEXT_POP_OPEN_MS = 250
const TEXT_POP_CLOSE_MS = 150
const TEXT_POP_W = 560

/** 판 자리 — 두 칸 바로 아래, 아래 공간이 모자라면 위. 화면 밖으로 나가지
 * 않게 왼쪽·높이를 맞춘다. */
const textPopStyle = (rect: DOMRect): CSSProperties => {
  const left = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - TEXT_POP_W - 8),
  )
  const below = window.innerHeight - rect.bottom
  return below >= 260 || below >= rect.top
    ? { left, top: rect.bottom + 6, maxHeight: below - 14 }
    : {
        left,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: rect.top - 14,
      }
}

/**
 * 문의 원문·상담 메모 전체 판(줄 하나). 두 칸은 두 줄까지 보이고 넘치면 …로
 * 끝난다. 두 칸을 한 범위로 보아 어느 칸에 마우스를 올려도 같은 판이 두 글을
 * 다 보인다 — 칸 사이를 옮겨도 닫혔다 열리지 않는다. 두 칸 다 잘리지 않았으면
 * 띄우지 않는다. 판으로 마우스를 옮겨도 닫히지 않아 긴 글은 스크롤해 읽고 글자를
 * 고를 수 있다. 판은 표의 스크롤 상자에 잘리지 않게 화면 맨 위 층에 띄우고,
 * 표·화면을 스크롤(판 안 스크롤은 빼고)하거나 Esc를 누르면 닫는다(자리가
 * 어긋나서).
 */
const useTextPreview = (row: MondayLeadFeedRow) => {
  const timer = useRef(0)
  const popRef = useRef<HTMLDivElement>(null)
  // 띄운 판 — 두 칸을 합친 자리와 그릴 곳(화면 맨 위 층). 열 때 재 둔다.
  const [pop, setPop] = useState<{ rect: DOMRect; host: Element } | null>(null)
  const later = (next: () => void, ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(next, ms)
  }
  const keep = () => window.clearTimeout(timer.current)
  const close = () => later(() => setPop(null), TEXT_POP_CLOSE_MS)
  const open = (event: MouseEvent<HTMLElement>) => {
    if (pop) {
      keep()
      return
    }
    const tr = event.currentTarget.closest('tr')
    if (!tr) return
    const clipped = [
      ...tr.querySelectorAll<HTMLElement>('.lead_feed_clamp'),
    ].some((box) => box.scrollHeight > box.clientHeight + 1)
    if (!clipped) return
    later(() => {
      const cells = [
        ...tr.querySelectorAll<HTMLElement>('td.lead_feed_text'),
      ].map((cell) => cell.getBoundingClientRect())
      const left = Math.min(...cells.map((cell) => cell.left))
      const top = Math.min(...cells.map((cell) => cell.top))
      const right = Math.max(...cells.map((cell) => cell.right))
      const bottom = Math.max(...cells.map((cell) => cell.bottom))
      setPop({
        rect: new DOMRect(left, top, right - left, bottom - top),
        host: tr.closest('.glass_root') ?? document.body,
      })
    }, TEXT_POP_OPEN_MS)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!pop) return
    const hide = () => setPop(null)
    const onScroll = (event: Event) => {
      if (popRef.current?.contains(event.target as Node)) return
      hide()
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('keydown', onKey)
    }
  }, [pop])

  const popup =
    pop &&
    createPortal(
      <div
        ref={popRef}
        className="lead_feed_text_pop"
        role="dialog"
        aria-label="문의 원문·상담 메모 전체"
        style={textPopStyle(pop.rect)}
        onMouseEnter={keep}
        onMouseLeave={close}
        // 판은 표 밖에 그려도 React 이벤트는 줄(tr)로 올라간다 — 판을 눌러도
        // 줄이 펼쳐지지 않게.
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lead_feed_text_pop__head">
          <b>{row.name || '(이름 없음)'}</b>
          <span>
            {formatLeadTime(row)} · {row.boardName}
          </span>
        </div>
        <section>
          <h4>문의 원문</h4>
          {row.inquiryMessage ? (
            <Highlighted text={row.inquiryMessage} />
          ) : (
            <span className="lead_feed_text_pop__none">없음</span>
          )}
        </section>
        <section>
          <h4>상담 메모</h4>
          {row.notes ? (
            <Highlighted text={row.notes} />
          ) : (
            <span className="lead_feed_text_pop__none">없음</span>
          )}
        </section>
      </div>,
      pop.host,
    )
  return { cell: { onMouseEnter: open, onMouseLeave: close }, popup }
}

/** 보드 버튼의 키 — 보드 id가 숫자라 객체 키 순서가 바뀌지 않게 글자를 붙인다. */
const boardKey = (id: string) => `board:${id}`

/** 표 상자의 가장 작은 높이 — 화면이 아주 낮으면 이보다 줄이지 않고 페이지가
 * 스크롤한다. */
const LEAD_FEED_MIN_SCROLL = 240

/** 소재 묶음에서 처음 보이는 리드 수 — 나머지는 '더 보기'로. 한 쪽에 소재가
 * 30개라, 다 펼치면 수백~수천 줄이 된다. */
const CREATIVE_PREVIEW = 10

/** 소재 묶음의 이름 — utm_campaign, 없으면 그 까닭. */
const creativeName = (group: CreativeGroup): string =>
  group.campaign ??
  (group.channel === 'unknown' ? 'UTM 없이 들어온 리드' : '캠페인 없음')

const firstCallLabel = (row: MondayLeadFeedRow): string => {
  const days = firstCallDays(row)
  if (days === null) return isMisentry(row) ? '-' : '아직'
  return days === 0 ? '당일' : `${days}일`
}

/** 위/아래 방향키로 위아래 버튼 묶음(기간·상태·보드·매체)의 고른 버튼에 초점을
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
 * 보이게(누를 수도 없다 — disabledOptions). */
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

/** 상태 버튼의 키 — 빈 상태('')도 키가 되게 글자를 붙인다. */
const STATUS_KEY_PREFIX = 'status:'
const statusKey = (status: string) => `${STATUS_KEY_PREFIX}${status}`

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

/** 칸이 줄을 그릴 때 받는 것 — 같은 번호의 리드 묶음(그 묶음의 맨 앞 줄일
 * 때만)과 이름 단추. */
interface LeadCellContext {
  toggle: { count: number; open: boolean; onToggle: () => void } | null
  onOpenLead: (row: MondayLeadFeedRow) => void
}

/** 표의 칸 하나 — 머리글과 그 칸의 값을 한곳에 둔다. */
interface LeadColumn {
  key: string
  /** 머리글. */
  label: string
  /** 머리글에 마우스를 올리면 보이는 설명. */
  title?: string
  /** 머리글을 비우고 label은 화면 읽기 프로그램에만(맨 앞 펼침 칸). */
  hideLabel?: boolean
  /** 머리글이 정렬 단추다(인입 시각). */
  sortable?: boolean
  /** 머리글·칸에 같이 붙는 클래스(lead-feed.scss). */
  className?: string
  /** 마우스를 올리면 문의 원문·상담 메모 전체 판을 띄우는 칸(useTextPreview). */
  preview?: boolean
  /** 칸에 마우스를 올리면 보이는 것. */
  cellTitle?: (row: MondayLeadFeedRow) => string
  cell: (row: MondayLeadFeedRow, context: LeadCellContext) => ReactNode
}

/** 리드 표의 칸 — 머리글과 줄이 이 순서대로 그린다. 칸을 더하거나 옮길 때는
 * 여기만 고친다(소재 묶음의 머리 줄 폭도 칸 수를 따라간다). */
const LEAD_COLUMNS: readonly LeadColumn[] = [
  {
    key: 'toggle',
    label: '같은 번호의 리드 펼치기',
    hideLabel: true,
    className: 'lead_feed_chevron_cell',
    cell: (_row, { toggle }) =>
      toggle && (
        <button
          type="button"
          className="lead_feed_chevron"
          aria-expanded={toggle.open}
          aria-label={`같은 번호의 리드 ${toggle.count}건 ${toggle.open ? '접기' : '펼치기'}`}
          onClick={toggle.onToggle}
        >
          <ChevronRight strokeWidth={2} aria-hidden="true" />
        </button>
      ),
  },
  {
    key: 'time',
    label: '인입 시각',
    title:
      'Monday에 기록이 만들어진 시각(웹 문의는 접수 직후) — 누르면 최신순·오래된 순이 바뀝니다',
    sortable: true,
    className: 'lead_feed_time',
    cell: (row, { toggle }) => (
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
    ),
  },
  {
    key: 'board',
    label: '보드',
    cellTitle: (row) => row.boardName,
    cell: (row) => (
      <>
        {shortBoardName(row.boardName)}
        {row.product && <small className="lead_feed_sub">{row.product}</small>}
      </>
    ),
  },
  {
    key: 'name',
    label: '이름·연락처',
    title: '이름을 누르면 그 고객의 전체 기록(Monday 고객 상세)이 열립니다',
    cell: (row, { onOpenLead }) => (
      <>
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
      </>
    ),
  },
  {
    key: 'source',
    label: '유입',
    title:
      '매체(utm_source / utm_medium)와 캠페인(utm_campaign). 소재명(utm_content)은 아직 받지 않습니다 — Meta 광고는 캠페인 자리에 광고(소재) 이름이 들어옵니다.',
    className: 'lead_feed_source',
    cell: (row) => {
      const source = [row.utmSource, row.utmMedium].filter(Boolean).join(' / ')
      if (!source && !row.utmCampaign) {
        return <span className="lead_feed_none">UTM 없음</span>
      }
      return (
        <>
          {source && <span>{source}</span>}
          {row.utmCampaign && (
            <small className="lead_feed_sub" title={row.utmCampaign}>
              {row.utmCampaign}
            </small>
          )}
        </>
      )
    },
  },
  {
    key: 'inquiry',
    label: '문의 원문',
    title:
      "Monday '고객 문의 상세 내용' 칸 — 고객이 웹 문의 폼에 적은 내용(웹 문의를 받는 보드에만 있어 오프라인·개인 보드는 '-'). 두 줄까지 보이고, 마우스를 올리면 상담 메모와 같이 전체가 뜹니다",
    className: 'lead_feed_text',
    preview: true,
    // 글은 두 줄까지 — 키워드는 글 속에서 칠하기만 한다(상담 메모와 같이).
    cell: (row) =>
      row.inquiryMessage ? (
        <div className="lead_feed_clamp">
          <Highlighted text={row.inquiryMessage} />
        </div>
      ) : (
        <span className="lead_feed_none">-</span>
      ),
  },
  {
    key: 'notes',
    label: '상담 메모',
    title:
      "Monday '상담내역' 칸 — 두 줄까지 보이고, 마우스를 올리면 문의 원문과 같이 전체가 뜹니다",
    className: 'lead_feed_text',
    preview: true,
    cell: (row) =>
      row.notes ? (
        <div className="lead_feed_clamp">
          <Highlighted text={row.notes} />
        </div>
      ) : (
        <span className="lead_feed_none">-</span>
      ),
  },
  {
    key: 'status',
    label: '콜백·진성·오기입',
    title:
      '상담 진행 상태와 콜백 단계. 진성 등급 칸이 아직 없어 구매확률을 대신 보입니다.',
    className: 'lead_feed_status',
    cell: (row) => {
      const statusHasCallback = /콜백/.test(row.status ?? '')
      return (
        <>
          {row.status && (
            <span
              className={
                isMisentry(row)
                  ? 'lead_feed_badge is-danger'
                  : 'lead_feed_badge'
              }
            >
              {row.status}
            </span>
          )}
          {row.callbackStage > 0 && !statusHasCallback && (
            <small className="lead_feed_sub">
              콜백 {row.callbackStage}단계
            </small>
          )}
          {row.probability && (
            <small className="lead_feed_sub">구매확률 {row.probability}</small>
          )}
          {!row.status && row.callbackStage === 0 && !row.probability && (
            <span className="lead_feed_none">-</span>
          )}
        </>
      )
    },
  },
  {
    key: 'assignee',
    label: '담당자',
    cell: (row) => row.assignee ?? <span className="lead_feed_none">-</span>,
  },
  {
    key: 'firstCall',
    label: '첫 콜',
    title:
      '인입 날부터 콜백 진행일(가장 이른 날)까지 — 콜백 칸이 날짜만 있어 일 단위입니다',
    className: 'lead_feed_first_call',
    cell: firstCallLabel,
  },
]

/** 머리글 한 칸 — 정렬 칸이면 누르면 최신순 ↔ 오래된 순이 바뀌는 단추. */
const LeadHead = ({
  column,
  sortDirection,
  onToggleSort,
}: {
  column: LeadColumn
  sortDirection: SortDirection
  onToggleSort: () => void
}) => {
  if (column.hideLabel) {
    return <th className={column.className} aria-label={column.label} />
  }
  if (!column.sortable) {
    return (
      <th className={column.className} title={column.title}>
        {column.label}
      </th>
    )
  }
  return (
    <th
      className={column.className}
      title={column.title}
      aria-sort={sortDirection === 'desc' ? 'descending' : 'ascending'}
    >
      <button type="button" className="lead_feed_sort" onClick={onToggleSort}>
        {column.label}
        {sortDirection === 'desc' ? (
          <ArrowDown strokeWidth={2} aria-label="최신순" />
        ) : (
          <ArrowUp strokeWidth={2} aria-label="오래된 순" />
        )}
      </button>
    </th>
  )
}

/** 리드 한 줄 — 칸은 LEAD_COLUMNS 순서. 묶음의 맨 앞 줄(head)이면 맨 앞 칸에
 * 펼침 갈매기를 두고 줄 어디를 눌러도 펼친다. 펼친 줄(sub)은 옅게 칠한 모양을
 * 쓴다. 줄이 수백 개라, 받는 값이 그대로면 다시 그리지 않는다(memo — 그래서
 * 값만 받고 함수는 고정된 것만 받는다). */
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
  // 줄을 누르면 펼친다 — 이름(고객 상세)·링크·갈매기 단추를 누른 것이거나 글자를
  // 끌어 고르던 중이면 펼치지 않는다(갈매기는 제 단추가 펼친다).
  const onRowClick = toggle
    ? (event: MouseEvent<HTMLTableRowElement>) => {
        if ((event.target as HTMLElement).closest('a, button')) return
        if (window.getSelection()?.toString()) return
        toggle.onToggle()
      }
    : undefined
  const context: LeadCellContext = { toggle, onOpenLead }
  const preview = useTextPreview(row)
  return (
    <>
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
        {LEAD_COLUMNS.map((column) => (
          <td
            key={column.key}
            className={column.className}
            title={column.cellTitle?.(row)}
            {...(column.preview ? preview.cell : undefined)}
          >
            {column.cell(row, context)}
          </td>
        ))}
      </tr>
      {preview.popup}
    </>
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
  // 소재 하나를 골라 쪽으로 나눠 볼 때는 이 쪽의 리드만, '더 보기' 없이.
  const shown =
    group.pageLeads ??
    (open ? group.leads : group.leads.slice(0, CREATIVE_PREVIEW))
  const hidden = group.pageLeads ? 0 : group.leads.length - CREATIVE_PREVIEW
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
        <td colSpan={LEAD_COLUMNS.length}>
          <span className="lead_feed_creative_channel">
            {LEAD_CHANNEL_LABEL[group.channel]}
            {kind && ` ${kind}`}
          </span>
          <strong>{creativeName(group)}</strong>
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
          <td colSpan={LEAD_COLUMNS.length}>
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
 * 피드). 위 줄에서 검색(이름·연락처)과 쪽을, 아래 네 줄에서 기간·상태·보드·
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
    customRange,
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
    creativeGroups,
    creativeFilter,
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

  // 전체보기 — 표 카드를 화면 전체에 띄우고 위 메뉴(검색·거르기)는 숨긴다. 카드는
  // .glass_root로 옮겨 그린다(포털): 제자리의 조상(유리 카드의 backdrop-filter
  // 등)이 position: fixed의 기준이 되면 화면 전체로 못 펴진다. 띄울 곳은 누를 때
  // 정해 둔다(그릴 때 DOM을 읽지 않게).
  // 거르기 접기 — 기간·상태·보드·매체(소재별이면 소재까지) 줄을 고른 값만 적은
  // 한 줄로 접어 둔다(처음에도 접힌 채). 그 줄을 누르면 펼치고, 표 카드를
  // 누르거나 펼친 줄에서 Enter·Esc를 누르면 다시 접는다.
  const [filtersFolded, setFiltersFolded] = useState(true)
  // 기간에서 '직접 설정'을 누른 때만 달력을 펼친 채로 띄운다(기억된 '직접
  // 설정'으로 화면을 열 때는 닫힌 채).
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const changePeriod = (next: typeof period) => {
    setCustomPickerOpen(next === 'custom')
    actions.changePeriod(next)
  }
  const filtersRef = useRef<HTMLDivElement>(null)
  // 펼치면 첫 줄(기간)의 고른 버튼에, 키로 접으면 접힌 줄에 초점 — 방향키로
  // 바로 고르고 Enter로 접게. 마우스로 표를 눌러 접을 때는 옮기지 않는다.
  const foldFocus = useRef(false)
  const foldFilters = (focus = false) => {
    foldFocus.current = focus
    setFiltersFolded(true)
  }
  const unfoldFilters = () => {
    foldFocus.current = true
    setFiltersFolded(false)
  }
  useEffect(() => {
    if (!foldFocus.current) return
    foldFocus.current = false
    filtersRef.current
      ?.querySelector<HTMLButtonElement>(
        filtersFolded
          ? '.lead_feed_filter_summary'
          : '.glass_segmented > button.active',
      )
      ?.focus()
  }, [filtersFolded])
  // 펼친 동안 Esc는 어디서 눌러도 접는다(모달·전체 판·전체보기·날짜 달력이
  // 떠 있으면 그쪽이 먼저). 먼저 듣는다(capture) — 달력은 문서에서 Esc를 듣고
  // 바로 닫혀서, 뒤에 들으면 달력이 이미 사라진 뒤라 같이 접혀 버린다.
  useEffect(() => {
    if (filtersFolded) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (
        document.querySelector(
          '[aria-modal="true"], .lead_feed_text_pop, .lead_feed_expanded, .date-range-picker__popover',
        )
      ) {
        return
      }
      foldFocus.current = true
      setFiltersFolded(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [filtersFolded])
  // 펼친 줄 안의 Enter — 방향키로 고른 뒤 Enter로 끝낸다.
  const onFiltersKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || filtersFolded) return
    if (!(event.target as HTMLElement).closest('.glass_segmented')) return
    event.preventDefault()
    foldFilters(true)
  }

  const [expandHost, setExpandHost] = useState<Element | null>(null)
  const expanded = expandHost !== null
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  // 열고 닫은 뒤 같은 자리의 버튼(열기 ↔ 닫기)에 초점을 둔다 — 처음 그릴 때는
  // 두지 않는다(페이지를 열자마자 초점을 가져가지 않게).
  const expandToggled = useRef(false)
  const openExpanded = (event: MouseEvent<HTMLElement>) => {
    expandToggled.current = true
    const host = event.currentTarget.closest('.glass_root') ?? document.body
    morph(() => setExpandHost(host))
  }
  const closeExpanded = () => {
    expandToggled.current = true
    morph(() => setExpandHost(null))
  }
  useEffect(() => {
    if (expandToggled.current) expandButtonRef.current?.focus()
  }, [expanded])
  useEffect(() => {
    if (!expanded) return
    // 뒤 페이지가 같이 스크롤되지 않게 잠그고, Esc로 닫는다 — 고객 상세 같은
    // 모달이나 메모 미리보기가 떠 있으면 그쪽이 먼저 닫히게 넘긴다.
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"], .lead_feed_text_pop')) {
        return
      }
      closeExpanded()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  // 표 상자 높이 — 페이지(헤더·메뉴·카드·푸터)가 화면 높이에 딱 맞게. 표 상자
  // 위(헤더·메뉴·카드 머리)는 자리로, 아래(카드·본문의 아래 여백·테두리와 푸터
  // 높이)는 스타일 값으로 재서 남는 만큼을 준다 — 그래서 페이지는 스크롤하지
  // 않고 표만 스크롤한다. 아래를 자리로 재지 않는 건, 표 높이가 바뀌면 카드가
  // 높이를 따라 천천히 자라서(AutoHeight) 그동안 잰 자리가 어긋나기 때문이다.
  // 메뉴를 접고 펴는 동안(높이가 매 프레임 바뀜)·창 크기·쪽이 바뀔 때 다시 잰다.
  const mainRef = useRef<HTMLDivElement>(null)
  const hasRows = groups.length > 0
  // 카드가 높이를 따라 천천히 자라는 것(AutoHeight)은 처음 불러올 때(불러오는 판
  // → 표)만 — 그 뒤 표 상자 높이가 바뀔 때(메뉴 접기·창 크기)까지 천천히
  // 따라가면 카드 아래가 표보다 늦어 페이지가 잠깐 길어지거나 표 끝이 잘린다.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => setSettled(true), 900)
    return () => window.clearTimeout(timer)
  }, [loaded])
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const fit = () => {
      const box = main.querySelector<HTMLElement>('.lead_feed_scroll')
      if (!box) return
      const footer = document.querySelector('.lead_manager_footer')
      let below = footer ? footer.getBoundingClientRect().height : 0
      for (
        let el: HTMLElement | null = box;
        el && el !== main.parentElement;
        el = el.parentElement
      ) {
        const style = getComputedStyle(el)
        below += parseFloat(style.marginBottom) || 0
        if (el !== box) {
          below += parseFloat(style.paddingBottom) || 0
          below += parseFloat(style.borderBottomWidth) || 0
        }
      }
      const above = box.getBoundingClientRect().top + window.scrollY
      const height = Math.max(
        LEAD_FEED_MIN_SCROLL,
        Math.floor(window.innerHeight - above - below),
      )
      main.style.setProperty('--lead-feed-fit', `${height}px`)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(document.body)
    const nav = document.querySelector('.lead_feed_nav')
    if (nav) observer.observe(nav)
    window.addEventListener('resize', fit)
    // 크기는 그대로 자리만 옮기는 움직임(카드가 떠오르는 glass_reveal 등)이
    // 끝난 뒤에도 — 크기 감시로는 안 잡힌다.
    document.addEventListener('animationend', fit, true)
    document.addEventListener('transitionend', fit, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
      document.removeEventListener('animationend', fit, true)
      document.removeEventListener('transitionend', fit, true)
    }
  }, [loaded, expanded, hasRows])

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

  // 0건 버튼은 누를 수 없게(좌/우 방향키도 건너뛴다) — 지금 골라 둔 버튼은 0건이
  // 돼도 남긴다(다른 거르기를 바꿔 0건이 된 경우 — 끄면 고른 버튼이 사라진다).
  const disabledBoards: string[] = []
  const disabledChannels: string[] = []
  const disabledStatuses: string[] = []

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
    if (!boardCounts[board.id] && boardId !== board.id) {
      disabledBoards.push(boardKey(board.id))
    }
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
    if (!channelCounts[channel] && channelFilter !== channel) {
      disabledChannels.push(channel)
    }
  }

  // 상태 — 받은 리드에 나온 상태 전부, 진행 순서. 고른 상태는 목록에 없어도
  // 남긴다. 상태 값('' = 상태 없음)이 버튼 키와 섞이지 않게 앞에 글자를 붙인다.
  const statusOptions: Record<string, ReactNode> = {
    [ALL_STATUSES]: optionLabel('전체', statusTotal, countChars.total),
  }
  for (const each of [
    ...statuses,
    ...(statusFilter !== ALL_STATUSES && !statuses.includes(statusFilter)
      ? [statusFilter]
      : []),
  ]) {
    statusOptions[statusKey(each)] = optionLabel(
      statusLabel(each),
      statusCounts[each] ?? 0,
      countChars.statuses[each],
    )
    if (!statusCounts[each] && statusFilter !== each) {
      disabledStatuses.push(statusKey(each))
    }
  }

  // 소재 거르기(소재별 보기) — 전체 + 소재 묶음마다(리드가 있는 것만).
  const creativeOptions: Record<string, ReactNode> = {
    [ALL_CREATIVES]: optionLabel(
      '전체',
      creativeGroups.reduce((sum, group) => sum + group.leads.length, 0),
    ),
  }
  const creativeTitles: Record<string, string> = {}
  for (const group of creativeGroups) {
    const name = creativeName(group)
    creativeOptions[group.key] = (
      <span className="lead_feed_option lead_feed_creative_option">
        <small className="lead_feed_creative_option__channel">
          {LEAD_CHANNEL_LABEL[group.channel]}
        </small>
        <span className="lead_feed_creative_option__name">{name}</span>
        <small className="lead_feed_count">
          {group.leads.length.toLocaleString('ko-KR')}
        </small>
      </span>
    )
    creativeTitles[group.key] = `${LEAD_CHANNEL_LABEL[group.channel]} · ${name}`
  }
  const selectedCreative = creativeGroups.find(
    (group) => group.key === creativeFilter,
  )

  const boardName = boards.find((board) => board.id === boardId)?.name
  const filterSummary: [string, string][] = [
    [
      '기간',
      period === 'custom'
        ? `${customRange[0].slice(5).replace('-', '.')} ~ ${customRange[1].slice(5).replace('-', '.')}`
        : LEAD_FEED_PERIOD_LABEL[period],
    ],
    [
      '상태',
      statusFilter === ALL_STATUSES ? '전체' : statusLabel(statusFilter),
    ],
    [
      '보드',
      boardId === ALL_BOARDS || !boardName ? '전체' : shortBoardName(boardName),
    ],
    [
      '매체',
      channelFilter === ALL_CHANNELS
        ? '전체'
        : (LEAD_CHANNEL_LABEL[
            channelFilter as keyof typeof LEAD_CHANNEL_LABEL
          ] ?? channelFilter),
    ],
    ...(groupBy === 'creative'
      ? [
          [
            '소재',
            selectedCreative ? creativeName(selectedCreative) : '전체',
          ] as [string, string],
        ]
      : []),
  ]

  const pagination = (
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
  )
  const countsLabel = (
    <span className="lead_feed_counts">
      리드 {leadCount.toLocaleString('ko-KR')}건 · 고객{' '}
      {groups.length.toLocaleString('ko-KR')}명 · 오기입{' '}
      {misentryCount.toLocaleString('ko-KR')}건
    </span>
  )
  // 표 머리 줄 오른쪽 — 마지막 동기화 시각(동기화 시간표는 마우스를 올리면).
  const syncedLabel = syncedAt && (
    <span
      className="lead_feed_synced"
      title="Monday 동기화는 하루 여섯 번(09·11·13·15·17·22시)이라 Monday 화면보다 늦을 수 있습니다"
    >
      마지막 동기화 {formatKoreaTime(syncedAt)}
    </span>
  )
  // 표 왼쪽 위 — 전체보기 열기/닫기(한 번에 한 곳에만 그린다: 초점용 ref가 하나).
  const expandButton = (
    <button
      type="button"
      ref={expandButtonRef}
      className="lead_feed_expand"
      aria-pressed={expanded}
      onClick={expanded ? closeExpanded : openExpanded}
    >
      {expanded ? (
        <Minimize2 strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Maximize2 strokeWidth={1.8} aria-hidden="true" />
      )}
      {expanded ? '전체보기 닫기' : '전체보기'}
    </button>
  )
  const tableBlock =
    groups.length === 0 ? (
      <p className="lead_feed_empty">조건에 맞는 리드가 없습니다.</p>
    ) : (
      <div className="lead_feed_scroll" ref={scrollRef}>
        <table className="stats_table lead_feed_table">
          <thead>
            <tr>
              {LEAD_COLUMNS.map((column) => (
                <LeadHead
                  key={column.key}
                  column={column}
                  sortDirection={sortDirection}
                  onToggleSort={actions.toggleSort}
                />
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
    )

  return (
    <>
      {/* 버튼 묶음(기간·상태·보드·매체)은 누르면 초점이 가고, 좌/우 방향키로 옆 버튼을
          고르며 위/아래 방향키로 묶음 사이를 오간다. */}
      {/* 전체보기 중에는 위 메뉴(검색·거르기)를 숨긴다. */}
      {!expanded && (
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
            {pagination}
          </div>
          {/* 기간·상태·보드·매체 — 표를 누르면 고른 값만 적은 한 줄로 접힌다. */}
          <div ref={filtersRef} onKeyDown={onFiltersKey}>
            <AutoHeight className="lead_feed_filters">
              {filtersFolded ? (
                <div className="inner lead_feed_filter_row">
                  <button
                    type="button"
                    className="lead_feed_filter_summary"
                    aria-expanded={false}
                    aria-label={`거르기 펼치기 — ${filterSummary
                      .map(([name, value]) => `${name} ${value}`)
                      .join(', ')}`}
                    title="거르기 펼치기"
                    onClick={unfoldFilters}
                  >
                    {filterSummary.map(([name, value]) => (
                      <span key={name}>
                        <span className="stats_nav_label">{name}</span>
                        <b className={value === '전체' ? undefined : 'is-set'}>
                          {value}
                        </b>
                      </span>
                    ))}
                    <span className="lead_feed_filter_summary__more">
                      <ChevronDown strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="inner lead_feed_filter_row">
                    <span className="stats_nav_label">기간</span>
                    <div className="lead_feed_filter_scroll">
                      <Segmented
                        options={LEAD_FEED_PERIOD_LABEL}
                        value={period}
                        onChange={changePeriod}
                        label="기간"
                        size="md"
                      />
                    </div>
                    {/* 직접 설정 — 날짜 고르기(인입통계·CMIP와 같은 달력). 버튼을
                        누른 때는 달력을 펼친 채로 뜬다. 버튼 줄 밖에 두어 달력이
                        옆 스크롤 상자에 잘리지 않게. */}
                    {period === 'custom' && (
                      <DateRangePicker
                        dateStart={customRange[0]}
                        dateEnd={customRange[1]}
                        onChange={actions.changeCustomRange}
                        defaultOpen={customPickerOpen}
                      />
                    )}
                  </div>
                  {/* 상담 진행 상태 — 기간·검색 안의 건수(보드·매체를 골라도 그대로). */}
                  <div className="inner lead_feed_filter_row">
                    <span className="stats_nav_label">상태</span>
                    <div className="lead_feed_filter_scroll">
                      <Segmented
                        options={statusOptions}
                        value={
                          statusFilter === ALL_STATUSES
                            ? ALL_STATUSES
                            : statusKey(statusFilter)
                        }
                        onChange={(next) =>
                          actions.changeStatus(
                            next === ALL_STATUSES
                              ? ALL_STATUSES
                              : next.slice(STATUS_KEY_PREFIX.length),
                          )
                        }
                        disabledOptions={disabledStatuses}
                        label="상담 진행 상태"
                        size="md"
                      />
                    </div>
                  </div>
                  <div className="inner lead_feed_filter_row">
                    <span className="stats_nav_label">보드</span>
                    <div className="lead_feed_filter_scroll">
                      <Segmented
                        options={boardOptions}
                        value={
                          boardId === ALL_BOARDS
                            ? ALL_BOARDS
                            : boardKey(boardId)
                        }
                        onChange={(next) =>
                          actions.changeBoard(
                            next === ALL_BOARDS
                              ? ALL_BOARDS
                              : next.slice('board:'.length),
                          )
                        }
                        optionTitles={boardTitles}
                        disabledOptions={disabledBoards}
                        label="보드"
                        size="md"
                      />
                    </div>
                  </div>
                  {/* 매체 — utm_source를 광고 채널로 묶은 값(cmip ROAS 탭과 같은 규칙). */}
                  <div className="inner lead_feed_filter_row">
                    <span className="stats_nav_label">매체</span>
                    <div className="lead_feed_filter_scroll">
                      <Segmented
                        options={channelOptions}
                        value={channelFilter}
                        onChange={actions.changeChannel}
                        optionTitles={LEAD_CHANNEL_TITLE}
                        disabledOptions={disabledChannels}
                        label="매체"
                        size="md"
                      />
                    </div>
                  </div>
                  {/* 소재 — 소재별로 볼 때만. 하나를 고르면 그 소재의 리드를 쪽으로
                    나눠 한 건씩 본다. */}
                  {groupBy === 'creative' && (
                    <div className="inner lead_feed_filter_row">
                      <span className="stats_nav_label">소재</span>
                      <div className="lead_feed_filter_scroll">
                        <Segmented
                          options={creativeOptions}
                          value={creativeFilter}
                          onChange={actions.changeCreative}
                          optionTitles={creativeTitles}
                          label="소재"
                          size="md"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </AutoHeight>
          </div>
        </div>
      )}

      <div
        ref={mainRef}
        className={[
          'xtool-main monday_stats lead_feed_main glass_theme',
          settled ? 'is-settled' : '',
        ].join(' ')}
      >
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>리드 목록을 불러오지 못했습니다.</p>
              <button type="button" onClick={() => void actions.reload()}>
                다시 시도
              </button>
            </div>
          ) : (
            // 표 카드 어디를 눌러도 거르기를 접는다.
            <section
              className={expanded ? 'stats_card' : 'stats_card lead_feed_card'}
              onClick={() => {
                if (!filtersFolded) foldFilters()
              }}
            >
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
                      {countsLabel}
                    </h2>
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
                    <div className="lead_feed_table_bar">
                      {!expanded && expandButton}
                      {syncedLabel}
                    </div>
                    {!expanded && tableBlock}
                  </div>
                )}
              </AutoHeight>
            </section>
          )}
        </div>
      </div>

      {/* 전체보기 — 머리(닫기·건수·쪽 넘기기)와 표만. 헤더(z-index 6) 위, 고객
          상세 같은 모달(10~) 아래(lead-feed.scss). 모달이 아니라(aria-modal 없음)
          그 위에 뜨는 고객 상세의 방향키를 막지 않는다. */}
      {expandHost &&
        createPortal(
          <div
            className="xtool-main monday_stats lead_feed_main glass_theme lead_feed_expanded"
            role="region"
            aria-label="신규 인입 리드 전체보기"
          >
            <section className="stats_card lead_feed_card">
              <div className="lead_feed_table_bar">
                {expandButton}
                <h2>
                  신규 인입 리드
                  {countsLabel}
                </h2>
                {syncedLabel}
                {pagination}
              </div>
              {tableBlock}
            </section>
          </div>,
          expandHost,
        )}

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
