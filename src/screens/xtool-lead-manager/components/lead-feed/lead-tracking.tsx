import { useRef, type Ref } from 'react'
import type { MondayLeadFeedRow } from '@/screens/xtool-lead-manager/entity'
import type { LoadStatus } from '@/screens/xtool-lead-manager/hooks/use-load-when-active'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import {
  eventSource,
  shortPath,
  type GaTrackingRow,
} from '@/screens/xtool-lead-manager/utils'
import { formatKoreaTime } from '@/screens/xtool-lead-manager/utils/calc'

/** ms → "11/5 14:03:21"(KST) — 못 읽으면 '-'. */
const formatTime = (ms: number | null): string => formatKoreaTime(ms, true)

/** GA ClientId를 짧게 — 앞 4자리…뒤 4자리. */
const shortClientId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id

/** 패널 본문 — 받는 중·실패·추적할 수 없음·이벤트. 오기입 추적 탭의 모달과
 * 같은 재료(GaTrackingRow)를 좁은 칸에 맞게 줄여 보인다. */
const TrackingBody = ({
  row,
  status,
}: {
  row: GaTrackingRow | null
  status: LoadStatus
}) => {
  if (status === 'idle' || status === 'loading') {
    return <p className="detail_monday_message">GA4 이벤트를 불러오는 중…</p>
  }
  if (status === 'error' && !row) {
    return (
      <p className="detail_monday_message">
        오기입 추적 데이터를 불러오지 못했습니다.
      </p>
    )
  }
  if (!row) {
    return (
      <p className="detail_monday_message">
        이 문의에는 GA ClientId가 없어 추적할 수 없습니다. 웹 문의 폼으로 들어와
        GA ClientId가 적힌 상담만 GA4 이벤트와 맞춰 볼 수 있습니다.
      </p>
    )
  }

  const facts: [string, string][] = [
    ['입력한 번호', row.consultation.phoneRaw ?? '-'],
    ['GA ClientId', shortClientId(row.consultation.gaClientId)],
    ['이벤트 · 방문', `${row.events.length}건 · ${row.sessionCount}회`],
    ['첫 유입', row.firstTouch ?? '-'],
    ['기기', row.device ?? '-'],
    ['위치', row.location ?? '-'],
    ['첫 활동', formatTime(row.firstAt)],
    ['마지막 활동', formatTime(row.lastAt)],
  ]
  // 세션(GA4가 나눈 방문)마다 번호 — 몇 번째 방문에서 무엇을 했는지.
  const sessionNumber = new Map<number, number>()
  for (const event of row.events) {
    if (event.sessionId !== null && !sessionNumber.has(event.sessionId)) {
      sessionNumber.set(event.sessionId, sessionNumber.size + 1)
    }
  }

  return (
    <>
      <dl className="lead_feed_tracking_facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd
              title={
                label === 'GA ClientId'
                  ? row.consultation.gaClientId
                  : undefined
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {row.events.length === 0 ? (
        <p className="detail_monday_message">
          이 GA ClientId로 찾은 GA4 이벤트가 없습니다. 아직 BigQuery로 넘어오지
          않았거나(일별 내보내기는 다음 날 반영), 다른 브라우저에서 문의했을 수
          있습니다.
        </p>
      ) : (
        <ol className="lead_feed_tracking_events">
          {row.events.map((event, index) => {
            const session =
              event.sessionId === null
                ? null
                : sessionNumber.get(event.sessionId)
            const newSession =
              index === 0 || event.sessionId !== row.events[index - 1].sessionId
            const source = eventSource(event)
            return (
              <li key={`${event.at}-${index}`}>
                {newSession && session && (
                  <span className="lead_feed_tracking_session">
                    {session}번째 방문
                  </span>
                )}
                <div className="lead_feed_tracking_event">
                  <time>{formatTime(event.at)}</time>
                  <span className="lead_feed_tracking_name">{event.name}</span>
                </div>
                <small title={event.pageLocation ?? undefined}>
                  {event.pageTitle ?? shortPath(event.pageLocation) ?? '-'}
                  {source && ` · ${source}`}
                </small>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}

/** 패널 한 장 — 머리(제목, 그 리드를 Monday에서 열기, 닫기)와 본문. */
const TrackingPanel = ({
  lead,
  row,
  status,
  title,
  alone = false,
  onClose,
  closeRef,
}: {
  lead: MondayLeadFeedRow
  row: GaTrackingRow | null
  status: LoadStatus
  title: string
  /** 고객 상세 없이 혼자 뜬 창이면 — 조금 넓게, 대화상자로. */
  alone?: boolean
  onClose?: () => void
  closeRef?: Ref<HTMLButtonElement>
}) => (
  <aside
    className={[
      'detail_monday_panel',
      'lead_feed_tracking',
      alone ? 'is-alone' : '',
    ]
      .join(' ')
      .trim()}
    {...(alone
      ? { role: 'dialog', 'aria-modal': true, 'aria-label': title }
      : {})}
  >
    <div className="detail_monday_head">
      <span className="title">{title}</span>
      <div className="lead_feed_tracking_actions">
        {lead.url && (
          <a
            className="detail_monday_open"
            href={lead.url}
            target="_blank"
            rel="noreferrer"
          >
            Monday에서 열기
          </a>
        )}
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            className="detail_monday_open"
            onClick={onClose}
          >
            닫기
          </button>
        )}
      </div>
    </div>
    <div className="detail_monday_scroll">
      <TrackingBody row={row} status={status} />
    </div>
  </aside>
)

/** 오기입 리드의 추적 — 고객 상세 오른쪽에 붙는 패널. */
export const LeadTrackingPanel = ({
  lead,
  row,
  status,
}: {
  lead: MondayLeadFeedRow
  row: GaTrackingRow | null
  status: LoadStatus
}) => (
  <TrackingPanel lead={lead} row={row} status={status} title="오기입 추적" />
)

/** 번호를 못 읽어 고객 상세가 없는 오기입 리드 — 추적 패널만 창으로 띄운다.
 * Esc·바깥 클릭·닫기로 닫는다. */
export const LeadTrackingModal = ({
  lead,
  row,
  status,
  onClose,
}: {
  lead: MondayLeadFeedRow
  row: GaTrackingRow | null
  status: LoadStatus
  onClose: () => void
}) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  useModal(onClose, closeRef)
  return (
    <div className="lead_manager_detail_modal" onClick={onClose}>
      <div
        className="detail_layout"
        onClick={(event) => event.stopPropagation()}
      >
        <TrackingPanel
          lead={lead}
          row={row}
          status={status}
          title={`${lead.name || '(이름 없음)'} · 오기입 추적`}
          alone
          onClose={onClose}
          closeRef={closeRef}
        />
      </div>
    </div>
  )
}
