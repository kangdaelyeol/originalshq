import '@/screens/xtool-lead-manager/styles/tech-stats.scss'
import { Calculator, Coins, Receipt, Repeat, Store, Trophy } from 'lucide-react'
import { Segmented, StatTile } from '@/components/glass'
import type { useSalesTeamViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  SALES_METRIC_LABEL,
  formatDayShort,
  formatWon,
  formatWonShort,
  type InflowUnit,
  type SaleFact,
} from '@/screens/xtool-lead-manager/utils'
import { BoardTrendList } from './board-trend-list'
import { InflowChart } from './inflow-chart'
import { KingCard } from './king-card'
import { SalesNeglect } from './neglect-section'
import { percentOf } from '@/screens/xtool-lead-manager/utils/calc'

type SalesTeam = ReturnType<typeof useSalesTeamViewModel>
type King = SalesTeam['state']['kings']['week'][number]

const count = (value: number) => `${value.toLocaleString('ko-KR')}건`

const SPAN_LABEL = { week: '이번 주', month: '이번 달' } as const
const PREVIOUS_LABEL = { week: '지난주', month: '지난달' } as const

/** 펼친 줄 — 그 사람의 숫자를 이룬 결제. 이름을 누르면 Monday에서 열린다. */
const SaleList = ({ sales }: { sales: SaleFact[] }) => (
  <ul className="cs_contrib">
    {sales.map((sale) => (
      <li key={sale.key} onClick={(event) => event.stopPropagation()}>
        {sale.url ? (
          <a
            className="cs_contrib_name"
            href={sale.url}
            target="_blank"
            rel="noreferrer"
          >
            {sale.name}
          </a>
        ) : (
          <span className="cs_contrib_name">{sale.name}</span>
        )}
        <span className="cs_contrib_board">
          {sale.products.join(', ') || sale.boardName}
        </span>
        <span className="cs_contrib_dates">
          <span className="is-main">{formatWonShort(sale.amount)}</span>
          <span>결제 {sale.paidAt}</span>
        </span>
      </li>
    ))}
  </ul>
)

const SalesKingCard = ({
  king,
  span,
  openRows,
  onToggle,
}: {
  king: King
  span: 'week' | 'month'
  openRows: ReadonlySet<string>
  onToggle: (key: string) => void
}) => {
  const valueText = (value: number) =>
    king.def.unit === 'won' ? formatWonShort(value) : count(value)
  return (
    <KingCard
      title={`${SPAN_LABEL[span]} ${king.def.title}`}
      desc={king.def.desc}
      rows={king.rows.map((row) => ({
        name: row.name,
        value: row.value,
        valueText:
          king.def.unit === 'won'
            ? `${valueText(row.value)} · ${row.count}건`
            : valueText(row.value),
        detail: <SaleList sales={row.sales} />,
      }))}
      totalText={valueText(king.total)}
      emptyText={`${formatDayShort(king.period.start)}~${formatDayShort(king.period.end)}`}
      notes={[
        ...(king.unassigned > 0
          ? [
              king.def.id === 'visit'
                ? `체험 없이 결제 ${count(king.unassigned)}`
                : `담당자 없음 ${count(king.unassigned)}`,
            ]
          : []),
        `${PREVIOUS_LABEL[span]} 1위 ${
          king.previousTop
            ? `${king.previousTop.name} ${valueText(king.previousTop.value)}`
            : '없음'
        }`,
      ]}
      openKey={`${span}:${king.def.id}`}
      openRows={openRows}
      onToggle={onToggle}
    />
  )
}

/**
 * 통계 탭의 영업통계 — 오프라인 결제(Monday 결제 보드)를 담당자별로.
 *
 *   · 영업왕: 이번 주(일~토)·이번 달의 매출왕·계약왕·체험매출왕. 기간 선택과
 *     무관하다.
 *   · 기간 요약·추이·담당자별·큰 결제: 위에서 고른 기간과 단위.
 *   · 체험 후 영업 미처리: 기간과 무관한 오늘 기준(인입통계의 콜백 미처리와
 *     같은 모양).
 *
 * 담당자가 여럿인 결제는 각자에게 전액을 더한다(개인 KPI와 같은 기준) — 팀
 * 합계만 실제 매출이다. 온라인(Cafe24) 주문은 담당자가 없어 빠진다.
 */
export const SalesTeamSection = ({
  team,
  unit,
  drawKey,
  neglect,
}: {
  team: SalesTeam
  unit: InflowUnit
  drawKey: string
  /** 체험 후 영업 미처리 표 — 통계 탭의 방치 현황에서. */
  neglect: Parameters<typeof SalesNeglect>[0]
}) => {
  const { state, actions } = team
  const {
    metric,
    detailed,
    kings,
    summary,
    points,
    pointSummary,
    trends,
    assignees,
    top,
    openRows,
  } = state
  const { changeMetric, toggleRow } = actions
  const metricUnit = metric === 'amount' ? '만원' : '건'

  return (
    <div className="tech_stats">
      {/* 영업왕 — 이번 주·이번 달 각각 세 장. */}
      <div className="cs_team">
        <div className="cs_team_head">
          <div>
            <h2>영업왕</h2>
            <p className="stats_desc">
              이번 주(일~토)·이번 달 기준, 위의 기간 선택과 무관 · 오프라인
              결제(계약 기준, 취소 제외) · 담당자가 여럿이면 각자 전액 · 줄을
              누르면 결제 목록
            </p>
          </div>
        </div>
        {(['week', 'month'] as const).map((span) => (
          <div key={span} className="cs_team_row">
            {kings[span].map((king) => (
              <SalesKingCard
                key={king.def.id}
                king={king}
                span={span}
                openRows={openRows}
                onToggle={toggleRow}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 기간 요약 + 추이. */}
      <section className="stats_card">
        <div className="kpi_head">
          <div>
            <h2>
              {INFLOW_UNIT_LABEL[unit]} 영업 {SALES_METRIC_LABEL[metric]}
            </h2>
            <p className="stats_desc">
              결제일 기준 · 그래프는 실제 매출(중복 없이)
              {metric === 'amount' && ', 만원 단위'} · 담당자별 추이는 각자
              전액이라 합이 전체보다 클 수 있음
            </p>
          </div>
          <Segmented
            options={SALES_METRIC_LABEL}
            value={metric}
            onChange={changeMetric}
            label="추이 기준"
          />
        </div>

        <div className="stats_tiles tech_tiles">
          <StatTile
            icon={Coins}
            label="오프라인 매출"
            value={formatWonShort(summary.amount)}
            sub={formatWon(summary.amount)}
          />
          <StatTile
            icon={Receipt}
            label="결제 건수"
            value={count(summary.count)}
            sub={`결제 담당 ${summary.sellers}명`}
          />
          <StatTile
            icon={Calculator}
            label="객단가"
            value={formatWonShort(summary.average)}
            sub={`중앙값 ${formatWonShort(summary.median)}`}
          />
          <StatTile
            icon={Repeat}
            label="재구매 매출 비중"
            value={
              detailed ? percentOf(summary.repeatAmount, summary.amount) : '-'
            }
            sub={
              detailed
                ? `재구매 ${count(summary.repeatCount)} · ${formatWonShort(summary.repeatAmount)}`
                : '다음 Monday 동기화 뒤에 보입니다'
            }
          />
          <StatTile
            icon={Store}
            label="방문체험 거친 매출"
            value={percentOf(summary.visitAmount, summary.amount)}
            sub={`${count(summary.visitCount)} · ${formatWonShort(summary.visitAmount)}`}
          />
          <StatTile
            icon={Trophy}
            label="가장 큰 결제"
            value={summary.top ? formatWonShort(summary.top.amount) : '-'}
            sub={
              summary.top
                ? `${summary.top.name} · ${summary.top.assignees.join(', ') || '담당자 없음'}`
                : undefined
            }
          />
        </div>

        <InflowChart
          key={`${drawKey}:${metric}`}
          points={points}
          average={pointSummary.average}
          metric={{ name: SALES_METRIC_LABEL[metric], unit: metricUnit }}
        />
        <div className="inflow_table_block">
          <div className="inflow_table_head">
            <h3>담당자별 {INFLOW_UNIT_LABEL[unit]} 현황</h3>
          </div>
          <BoardTrendList
            key={`${drawKey}:${metric}`}
            trends={trends}
            points={points}
            columns={{
              name: '담당자',
              peak: `가장 많은 ${INFLOW_UNIT_NOUN[unit]}`,
            }}
            unit={metricUnit}
            empty="이 기간에 결제가 없습니다."
          />
        </div>
      </section>

      {/* 담당자별 표. */}
      <section className="stats_card">
        <h2>담당자별 영업 성과</h2>
        <p className="stats_desc">
          위에서 고른 기간 · 결제일 기준 · 방문체험 매출은 결제 전 마지막 체험
          담당자에게 · 담당자가 여럿이면 각자 전액
        </p>
        {assignees.length === 0 ? (
          <p className="tech_empty">이 기간에 결제가 없습니다.</p>
        ) : (
          <div className="trend_table_scroll">
            <table className="stats_table tech_assignee_table">
              <thead>
                <tr>
                  <th>담당자</th>
                  <th>결제</th>
                  <th>매출</th>
                  <th>객단가</th>
                  <th>재구매</th>
                  <th>방문체험 매출</th>
                  <th>최고 계약</th>
                  {detailed && <th>주요 품목</th>}
                </tr>
              </thead>
              <tbody>
                {assignees.map((row) => (
                  <tr
                    key={row.name}
                    className={row.name === '담당자 없음' ? 'is-muted' : ''}
                  >
                    <td>{row.name}</td>
                    <td>{row.count}</td>
                    <td>
                      <strong>{formatWonShort(row.amount)}</strong>
                    </td>
                    <td>{row.count ? formatWonShort(row.average) : '-'}</td>
                    <td>{detailed ? row.repeat : '-'}</td>
                    <td>
                      {row.visitAmount ? formatWonShort(row.visitAmount) : '-'}
                    </td>
                    <td>{row.top ? formatWonShort(row.top) : '-'}</td>
                    {detailed && (
                      <td className="tech_products">
                        {row.products.join(', ') || '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 큰 결제 — 이름을 누르면 Monday에서 열린다. */}
      <section className="stats_card">
        <h2>큰 결제 TOP {top.length || ''}</h2>
        <p className="stats_desc">위에서 고른 기간 · 금액 큰 순</p>
        {top.length === 0 ? (
          <p className="tech_empty">이 기간에 결제가 없습니다.</p>
        ) : (
          <div className="trend_table_scroll">
            <table className="stats_table tech_assignee_table">
              <thead>
                <tr>
                  <th>고객</th>
                  <th>결제일</th>
                  <th>담당자</th>
                  {detailed && <th>품목</th>}
                  <th>금액</th>
                </tr>
              </thead>
              <tbody>
                {top.map((sale) => (
                  <tr key={sale.key}>
                    <td>
                      {sale.url ? (
                        <a
                          className="monday_link"
                          href={sale.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {sale.name}
                        </a>
                      ) : (
                        sale.name
                      )}
                      {sale.repeat && <span className="tech_tag">재구매</span>}
                    </td>
                    <td>{sale.paidAt}</td>
                    <td>{sale.assignees.join(', ') || '-'}</td>
                    {detailed && (
                      <td className="tech_products">
                        {sale.products.join(', ') || '-'}
                      </td>
                    )}
                    <td>
                      <strong>{formatWon(sale.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* 체험 후 영업 미처리 — 오늘 기준. */}
      <SalesNeglect {...neglect} />
      {neglect.rows.length === 0 && (
        <p className="stats_footnote">
          체험을 마치고 결제·미전환을 기다리는 고객 가운데 기한을 넘긴 건이
          없습니다(서버 배포 뒤 첫 Monday 동기화부터 집계).
        </p>
      )}
    </div>
  )
}
