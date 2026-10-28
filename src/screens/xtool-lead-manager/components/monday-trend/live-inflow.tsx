import { Link } from 'react-router-dom'
import type { useLiveInflowViewModel } from '@/screens/xtool-lead-manager/view-model'

type LiveInflow = ReturnType<typeof useLiveInflowViewModel>['state']

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })

/** 인입통계 맨 위 — 오늘 들어온 웹 문의를 실시간으로. Monday 동기화 전이라
 * 아래 통계에 아직 없는 건수도 같이 보여준다. 합계에는 섞지 않는다. */
export const LiveInflow = ({ live }: { live: LiveInflow }) => {
  const { status, summary, fetchedAt } = live

  return (
    <section className="stats_card live_inflow" aria-live="polite">
      <div className="live_inflow_head">
        <h2>
          <span className="live_dot" aria-hidden="true" />
          오늘 웹 문의 · 실시간
        </h2>
        <span className="live_inflow_meta">
          웹사이트 상담 신청 기준
          {fetchedAt !== null && (
            <span>{time(fetchedAt)} 기준 · 1분마다 갱신</span>
          )}
        </span>
      </div>

      {status === 'error' && !summary && (
        <p className="stats_desc">실시간 웹 문의를 불러오지 못했습니다.</p>
      )}
      {!summary && status !== 'error' && (
        <div className="live_inflow_tiles is-loading" aria-label="불러오는 중">
          <span />
          <span />
          <span />
        </div>
      )}

      {summary && (
        <>
          <div className="live_inflow_tiles">
            <div className="stats_tile">
              <span className="stats_tile_label">오늘 웹 문의</span>
              <strong className="stats_tile_value">
                {summary.today.toLocaleString('ko-KR')}건
              </strong>
              <span className="live_inflow_sub">
                {summary.latestAt !== null
                  ? `마지막 ${time(summary.latestAt)}`
                  : '아직 없음'}
                {summary.tests > 0 && ` · 테스트 ${summary.tests}건 제외`}
              </span>
            </div>
            <div className="stats_tile">
              <span className="stats_tile_label">아래 통계에 반영 전</span>
              <strong className="stats_tile_value">
                {summary.sinceSync === null
                  ? '-'
                  : `${summary.sinceSync.toLocaleString('ko-KR')}건`}
              </strong>
              <span className="live_inflow_sub">
                Monday 동기화 이후 들어온 문의
              </span>
            </div>
            <div className="stats_tile">
              <span className="stats_tile_label">Monday 등록 확인 필요</span>
              <strong
                className={`stats_tile_value${summary.problems > 0 ? ' is-warn' : ''}`}
              >
                {summary.problems.toLocaleString('ko-KR')}건
              </strong>
              <Link className="live_inflow_link" to="/log?tab=inquiry">
                문의 접수 기록 보기 →
              </Link>
            </div>
          </div>

          {summary.byBoard.length > 0 && (
            <ul className="live_inflow_boards" aria-label="기기별 오늘 웹 문의">
              {summary.byBoard.map(({ board, total }) => (
                <li key={board}>
                  {board}
                  <strong>{total}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
