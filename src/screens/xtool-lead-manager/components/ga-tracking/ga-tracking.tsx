import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/ga-tracking.scss'
import { Fragment } from 'react'
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

/** "20261021" → "2026-10-21" */
const formatYmd = (ymd: string) =>
  `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`

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
    range,
    bytesProcessed,
    ga4Error,
  } = state

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
            onClick={() => void actions.reload()}
          >
            다시 조회
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
                펼쳐집니다.
                {range &&
                  ` 조회 범위 ${formatYmd(range.fromDate)} ~ ${formatYmd(range.toDate)}`}
                {bytesProcessed > 0 &&
                  ` · 읽은 데이터 ${(bytesProcessed / 1024 ** 2).toFixed(1)}MB`}
              </p>
              {ga4Error && (
                <p className="ga_tracking_error">
                  GA4 이벤트를 불러오지 못했습니다 — {ga4Error}
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
                        const open = openItemId === consultation.itemId
                        return (
                          <Fragment key={consultation.itemId}>
                            <tr
                              className={`ga_tracking_row${open ? ' open' : ''}`}
                              onClick={() =>
                                actions.toggleRow(consultation.itemId)
                              }
                              aria-expanded={open}
                            >
                              <td>
                                <span
                                  className="ga_tracking_caret"
                                  aria-hidden="true"
                                >
                                  {open ? '▾' : '▸'}
                                </span>
                                {consultation.receivedAt ?? '-'}
                              </td>
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
                            {open && (
                              <tr className="ga_tracking_detail">
                                <td colSpan={12}>
                                  <Timeline row={row} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
        {status === 'loading' && <Loading />}
      </div>
    </>
  )
}
