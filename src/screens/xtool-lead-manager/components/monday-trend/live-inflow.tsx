import { CircleAlert, Clock, Globe } from 'lucide-react'
import type { useLiveInflowViewModel } from '@/screens/xtool-lead-manager/view-model'
import { AutoHeight, LoadingPanel, StatTile } from '@/components/glass'

// 세 타일의 ↗ — 웹 문의 원본(/log 문의 접수). 실패한 Monday 등록도 거기서 다시 보낸다.
const LOG_INQUIRY = '/log?tab=inquiry'

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

      {/* 불러오는 동안 로딩 판 → 다 받으면 카드가 그 높이에서 자라고 타일이
          흐릿하게 떠오른다. */}
      <AutoHeight>
        {status === 'error' && !summary && (
          <p className="stats_desc">실시간 웹 문의를 불러오지 못했습니다.</p>
        )}
        {!summary && status !== 'error' && (
          <LoadingPanel label="실시간 웹 문의를 불러오는 중" minHeight={380} />
        )}

        {summary && (
          <div className="glass_reveal">
            <div className="live_inflow_tiles">
              <StatTile
                icon={Globe}
                label="오늘 웹 문의"
                value={`${summary.today.toLocaleString('ko-KR')}건`}
                sub={
                  <>
                    {summary.latestAt !== null
                      ? `마지막 ${time(summary.latestAt)}`
                      : '아직 없음'}
                    {summary.tests > 0 && ` · 테스트 ${summary.tests}건 제외`}
                  </>
                }
                to={LOG_INQUIRY}
                linkLabel="문의 접수 기록 보기"
              />
              <StatTile
                icon={Clock}
                label="통계 반영 전"
                value={
                  summary.sinceSync === null
                    ? '-'
                    : `${summary.sinceSync.toLocaleString('ko-KR')}건`
                }
                sub="Monday 동기화 이후 들어온 문의"
                to={LOG_INQUIRY}
                linkLabel="문의 접수 기록 보기"
              />
              <StatTile
                icon={CircleAlert}
                label="확인 필요"
                value={`${summary.problems.toLocaleString('ko-KR')}건`}
                warn={summary.problems > 0}
                sub="등록 실패·대기 중인 문의"
                to={LOG_INQUIRY}
                linkLabel="문의 접수 기록에서 확인하기"
              />
            </div>

            {summary.byBoard.length > 0 && (
              <div className="live_inflow_boards">
                <h3>기기별</h3>
                <ul aria-label="기기별 오늘 웹 문의">
                  {summary.byBoard.map(({ board, total, share, ratio }) => (
                    <li
                      key={board}
                      className={ratio === 1 ? 'is-top' : undefined}
                      title={`${total}건 / 오늘 ${summary.today}건`}
                    >
                      <span className="live_board_name">{board}</span>
                      <span className="live_board_track" aria-hidden="true">
                        <span
                          className="live_board_fill"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </span>
                      <span className="live_board_value">
                        {total.toLocaleString('ko-KR')}
                        <small> · {Math.round(share * 100)}%</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </AutoHeight>
    </section>
  )
}
