import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/ga-tracking.scss'
import { useEffect, useRef } from 'react'
import { Loading } from '@/screens/xtool-lead-manager/components'
import {
  eventSource,
  shortPath,
  type GaTrackingRow,
} from '@/screens/xtool-lead-manager/utils'
import type {
  GaTrackingFilter,
  useGaTrackingViewModel,
} from '@/screens/xtool-lead-manager/view-model'

type GaTrackingProps = ReturnType<typeof useGaTrackingViewModel>

const FILTERS: { id: GaTrackingFilter; label: string }[] = [
  { id: 'misentry', label: '오기입만' },
  { id: 'all', label: 'GA ClientId 있는 상담 전체' },
]

/** ms → "10/21 14:03:21"(KST). */
const formatTime = (ms: number | null): string => {
  if (ms === null) return '-'
  const iso = new Date(ms + 9 * 3_600_000).toISOString()
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} ${iso.slice(11, 19)}`
}

/** GA ClientId를 짧게 — 앞 4자리…뒤 4자리. */
const shortClientId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id

/** 한 사람의 GA4 이벤트 — 시간순. 세션(GA4가 나눈 방문)이 바뀌는 곳에 번호를
 * 붙여, 몇 번째 방문에서 무엇을 했는지 보이게 한다. */
const Timeline = ({ row }: { row: GaTrackingRow }) => {
  if (row.events.length === 0) {
    return (
      <p className="ga_tracking_empty">
        이 GA ClientId로 찾은 GA4 이벤트가 없습니다. 아직 BigQuery로 넘어오지
        않았거나(일별 내보내기는 다음 날 반영), 다른 브라우저에서 문의했을 수
        있습니다.
      </p>
    )
  }
  const sessionNumber = new Map<number, number>()
  for (const event of row.events) {
    if (event.sessionId !== null && !sessionNumber.has(event.sessionId)) {
      sessionNumber.set(event.sessionId, sessionNumber.size + 1)
    }
  }
  return (
    <table className="stats_table ga_tracking_timeline">
      <thead>
        <tr>
          <th>시각</th>
          <th>방문</th>
          <th>이벤트</th>
          <th>페이지</th>
          <th>유입</th>
        </tr>
      </thead>
      <tbody>
        {row.events.map((event, index) => {
          const session =
            event.sessionId === null ? null : sessionNumber.get(event.sessionId)
          const newSession =
            index > 0 && event.sessionId !== row.events[index - 1].sessionId
          return (
            <tr
              key={`${event.at}-${index}`}
              className={newSession ? 'ga_tracking_session_start' : undefined}
            >
              <td>{formatTime(event.at)}</td>
              <td>{session ? `${session}번째` : '-'}</td>
              <td>
                <span className="ga_tracking_event">{event.name}</span>
              </td>
              <td title={event.pageLocation ?? undefined}>
                {event.pageTitle ?? shortPath(event.pageLocation) ?? '-'}
              </td>
              <td>{eventSource(event) ?? '-'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** 한 사람의 추적 상세(모달) — 위에 상담 정보와 요약, 아래에 GA4 이벤트
 * 타임라인. Esc·바깥 클릭·닫기 버튼으로 닫는다. */
const TrackingModal = ({
  row,
  onClose,
}: {
  row: GaTrackingRow
  onClose: () => void
}) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { consultation } = row

  useEffect(() => {
    // 모달이 떠 있는 동안 뒤 화면은 스크롤되지 않게 하고, 포커스를 모달로.
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const facts: [string, string][] = [
    ['접수일', consultation.receivedAt ?? '-'],
    ['보드', consultation.boardName],
    ['입력한 번호', consultation.phoneRaw ?? '-'],
    ['상태', consultation.status ?? '-'],
    ['GA ClientId', consultation.gaClientId],
    ['이벤트', `${row.events.length}건`],
    ['방문', `${row.sessionCount}회`],
    ['첫 유입', row.firstTouch ?? '-'],
    ['기기', row.device ?? '-'],
    ['위치', row.location ?? '-'],
    ['첫 활동', formatTime(row.firstAt)],
    ['마지막 활동', formatTime(row.lastAt)],
  ]

  return (
    <div className="ga_tracking_modal" onClick={onClose}>
      <div
        className="ga_tracking_dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ga-tracking-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ga_tracking_dialog_head">
          <h2 id="ga-tracking-title">
            {consultation.url ? (
              <a href={consultation.url} target="_blank" rel="noreferrer">
                {consultation.name}
              </a>
            ) : (
              consultation.name
            )}
            {consultation.misentry && (
              <span className="ga_tracking_badge">오기입</span>
            )}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="ga_tracking_close"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <dl className="ga_tracking_facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="ga_tracking_dialog_body">
          <Timeline row={row} />
        </div>
      </div>
    </div>
  )
}

/**
 * 오기입 추적 탭 — 상담 보드에 GA ClientId가 적힌 문의를, 같은 id의 GA4
 * 이벤트(BigQuery)와 맞춰 본다. 오기입 문의가 실제 사람이 번호를 잘못 적은
 * 것인지, 스팸·봇인지 판단하는 데 쓴다(유입 경로, 기기, 방문 횟수, 폼 제출 전
 * 행동).
 */
export const GaTracking = ({ state, actions }: GaTrackingProps) => {
  const {
    status,
    filter,
    rows,
    totalCount,
    misentryCount,
    matchedCount,
    openItemId,
    collectedAt,
    lastResult,
    collectError,
    collecting,
  } = state
  const openRow =
    rows.find((row) => row.consultation.itemId === openItemId) ?? null

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav">
        <div className="inner">
          <div className="stats_scope" role="tablist" aria-label="보기">
            {FILTERS.map((each) => (
              <button
                key={each.id}
                type="button"
                role="tab"
                aria-selected={each.id === filter}
                className={each.id === filter ? 'active' : ''}
                onClick={() => actions.changeFilter(each.id)}
              >
                {each.label}
              </button>
            ))}
          </div>
          <span className="stats_nav_note">
            GA ClientId 있는 상담 {totalCount}건 · 오기입 {misentryCount}건 · 이
            목록 중 GA4에서 찾은 건 {matchedCount}건
          </span>
          <button
            type="button"
            className="stats_reset"
            disabled={collecting}
            onClick={() => void actions.collectNow()}
          >
            {collecting ? '수집 중…' : '지금 수집'}
          </button>
        </div>
      </div>

      <div className="xtool-main monday_stats ga_tracking">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>오기입 추적 데이터를 불러오지 못했습니다.</p>
              <button type="button" onClick={() => void actions.reload()}>
                다시 시도
              </button>
            </div>
          ) : (
            <section className="stats_card">
              <h2>GA4 이벤트로 본 문의자</h2>
              <p className="stats_desc">
                상담 보드의 GA ClientId와 GA4 BigQuery의 사용자 id가 같은
                이벤트를 모았습니다. 줄을 누르면 그 사람의 이벤트가 시간순으로
                모달에 뜹니다. 이벤트는 Monday 동기화(매일 09·11·13·15·17·22시)
                직후 자동으로 수집되고, GA4 내보내기가 일별이라 당일 이벤트는
                다음 날 들어옵니다.
                {collectedAt
                  ? ` 마지막 수집 ${formatTime(collectedAt)}`
                  : ' 아직 수집한 적이 없습니다 — "지금 수집"을 눌러 주세요.'}
                {lastResult &&
                  ` · 이번 수집에서 새 id ${lastResult.newClientIds}개, 갱신 ${lastResult.writtenDocs}명, 읽은 데이터 ${(lastResult.bytesProcessed / 1024 ** 2).toFixed(1)}MB`}
              </p>
              {collectError && (
                <p className="ga_tracking_error">
                  GA4 이벤트 수집에 실패했습니다 — {collectError}
                </p>
              )}
              {rows.length === 0 ? (
                <p className="ga_tracking_empty">
                  {status === 'ready'
                    ? '해당하는 상담이 없습니다.'
                    : '불러오는 중…'}
                </p>
              ) : (
                <div className="ga_tracking_scroll">
                  <table className="stats_table ga_tracking_table">
                    <thead>
                      <tr>
                        <th>접수일</th>
                        <th>보드</th>
                        <th>이름</th>
                        <th>입력한 번호</th>
                        <th>상태</th>
                        <th>GA ClientId</th>
                        <th>이벤트</th>
                        <th>방문</th>
                        <th>첫 유입</th>
                        <th>기기</th>
                        <th>위치</th>
                        <th>마지막 활동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const { consultation } = row
                        return (
                          <tr
                            key={consultation.itemId}
                            className="ga_tracking_row"
                            onClick={() => actions.openRow(consultation.itemId)}
                          >
                            <td>{consultation.receivedAt ?? '-'}</td>
                            <td>{consultation.boardName}</td>
                            <td>
                              {consultation.url ? (
                                <a
                                  href={consultation.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {consultation.name}
                                </a>
                              ) : (
                                consultation.name
                              )}
                            </td>
                            <td>{consultation.phoneRaw ?? '-'}</td>
                            <td
                              className={
                                consultation.misentry
                                  ? 'ga_tracking_misentry'
                                  : undefined
                              }
                            >
                              {consultation.status ?? '-'}
                            </td>
                            <td title={consultation.gaClientId}>
                              {shortClientId(consultation.gaClientId)}
                            </td>
                            <td>{row.events.length}</td>
                            <td>{row.sessionCount}</td>
                            <td>{row.firstTouch ?? '-'}</td>
                            <td>{row.device ?? '-'}</td>
                            <td>{row.location ?? '-'}</td>
                            <td>{formatTime(row.lastAt)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
        {openRow && <TrackingModal row={openRow} onClose={actions.closeRow} />}
        {status === 'loading' && <Loading />}
      </div>
    </>
  )
}
