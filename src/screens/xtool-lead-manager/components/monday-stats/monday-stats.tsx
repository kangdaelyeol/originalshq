import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import type {
  useMondayStatsViewModel,
  useMondayViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { Loading } from '@/screens/xtool-lead-manager/components'
import { formatWon, type RateRow } from '@/screens/xtool-lead-manager/utils'

type MondayStatsProps = ReturnType<typeof useMondayStatsViewModel> & {
  /** 고객 목록을 받아오는 중인지·실패했는지 — 목록은 Monday 고객 탭의
   * view-model이 갖고 있다. */
  status: ReturnType<typeof useMondayViewModel>['state']['status']
  onReload: () => void
}

const percent = (rate: number): string => `${(rate * 100).toFixed(1)}%`
const people = (count: number): string => `${count.toLocaleString('ko-KR')}명`
const days = (value: number | null): string =>
  value === null ? '-' : `${Math.round(value * 10) / 10}일`
const monthLabel = (month: string): string => month.replace('-', '.')

/** 가로 막대 하나 — 이름 / 막대 / 값. 막대 길이는 `share`(0~1). 값은 막대
 * 끝이 아니라 오른쪽 칸에 글자로 적어, 막대가 짧아도 잘리지 않는다. */
const Bar = ({
  label,
  share,
  value,
  note,
}: {
  label: string
  share: number
  value: string
  note: string
}) => (
  <div className="stats_bar" title={`${label}: ${value} (${note})`}>
    <span className="stats_bar_label">{label}</span>
    <span className="stats_bar_track">
      <span
        className="stats_bar_fill"
        style={{ width: `${Math.max(share, 0) * 100}%` }}
      />
    </span>
    <span className="stats_bar_value">
      {value}
      <small>{note}</small>
    </span>
  </div>
)

const Tile = ({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) => (
  <div className="stats_tile">
    <span className="stats_tile_label">{label}</span>
    <strong className="stats_tile_value">{value}</strong>
    {note && <span className="stats_tile_note">{note}</span>}
  </div>
)

/** 전환율 표 — 한 줄이 한 집단(콜백 단계, 유입 경로, 담당자). 전환율 칸에는
 * 숫자 옆에 같은 값의 얇은 막대를 깔아 줄끼리 비교하기 쉽게 한다. */
const RateTable = ({
  head,
  rows,
  extra,
}: {
  head: string
  rows: RateRow[]
  /** 첫 칸 다음에 끼워 넣을 칸(콜백 표의 "누적 도달"). */
  extra?: { title: string; cell: (row: RateRow, index: number) => string }
}) => {
  const maxRate = Math.max(...rows.map((row) => row.purchaseRate), 0.0001)
  const maxVisit = Math.max(...rows.map((row) => row.visitRate), 0.0001)

  return (
    <table className="stats_table">
      <thead>
        <tr>
          <th>{head}</th>
          {extra && <th>{extra.title}</th>}
          <th>고객</th>
          <th>방문체험 전환율</th>
          <th>구매 전환율</th>
          <th>구매</th>
          <th>구매 금액</th>
          <th>인입→구매 (중앙값)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {extra && <td>{extra.cell(row, index)}</td>}
            <td>{people(row.customers)}</td>
            <td>
              <span className="stats_rate">
                <span className="stats_rate_track">
                  <span
                    className="stats_rate_bar"
                    style={{ width: `${(row.visitRate / maxVisit) * 100}%` }}
                  />
                </span>
                <span className="stats_rate_text">
                  {percent(row.visitRate)}
                </span>
              </span>
            </td>
            <td>
              <span className="stats_rate">
                <span className="stats_rate_track">
                  <span
                    className="stats_rate_bar"
                    style={{ width: `${(row.purchaseRate / maxRate) * 100}%` }}
                  />
                </span>
                <span className="stats_rate_text">
                  {percent(row.purchaseRate)}
                </span>
              </span>
            </td>
            <td>{people(row.purchases)}</td>
            <td>{row.amount > 0 ? formatWon(row.amount) : '-'}</td>
            <td>{days(row.medianDays)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * 퍼널 통계 탭 — Monday 통합 고객을 "최초 인입 월" 기준으로 묶어 본다.
 *
 * 단위는 전부 고객(전화번호 하나)이고, 오기입 고객은 모수에서 뺀다. 최근
 * 달의 고객은 아직 구매까지 갈 시간이 없었을 수 있어 전환율이 낮게 보인다는
 * 점을 화면에도 적어 둔다.
 */
export const MondayStats = ({
  state,
  actions,
  status,
  onReload,
}: MondayStatsProps) => {
  const { period, months, stats } = state
  const { changeFrom, changeTo, resetPeriod } = actions
  const { steps, visitSplit, callback, sources, assignees } = stats
  const valid = steps[0].count

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav">
        <div className="inner">
          <span className="stats_nav_label">최초 인입 월</span>
          <div className="page_size_select">
            <select
              value={period.from ?? ''}
              aria-label="시작 월"
              onChange={(e) => changeFrom(e.target.value || null)}
            >
              <option value="">처음부터</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <span className="stats_nav_label">~</span>
          <div className="page_size_select">
            <select
              value={period.to ?? ''}
              aria-label="끝 월"
              onChange={(e) => changeTo(e.target.value || null)}
            >
              <option value="">지금까지</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          {(period.from || period.to) && (
            <button type="button" className="stats_reset" onClick={resetPeriod}>
              전체 기간
            </button>
          )}
          <span className="stats_nav_note">
            고객 {people(stats.totalCustomers)} 중 오기입{' '}
            {people(stats.misentryCustomers)} 제외
          </span>
        </div>
      </div>

      <div className="xtool-main monday_stats">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>Monday 고객 목록을 불러오지 못했습니다.</p>
              <button type="button" onClick={onReload}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              <section className="stats_card">
                <h2>퍼널</h2>
                <p className="stats_desc">
                  유효 고객 중 각 단계까지 간 고객. 구매는 방문체험 없이도
                  일어나므로 앞 단계의 부분집합이 아닙니다.
                </p>
                <div className="stats_bars">
                  {steps.map((step) => (
                    <Bar
                      key={step.label}
                      label={step.label}
                      share={step.rate}
                      value={people(step.count)}
                      note={percent(step.rate)}
                    />
                  ))}
                </div>
              </section>

              <div className="stats_row">
                <section className="stats_card">
                  <h2>방문체험과 구매</h2>
                  <p className="stats_desc">
                    방문체험을 완료한 고객과 그렇지 않은 고객의 구매 전환율.
                  </p>
                  <div className="stats_tiles">
                    <Tile
                      label="방문체험 → 구매"
                      value={percent(visitSplit.visited.purchaseRate)}
                      note={`${people(visitSplit.visited.customers)} 중 ${people(visitSplit.visited.purchases)}`}
                    />
                    <Tile
                      label="방문체험 없이 → 구매"
                      value={percent(visitSplit.notVisited.purchaseRate)}
                      note={`${people(visitSplit.notVisited.customers)} 중 ${people(visitSplit.notVisited.purchases)}`}
                    />
                  </div>
                </section>

                <section className="stats_card">
                  <h2>최초 인입 → 구매 소요 일수</h2>
                  <p className="stats_desc">
                    문의 기록이 있는 구매 고객 {people(stats.days.customers)}{' '}
                    기준. 결제 기록만 있는 고객 제외.
                  </p>
                  <div className="stats_tiles">
                    <Tile label="중앙값" value={days(stats.days.median)} />
                    <Tile label="평균" value={days(stats.days.mean)} />
                  </div>
                  <div className="stats_bars compact">
                    {stats.days.buckets.map((bucket) => (
                      <Bar
                        key={bucket.label}
                        label={bucket.label}
                        share={bucket.rate}
                        value={people(bucket.count)}
                        note={percent(bucket.rate)}
                      />
                    ))}
                  </div>
                </section>
              </div>

              <section className="stats_card">
                <h2>콜백 단계별 전환</h2>
                <p className="stats_desc">
                  문의 기록이 있는 고객을 콜백이 마지막으로 도달한 단계로
                  나눴습니다. 단계를 건너뛰어 적은 경우(2단계부터, 1→3단계)는
                  날짜가 적힌 가장 높은 단계까지 간 것으로 봅니다.
                </p>
                <RateTable
                  head="최종 도달 단계"
                  rows={callback}
                  extra={{
                    title: '이 단계 이상',
                    cell: (_, index) => people(callback[index].reached),
                  }}
                />
              </section>

              <section className="stats_card">
                <h2>유입 경로별 전환</h2>
                <p className="stats_desc">
                  가장 이른 상담의 UTM source, 없으면 방문체험 보드의 유입경로.
                  유효 고객 {people(valid)} 기준.
                </p>
                <RateTable head="유입 경로" rows={sources} />
              </section>

              <section className="stats_card">
                <h2>담당자별 성과</h2>
                <p className="stats_desc">
                  고객의 기록에 가장 많이 나온 담당자 기준.
                </p>
                <RateTable head="담당자" rows={assignees} />
              </section>

              <p className="stats_footnote">
                기간은 고객이 처음 기록에 나타난 달입니다. 최근 달의 고객은 아직
                구매까지 갈 시간이 없었을 수 있어 전환율이 낮게 보입니다.
                온라인몰 구매는 포함되지 않습니다(오프라인 결제 보드만 집계).
              </p>
            </>
          )}
        </div>
        {status === 'loading' && <Loading />}
      </div>
    </>
  )
}
