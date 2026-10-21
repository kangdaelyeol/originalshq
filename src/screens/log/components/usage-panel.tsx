import { Fragment } from 'react'
import { formatAgo, formatDateTime, formatDay } from '../utils/batch-run'
import {
  APP_LABEL,
  formatSpan,
  shortVisitor,
  viewLabel,
  type UsageApp,
} from '../utils/usage'
import {
  USAGE_PERIOD_OPTIONS,
  useUsageViewModel,
  type UsageAppFilter,
} from '../view-model/use-usage-view-model'

const APP_OPTIONS: readonly { id: UsageAppFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'xtool', label: 'xtool' },
  { id: 'cmip', label: 'cmip' },
]

const appTag = (app: UsageApp) => (
  <span className="batch-log__codebase">{app}</span>
)

/**
 * /log의 "사용 분석" 탭 — xtool-lead-manager·cmip를 어느 탭에서 얼마나
 * 봤는지. 사람은 이름이 아니라 브라우저별 무작위 방문자 id로만 구분하고,
 * 시간은 브라우저 탭을 실제로 보고 있던 시간만 센다(다른 탭으로 옮겨 둔 시간
 * 제외). 기록은 화면이 functions-xtool의 logUsage로 보낸다(src/hooks/
 * use-usage-tracking.ts).
 */
export function UsagePanel() {
  const { state, actions } = useUsageViewModel()
  const {
    days,
    app,
    status,
    error,
    fetchedAt,
    summary,
    byView,
    byDate,
    flows,
    entries,
    sessions,
    sessionCount,
    openSessionId,
    now,
  } = state
  const showApp = app === 'all'

  return (
    <>
      <header className="batch-log__header">
        <div>
          <h2 className="batch-log__title">사용 분석</h2>
          <p className="batch-log__muted">
            xtool-lead-manager·cmip를 어느 탭에서 얼마나 봤는지 — 방문자는
            브라우저 단위, 시간은 실제로 화면을 보고 있던 시간입니다. 기록은
            90일 보관.
          </p>
        </div>
        <div className="batch-log__controls">
          <div className="batch-log__segmented" role="tablist" aria-label="앱">
            {APP_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === app}
                className={option.id === app ? 'is-active' : ''}
                onClick={() => actions.changeApp(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div
            className="batch-log__segmented"
            role="tablist"
            aria-label="기간"
          >
            {USAGE_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                role="tab"
                aria-selected={option.days === days}
                className={option.days === days ? 'is-active' : ''}
                onClick={() => actions.changeDays(option.days)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="batch-log__refresh"
            onClick={() => void actions.reload()}
          >
            새로고침
          </button>
        </div>
      </header>

      {status === 'error' && (
        <p className="batch-log__card batch-log__error">
          사용 기록을 불러오지 못했습니다: {error}
        </p>
      )}

      <section className="batch-log__totals" aria-label="기간 요약">
        <div>
          <span>방문자</span>
          <strong>{summary.visitors.toLocaleString('ko-KR')}명</strong>
        </div>
        <div>
          <span>세션</span>
          <strong>{summary.sessions.toLocaleString('ko-KR')}회</strong>
        </div>
        <div>
          <span>총 사용 시간</span>
          <strong className="is-small">{formatSpan(summary.visibleMs)}</strong>
        </div>
        <div>
          <span>세션당 평균</span>
          <strong className="is-small">
            {formatSpan(summary.averageSessionMs)}
          </strong>
        </div>
        <div>
          <span>방문자당 세션</span>
          <strong>
            {summary.visitors
              ? (summary.sessions / summary.visitors).toFixed(1)
              : '-'}
            회
          </strong>
        </div>
        <div>
          <span>마지막 조회</span>
          <strong className="is-small">
            {fetchedAt
              ? `${formatDateTime(fetchedAt).slice(-8)} (${formatAgo(fetchedAt, now)})`
              : status === 'loading'
                ? '불러오는 중…'
                : '-'}
          </strong>
        </div>
      </section>

      {summary.sessions === 0 ? (
        <section className="batch-log__card">
          <p className="batch-log__empty">
            {status === 'loading'
              ? '불러오는 중…'
              : '이 기간에 기록이 없습니다. 화면에 수집 코드가 배포된 뒤 접속부터 쌓입니다.'}
          </p>
        </section>
      ) : (
        <>
          <section className="batch-log__card">
            <h2>탭별 사용량</h2>
            <p className="batch-log__muted batch-log__card-desc">
              총 시간이 많은 순. 평균은 탭에 한 번 들어와 머문 시간입니다.
            </p>
            <div className="batch-log__table-scroll">
              <table className="batch-log__table">
                <thead>
                  <tr>
                    {showApp && <th>앱</th>}
                    <th>탭</th>
                    <th className="is-num">방문</th>
                    <th className="is-num">방문자</th>
                    <th className="is-num">총 시간</th>
                    <th className="is-num">평균</th>
                    <th className="is-num">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {byView.map((row) => (
                    <tr key={`${row.app}|${row.view}`}>
                      {showApp && <td>{appTag(row.app)}</td>}
                      <td>{viewLabel(row.app, row.view)}</td>
                      <td className="is-num">
                        {row.visits.toLocaleString('ko-KR')}회
                      </td>
                      <td className="is-num">
                        {row.visitors.toLocaleString('ko-KR')}명
                      </td>
                      <td className="is-num">{formatSpan(row.visibleMs)}</td>
                      <td className="is-num">{formatSpan(row.averageMs)}</td>
                      <td className="is-num">
                        {(row.share * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="batch-log__columns">
            <section className="batch-log__card">
              <h2>날짜별</h2>
              <div className="batch-log__table-scroll">
                <table className="batch-log__table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th className="is-num">방문자</th>
                      <th className="is-num">세션</th>
                      <th className="is-num">사용 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDate.map((row) => (
                      <tr key={row.date}>
                        <td>{formatDay(row.date)}</td>
                        <td className="is-num">{row.visitors}명</td>
                        <td className="is-num">{row.sessions}회</td>
                        <td className="is-num">{formatSpan(row.visibleMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="batch-log__card">
              <h2>탭 이동 흐름</h2>
              <p className="batch-log__muted batch-log__card-desc">
                한 세션 안에서 이 탭 다음에 저 탭으로 간 횟수(상위 15).
              </p>
              {flows.length === 0 ? (
                <p className="batch-log__empty">탭을 옮긴 기록이 없습니다.</p>
              ) : (
                <div className="batch-log__table-scroll">
                  <table className="batch-log__table">
                    <thead>
                      <tr>
                        {showApp && <th>앱</th>}
                        <th>이전 탭</th>
                        <th>다음 탭</th>
                        <th className="is-num">횟수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flows.map((flow) => (
                        <tr key={`${flow.app}|${flow.from}|${flow.to}`}>
                          {showApp && <td>{appTag(flow.app)}</td>}
                          <td>{viewLabel(flow.app, flow.from)}</td>
                          <td>→ {viewLabel(flow.app, flow.to)}</td>
                          <td className="is-num">{flow.count}회</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h3>들어와서 처음 본 탭</h3>
              <p className="batch-log__flows">
                {entries.map((entry) => (
                  <span key={`${entry.app}|${entry.view}`}>
                    {showApp && `${entry.app} · `}
                    {viewLabel(entry.app, entry.view)} {entry.count}회
                  </span>
                ))}
              </p>
            </section>
          </div>

          <section className="batch-log__card">
            <h2>
              최근 세션{' '}
              <span className="batch-log__muted">
                {sessionCount.toLocaleString('ko-KR')}회
              </span>
            </h2>
            <div className="batch-log__table-scroll">
              <table className="batch-log__table">
                <thead>
                  <tr>
                    <th>시작</th>
                    <th>앱</th>
                    <th>방문자</th>
                    <th className="is-num">사용 시간</th>
                    <th>본 탭</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const open = openSessionId === session.sessionId
                    return (
                      <Fragment key={session.sessionId}>
                        <tr
                          className={`batch-log__row${open ? ' is-open' : ''}`}
                          onClick={() =>
                            actions.toggleSession(session.sessionId)
                          }
                          aria-expanded={open}
                        >
                          <td className="batch-log__mono">
                            <span
                              className="batch-log__caret"
                              aria-hidden="true"
                            >
                              {open ? '▾' : '▸'}
                            </span>
                            {formatDateTime(session.startedAt)}
                          </td>
                          <td>{APP_LABEL[session.app]}</td>
                          <td className="batch-log__mono">
                            {shortVisitor(session.visitorId)}
                          </td>
                          <td className="is-num">
                            {formatSpan(session.visibleMs)}
                          </td>
                          <td className="batch-log__result">
                            {session.segments
                              .map((s) => viewLabel(s.app, s.view))
                              .join(' → ')}
                          </td>
                        </tr>
                        {open && (
                          <tr className="batch-log__detail-row">
                            <td colSpan={5}>
                              <div className="batch-log__detail">
                                <table className="batch-log__table">
                                  <thead>
                                    <tr>
                                      <th>들어온 시각</th>
                                      <th>탭</th>
                                      <th className="is-num">본 시간</th>
                                      <th>상태</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {session.segments.map((segment) => (
                                      <tr key={segment.id}>
                                        <td className="batch-log__mono">
                                          {formatDateTime(segment.startedAt)}
                                        </td>
                                        <td>
                                          {viewLabel(segment.app, segment.view)}
                                        </td>
                                        <td className="is-num">
                                          {formatSpan(segment.visibleMs)}
                                        </td>
                                        <td className="batch-log__muted">
                                          {segment.closed
                                            ? '나감'
                                            : `보는 중이거나 닫기 신호 없음 (마지막 갱신 ${formatAgo(segment.updatedAt, now)})`}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="batch-log__muted batch-log__card-desc">
                                  방문자 {session.visitorId} · 세션{' '}
                                  {session.sessionId}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {sessions.length < sessionCount && (
                <button
                  type="button"
                  className="batch-log__more"
                  onClick={actions.showMoreSessions}
                >
                  더 보기 ({sessions.length} / {sessionCount})
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </>
  )
}
