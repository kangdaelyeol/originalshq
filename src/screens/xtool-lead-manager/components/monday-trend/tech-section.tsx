import '@/screens/xtool-lead-manager/styles/tech-stats.scss'
import type { CSSProperties } from 'react'
import {
  Clock,
  Coins,
  MessageSquare,
  Truck,
  Unlink,
  Wrench,
} from 'lucide-react'
import {
  LoadingPanel,
  Segmented,
  StackedBars,
  StatTile,
  type StackSegment,
} from '@/components/glass'
import type { useTechStatsViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  INFLOW_UNIT_LABEL,
  INFLOW_UNIT_NOUN,
  TECH_BASIS_LABEL,
  TECH_BOARD_LABEL,
  TECH_PHASE_LABEL,
  TECH_STALE_DAYS,
  formatDayShort,
  formatWon,
  type InflowUnit,
  type TechBreakdown,
  type TechPhase,
  type TechRankRow,
} from '@/screens/xtool-lead-manager/utils'
import { BoardTrendList } from './board-trend-list'
import { InflowChart } from './inflow-chart'
import { KingCard } from './king-card'

type Tech = ReturnType<typeof useTechStatsViewModel>
type King = Tech['state']['kings']['week'][number]

const count = (value: number) => `${value.toLocaleString('ko-KR')}건`
const days = (value: number | null) =>
  value === null ? '-' : `${value.toLocaleString('ko-KR')}일`

const SPAN_LABEL = { week: '이번 주', month: '이번 달' } as const
const PREVIOUS_LABEL = { week: '지난주', month: '지난달' } as const

const PHASE_COLOR: Record<TechPhase, string> = {
  new: 'var(--pipe-0)',
  doing: 'var(--pipe-2)',
  waiting: 'var(--pipe-hold)',
}

// 오래 걸리는 건 목록 — 처음에는 이만큼만, 나머지는 펼쳐서.
const STALE_PREVIEW = 12

/** 펼친 줄 — 그 사람의 숫자를 이룬 기록. 이름을 누르면 Monday에서 열린다. */
const KingFacts = ({
  row,
  dateLabel,
}: {
  row: TechRankRow
  dateLabel: string
}) => (
  <ul className="cs_contrib">
    {row.facts.map(({ fact, date }) => (
      <li key={fact.itemId} onClick={(event) => event.stopPropagation()}>
        {fact.url ? (
          <a
            className="cs_contrib_name"
            href={fact.url}
            target="_blank"
            rel="noreferrer"
          >
            {fact.name || '이름 없음'}
          </a>
        ) : (
          <span className="cs_contrib_name">{fact.name || '이름 없음'}</span>
        )}
        <span className="cs_contrib_board">
          {[fact.device, fact.type, fact.status].filter(Boolean).join(' · ')}
        </span>
        <span className="cs_contrib_dates">
          <span className="is-main">
            {dateLabel} {date}
          </span>
          {fact.assignees.length > 1 && (
            <span>{fact.assignees.join(', ')}</span>
          )}
        </span>
      </li>
    ))}
  </ul>
)

/** 기술팀 왕 카드 하나 — 공용 왕 카드(king-card.tsx)에 건수로. */
const TechKingCard = ({
  king,
  span,
  openRows,
  onToggle,
}: {
  king: King
  span: 'week' | 'month'
  openRows: ReadonlySet<string>
  onToggle: (key: string) => void
}) => (
  <KingCard
    title={`${SPAN_LABEL[span]} ${king.def.title}`}
    badge={TECH_BOARD_LABEL[king.def.kind]}
    desc={king.def.desc}
    rows={king.rows.map((row) => ({
      name: row.name,
      value: row.count,
      valueText: count(row.count),
      detail: <KingFacts row={row} dateLabel={king.def.dateLabel} />,
    }))}
    totalText={count(king.total)}
    emptyText={`${formatDayShort(king.period.start)}~${formatDayShort(king.period.end)}`}
    notes={[
      ...(king.unassigned > 0 ? [`담당자 없음 ${count(king.unassigned)}`] : []),
      `${PREVIOUS_LABEL[span]} 1위 ${
        king.previousTop
          ? `${king.previousTop.name} ${count(king.previousTop.count)}`
          : '없음'
      }`,
    ]}
    openKey={`${span}:${king.def.id}`}
    openRows={openRows}
    onToggle={onToggle}
  />
)

/** 값 하나로 센 막대 목록(기기·문의 종류 등) — 많은 순으로 상위 8개. */
const BreakdownCard = ({ breakdown }: { breakdown: TechBreakdown }) => {
  const shown = breakdown.rows.slice(0, 8)
  const max = Math.max(1, ...shown.map((row) => row.count))
  return (
    <section className="stats_card tech_breakdown">
      <h2>
        {breakdown.title}{' '}
        <span className="tech_breakdown_total">{count(breakdown.total)}</span>
      </h2>
      <p className="stats_desc">{breakdown.desc}</p>
      {shown.length === 0 ? (
        <p className="tech_empty">이 기간에 접수된 건이 없습니다.</p>
      ) : (
        <ul className="tech_bar_rows">
          {shown.map((row, index) => (
            <li
              key={row.name}
              style={{ '--glass-i': index } as CSSProperties}
              className={row.name === '미입력' ? 'is-muted' : undefined}
            >
              <span className="tech_bar_name" title={row.name}>
                {row.name}
              </span>
              <span className="tech_bar_track" aria-hidden="true">
                <span style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="tech_bar_value">{count(row.count)}</span>
            </li>
          ))}
        </ul>
      )}
      {breakdown.rows.length > shown.length && (
        <p className="tech_more">외 {breakdown.rows.length - shown.length}개</p>
      )}
    </section>
  )
}

/**
 * 통계 탭의 기술 통계 — 기술지원팀 네 보드(출장·AS·아톡문의·기타업무).
 *
 *   · 왕: 이번 주(월~일)·이번 달의 AS왕(출장)·수리왕(AS)·아톡처리왕(기술 문의).
 *     기간 선택과 무관하다.
 *   · 기간 요약·추이·담당자별·들어온 일의 내용: 위에서 고른 기간과 단위.
 *   · 지금 진행 현황: 오늘 기준(기간과 무관).
 *
 * 번호가 없어 고객에 묶이지 못한 기록도 센다 — 고객 연결과 별개로 일한 것은
 * 일한 것이라.
 */
export const TechSection = ({
  tech,
  unit,
  drawKey,
}: {
  tech: Tech
  unit: InflowUnit
  drawKey: string
}) => {
  const { state, actions } = tech
  const {
    status,
    basis,
    kings,
    summary,
    points,
    pointSummary,
    trends,
    assignees,
    backlog,
    breakdowns,
    openRows,
  } = state
  const { reload, changeBasis, toggleRow } = actions

  if (status === 'error') {
    return (
      <div className="monday_error">
        <p>기술 통계를 불러오지 못했습니다.</p>
        <button type="button" onClick={reload}>
          다시 시도
        </button>
      </div>
    )
  }
  if (status !== 'ready') {
    return (
      <section className="stats_card">
        <LoadingPanel label="기술 통계를 불러오는 중" minHeight={420} />
      </section>
    )
  }

  const openTotal = backlog.rows.reduce((sum, row) => sum + row.total, 0)
  const staleTotal = backlog.stale.length
  const staleOpen = openRows.has('stale')
  const segments: StackSegment[] = (
    Object.keys(PHASE_COLOR) as TechPhase[]
  ).map((phase) => ({
    key: phase,
    label: TECH_PHASE_LABEL[phase],
    color: PHASE_COLOR[phase],
  }))
  const phaseSum = Object.fromEntries(
    segments.map((segment) => [
      segment.key,
      backlog.rows.reduce(
        (sum, row) => sum + row.counts[segment.key as TechPhase],
        0,
      ),
    ]),
  )

  return (
    <div className="tech_stats">
      {/* 왕 — 이번 주·이번 달 각각 세 장. */}
      <div className="cs_team">
        <div className="cs_team_head">
          <div>
            <h2>기술팀 왕</h2>
            <p className="stats_desc">
              이번 주(월~일)·이번 달 기준, 위의 기간 선택과 무관 · 담당자가
              둘이면 둘 다 1건 · 줄을 누르면 센 기록
            </p>
          </div>
        </div>
        {(['week', 'month'] as const).map((span) => (
          <div key={span} className="cs_team_row">
            {kings[span].map((king) => (
              <TechKingCard
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

      {/* 기간 요약 + 추이 — 인입통계와 같은 그래프·추이 목록. */}
      <section className="stats_card">
        <div className="kpi_head">
          <div>
            <h2>
              {INFLOW_UNIT_LABEL[unit]} 기술팀 {TECH_BASIS_LABEL[basis]} 건수
            </h2>
            <p className="stats_desc">
              {basis === 'received'
                ? '접수일 기준(기타업무는 요청일) · 번호 없는 기록 포함'
                : '끝난 날 기준 — 출장은 방문일, AS·기타업무는 완료일, 아톡문의는 마지막 수정일'}
            </p>
          </div>
          <Segmented
            options={TECH_BASIS_LABEL}
            value={basis}
            onChange={changeBasis}
            label="세는 기준"
          />
        </div>

        <div className="stats_tiles tech_tiles">
          <StatTile
            icon={Truck}
            label="출장 완료"
            value={count(summary.done.fieldService)}
            sub={`접수 ${count(summary.received.fieldService)} · 접수→방문 ${days(summary.fieldLeadDays)}`}
          />
          <StatTile
            icon={Wrench}
            label="AS 수리 완료"
            value={count(summary.done.repair)}
            sub={`접수 ${count(summary.received.repair)} · 접수→완료 ${days(summary.repairDays)}`}
          />
          <StatTile
            icon={MessageSquare}
            label="아톡 문의 처리"
            value={count(summary.inquiryHandled)}
            sub={`접수 ${count(summary.received.techInquiry)} 중`}
          />
          <StatTile
            icon={Coins}
            label="AS 청구액"
            value={formatWon(summary.repairAmount)}
            sub="기간에 끝난 AS의 부품·공임"
          />
          <StatTile
            icon={Clock}
            label="지금 진행 중"
            value={count(openTotal)}
            warn={staleTotal > 0}
            sub={`오래 걸리는 건 ${count(staleTotal)} · 기간과 무관`}
          />
          <StatTile
            icon={Unlink}
            label="고객 미연결 접수"
            value={count(summary.unlinked)}
            warn={summary.unlinked > 0}
            sub="번호가 없어 고객에 안 묶임 · 기타업무 제외"
          />
        </div>

        <InflowChart
          key={`${drawKey}:${basis}`}
          points={points}
          average={pointSummary.average}
          metric={{ name: TECH_BASIS_LABEL[basis], unit: '건' }}
        />
        <div className="inflow_table_block">
          <div className="inflow_table_head">
            <h3>보드별 {INFLOW_UNIT_LABEL[unit]} 현황</h3>
          </div>
          <BoardTrendList
            key={`${drawKey}:${basis}`}
            trends={trends}
            points={points}
            columns={{
              name: '보드',
              peak: `가장 많은 ${INFLOW_UNIT_NOUN[unit]}`,
            }}
          />
        </div>
        {summary.guessed > 0 && (
          <p className="tech_note">
            완료로 옮겼지만 완료일(출장은 방문 일정)이 비어 있는{' '}
            {count(summary.guessed)}은 Monday 마지막 수정일로 셌습니다.
          </p>
        )}
      </section>

      {/* 담당자별 — 세 왕과 같은 기준에 기타업무 완료를 더한 표. */}
      <section className="stats_card">
        <h2>담당자별 처리</h2>
        <p className="stats_desc">
          위에서 고른 기간 · 출장·AS는 끝난 날, 아톡은 접수일, 기타업무는 완료일
          기준 · 담당자가 둘이면 둘 다 1건
        </p>
        {assignees.length === 0 ? (
          <p className="tech_empty">이 기간에 처리한 건이 없습니다.</p>
        ) : (
          <div className="trend_table_scroll">
            <table className="stats_table tech_assignee_table">
              <thead>
                <tr>
                  <th>담당자</th>
                  <th>출장 완료</th>
                  <th>AS 수리 완료</th>
                  <th>아톡 처리</th>
                  <th>기타업무 완료</th>
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                {assignees.map((row) => (
                  <tr
                    key={row.name}
                    className={row.name === '담당자 없음' ? 'is-muted' : ''}
                  >
                    <td>{row.name}</td>
                    <td>{row.field}</td>
                    <td>{row.repair}</td>
                    <td>{row.inquiry}</td>
                    <td>{row.task}</td>
                    <td>
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 지금 진행 현황 — 오늘 기준. */}
      <section className="stats_card">
        <div className="kpi_head">
          <div>
            <h2>
              지금 진행 현황{' '}
              <span className="neglect_total">{count(openTotal)}</span>
            </h2>
            <p className="stats_desc">
              기간 선택과 무관 · 완료 그룹 제외 · 오래 걸리는 건은 접수 후 AS{' '}
              {TECH_STALE_DAYS.repair}일, 아톡 {TECH_STALE_DAYS.techInquiry}일,
              출장·기타업무 {TECH_STALE_DAYS.fieldService}일이 지난 것
            </p>
          </div>
        </div>
        <StackedBars
          segments={segments}
          rows={backlog.rows.map((row) => ({
            key: row.kind,
            label: TECH_BOARD_LABEL[row.kind],
            values: row.counts,
            total: row.total,
            aside: (
              <span className={row.stale > 0 ? 'tech_stale_aside' : ''}>
                {row.stale > 0 ? `오래 걸림 ${row.stale}` : '—'}
                {row.oldestDays !== null && ` · 최장 ${row.oldestDays}일`}
              </span>
            ),
          }))}
          sum={{ values: phaseSum, total: openTotal }}
          sumLabel="전체"
        />

        {staleTotal > 0 && (
          <div className="tech_stale">
            <h3>
              오래 걸리는 건{' '}
              <span className="neglect_total">{staleTotal}건</span>
            </h3>
            <div className="trend_table_scroll">
              <table className="stats_table tech_stale_table">
                <thead>
                  <tr>
                    <th>보드</th>
                    <th>이름</th>
                    <th>단계</th>
                    <th>담당자</th>
                    <th>접수일</th>
                    <th>경과</th>
                  </tr>
                </thead>
                <tbody>
                  {(staleOpen
                    ? backlog.stale
                    : backlog.stale.slice(0, STALE_PREVIEW)
                  ).map(({ fact, days: age }) => (
                    <tr key={fact.itemId}>
                      <td>{TECH_BOARD_LABEL[fact.kind]}</td>
                      <td>
                        {fact.url ? (
                          <a
                            className="monday_link"
                            href={fact.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {fact.name || '이름 없음'}
                          </a>
                        ) : (
                          fact.name || '이름 없음'
                        )}
                      </td>
                      <td>{fact.stage ?? '-'}</td>
                      <td>{fact.assignees.join(', ') || '-'}</td>
                      <td>{fact.receivedAt}</td>
                      <td>
                        <strong>{age}일</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {staleTotal > STALE_PREVIEW && (
              <button
                type="button"
                className="tech_more_btn"
                onClick={() => toggleRow('stale')}
              >
                {staleOpen ? '접기' : `${staleTotal - STALE_PREVIEW}건 더 보기`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* 들어온 일의 내용 — 위에서 고른 기간에 접수된 것. */}
      <div className="tech_breakdowns">
        {breakdowns.map((breakdown) => (
          <BreakdownCard key={breakdown.id} breakdown={breakdown} />
        ))}
      </div>
    </div>
  )
}
