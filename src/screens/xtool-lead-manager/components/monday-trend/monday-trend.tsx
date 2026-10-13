import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/monday-trend.scss'
import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import { Loading } from '@/screens/xtool-lead-manager/components'
import { formatDay, shortBoardName } from '@/screens/xtool-lead-manager/utils'
// 기간 선택은 cmip의 것을 그대로 쓴다 — 프리셋(지난 7일 등)과 달력이 같은
// 방식으로 동작해야 두 화면을 오가며 쓰기 편하다.
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import { InflowChart } from './inflow-chart'

type MondayTrendProps = ReturnType<typeof useMondayTrendViewModel>

const count = (value: number): string => `${value.toLocaleString('ko-KR')}건`

/**
 * 통계 탭 — 날짜별 추이를 보는 곳. 지금은 인입 건수 하나다.
 *
 * 인입은 그날 상담 보드(기기별 B2B 보드, B2B 솔루션, 기타 온라인 문의, 기타
 * 오프라인)에 새로 접수된 기록의 수다. 방문체험·샘플테스트·결제는 이미
 * 인입된 고객의 다음 단계라 세지 않는다. 퍼널 통계와 달리 고객이 아니라 기록
 * 단위라서, 한 사람이 두 번 문의하면 2건으로 센다.
 */
export const MondayTrend = ({ state, actions }: MondayTrendProps) => {
  const { status, range, points, summary } = state
  const { changeRange, reload } = actions

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav monday_trend_nav">
        <div className="inner">
          <span className="stats_nav_label">기간</span>
          <DateRangePicker
            dateStart={range.start}
            dateEnd={range.end}
            onChange={changeRange}
          />
          <span className="stats_nav_note">
            {points.length}일 · 매일 07시·19시 갱신
          </span>
        </div>
      </div>

      <div className="xtool-main monday_stats monday_trend">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>인입 통계를 불러오지 못했습니다.</p>
              <button type="button" onClick={reload}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              <section className="stats_card">
                <h2>일자별 인입 건수</h2>
                <p className="stats_desc">
                  그날 상담 보드에 새로 접수된 기록 수(접수일 기준).
                  방문체험·샘플테스트·결제는 포함하지 않고, 같은 고객이 여러 번
                  문의하면 각각 셉니다.
                </p>

                <div className="stats_tiles trend_tiles">
                  <div className="stats_tile">
                    <span className="stats_tile_label">전체 인입</span>
                    <strong className="stats_tile_value">
                      {count(summary.total)}
                    </strong>
                    <span className="stats_tile_note">
                      {summary.boards
                        .slice(0, 3)
                        .map(
                          (board) =>
                            `${shortBoardName(board.name)} ${board.count}`,
                        )
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="stats_tile">
                    <span className="stats_tile_label">평균</span>
                    <strong className="stats_tile_value">
                      {(Math.round(summary.average * 10) / 10).toLocaleString(
                        'ko-KR',
                      )}
                      건
                    </strong>
                  </div>
                  <div className="stats_tile">
                    <span className="stats_tile_label">가장 많은 날</span>
                    <strong className="stats_tile_value">
                      {summary.peak ? count(summary.peak.total) : '-'}
                    </strong>
                    <span className="stats_tile_note">
                      {summary.peak ? formatDay(summary.peak.date) : ''}
                    </span>
                  </div>
                  <div className="stats_tile">
                    <span className="stats_tile_label">오기입</span>
                    <strong className="stats_tile_value">
                      {count(summary.misentry)}
                    </strong>
                    <span className="stats_tile_note">
                      전체 인입에 포함된 건수
                    </span>
                  </div>
                </div>

                <InflowChart points={points} />
              </section>

              <section className="stats_card">
                <h2>일자별 표</h2>
                <p className="stats_desc">
                  그래프와 같은 숫자를 보드별로 나눈 표입니다. 보드는 이 기간에
                  인입이 많은 순입니다.
                </p>
                <div className="trend_table_scroll">
                  <table className="stats_table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>전체 인입</th>
                        <th>오기입</th>
                        {summary.boards.map((board) => (
                          <th key={board.name}>{shortBoardName(board.name)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...points].reverse().map((point) => (
                        <tr key={point.date}>
                          <td>{formatDay(point.date)}</td>
                          <td>{point.total}</td>
                          <td>{point.misentry}</td>
                          {summary.boards.map((board) => (
                            <td key={board.name}>
                              {point.boards?.[board.name] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
        {status === 'loading' && <Loading />}
      </div>
    </>
  )
}
