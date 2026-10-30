import { Check, UsersRound, X } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import type { useCsTeamViewModel } from '@/screens/xtool-lead-manager/view-model'
import type {
  CsCardKey,
  CsCardView,
  KpiPairSortBy,
} from '@/screens/xtool-lead-manager/view-model'
import {
  INFLOW_UNIT_NOUN,
  formatKpi,
  periodLabel,
  type CsContributor,
  type CsContributorKind,
  type CsMemberStats,
  type KpiResult,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { KpiCard } from './kpi-section'
import { kpiTrendRows } from './kpi-trend-rows'
import { KpiPairCard } from './kpi-pair-card'
import { CallbackNeglect } from './neglect-section'
import {
  Ring,
  TrendList,
  Segmented,
  type TrendListRow,
} from '@/components/glass'

type CsTeam = ReturnType<typeof useCsTeamViewModel>

const count = (value: number) => `${value.toLocaleString('ko-KR')}건`
const rate = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-'

type MetricKey = 'intake' | 'paid' | 'visit'

const VIEW_LABEL: Record<CsCardView, string> = {
  chart: '그래프',
  table: '표',
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/**
 * 건수+비율 지표(방문체험 확정·결제 전환)를 추이 목록 줄로. 정렬 기준이
 * 그래프가 무엇을 그릴지도 정한다 — 건수 순이면 기간별 건수, 비율 순이면
 * 기간별 전환율. 합계 칸은 건수, 막대는 전환율(가장 높은 사람 = 가득).
 */
const pairRows = (
  each: KpiResult,
  labels: string[],
  by: KpiPairSortBy,
): TrendListRow[] => {
  const metric = (cell: KpiResult['sum']['total']) =>
    by === 'count' ? (cell.num ?? 0) : cell.value
  const maxRate = Math.max(0, ...each.rows.map((row) => row.total.value))
  return [...each.rows]
    .sort((a, b) => metric(b.total) - metric(a.total))
    .map((row) => {
      const series = row.byPeriod.map(metric)
      const peak = series.indexOf(Math.max(...series))
      const cellText = (cell: KpiResult['sum']['total']) =>
        by === 'count'
          ? `${count(cell.num ?? 0)} · ${formatKpi(cell, 'percent')}`
          : `${formatKpi(cell, 'percent')} · ${count(cell.num ?? 0)}`
      return {
        key: row.assignee,
        name: row.assignee,
        series,
        seriesText: row.byPeriod.map(cellText),
        value: (
          <>
            {(row.total.num ?? 0).toLocaleString('ko-KR')}
            <small>건</small>
          </>
        ),
        bar: {
          ratio: ratio(row.total.value, maxRate),
          text: formatKpi(row.total, 'percent'),
        },
        peak:
          series[peak] > 0
            ? {
                index: peak,
                text: (
                  <>
                    {labels[peak]} ·{' '}
                    <strong>
                      {by === 'count'
                        ? count(series[peak])
                        : formatKpi(row.byPeriod[peak], 'percent')}
                    </strong>
                  </>
                ),
              }
            : null,
        ariaLabel: `${row.assignee} ${row.total.num ?? 0}건, ${formatKpi(row.total, 'percent')}`,
      }
    })
}

const METRICS: {
  key: MetricKey
  title: string
  desc: string
}[] = [
  {
    key: 'intake',
    title: '인입 처리 수',
    desc: '기간에 접수된 상담 중 처리한(신규 상담 유입 아닌) 건수',
  },
  {
    key: 'paid',
    title: '구매 전환 수',
    desc: '상담 중 결제된 건수 · 전환율',
  },
  {
    key: 'visit',
    title: '방문체험 전환 수',
    desc: '상담 중 방문체험이 확정된 건수 · 전환율',
  },
]

/** 펼친 줄 — 그 숫자를 이룬 상담(고객) 목록. 이름을 누르면 Monday에서 그
 * 상담이 열린다. 날짜는 그 숫자의 기준(접수·확정·결제)이 굵게. Monday 기록이
 * 잘못 들어간 건을 찾는 용도다. */
const ContributorList = ({
  items,
  kind,
}: {
  items: CsContributor[] | null
  kind: CsContributorKind
}) => {
  if (items === null)
    return (
      <p className="cs_contrib_empty">
        고객 목록은 다음 Monday 동기화(매일 09·11·13·15·17·22시) 뒤에 보입니다.
      </p>
    )
  if (items.length === 0)
    return <p className="cs_contrib_empty">해당하는 상담이 없습니다.</p>
  const main =
    kind === 'confirm' || kind === 'visit'
      ? 'confirmedAt'
      : kind === 'paid' || kind === 'paidAt'
        ? 'paidAt'
        : 'receivedAt'
  return (
    <ul className="cs_contrib">
      {items.map((each) => (
        <li key={each.key} onClick={(event) => event.stopPropagation()}>
          {each.url ? (
            <a
              className="cs_contrib_name"
              href={each.url}
              target="_blank"
              rel="noreferrer"
            >
              {each.name}
            </a>
          ) : (
            <span className="cs_contrib_name">{each.name}</span>
          )}
          <span className="cs_contrib_board">{each.boardName}</span>
          <span className="cs_contrib_dates">
            {(
              [
                ['receivedAt', '접수'],
                ['confirmedAt', '확정'],
                ['paidAt', '결제'],
              ] as const
            )
              .filter(([field]) => each[field])
              .map(([field, label]) => (
                <span
                  key={field}
                  className={field === main ? 'is-main' : undefined}
                >
                  {label} {each[field]}
                </span>
              ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 지표 하나(카드 하나) — 담당자를 그 지표가 큰 순으로, 막대와 숫자로. 줄을
 * 누르면 그 숫자를 이룬 상담이 펼쳐진다. */
const MetricCard = ({
  metric,
  members,
  total,
  allIntake,
  openRows,
  onToggle,
  contributorsOf,
}: {
  metric: (typeof METRICS)[number]
  members: CsMemberStats[]
  total: CsMemberStats
  allIntake: number
  openRows: ReadonlySet<string>
  onToggle: (key: string) => void
  contributorsOf: CsTeam['state']['contributorsOf']
}) => {
  const rows = [...members].sort(
    (a, b) =>
      b[metric.key] - a[metric.key] || a.name.localeCompare(b.name, 'ko'),
  )
  const max = Math.max(1, ...rows.map((each) => each[metric.key]))
  const isRate = metric.key !== 'intake'

  return (
    <section className="stats_card cs_metric">
      <h2>{metric.title}</h2>
      <p className="stats_desc">{metric.desc}</p>
      <div className="cs_metric_total">
        {/* 링 — 구매·방문체험은 CS팀 전환율, 인입 처리는 전체 상담 중 CS팀 몫. */}
        <Ring
          value={
            isRate
              ? ratio(total[metric.key], total.intake)
              : ratio(total.intake, allIntake)
          }
          text={
            isRate
              ? rate(total[metric.key], total.intake)
              : rate(total.intake, allIntake)
          }
          label={isRate ? 'CS팀 전환율' : '전체 상담 중 CS팀'}
        />
        <div className="cs_metric_total_text">
          <strong>{count(total[metric.key])}</strong>
          <span>
            {isRate ? 'CS팀 전환율' : `전체 상담 ${count(allIntake)} 중`}
          </span>
        </div>
      </div>
      <ul className="cs_metric_rows">
        {rows.map((each) => {
          // 아래 추이 카드(withContributors)와 같은 이름(intake)을 써도 따로
          // 펼쳐지게 앞에 summary를 붙인다.
          const key = `summary:${metric.key}:${each.name}`
          const open = openRows.has(key)
          return (
            <Fragment key={each.name}>
              <li
                className={`cs_metric_row${open ? ' is-open' : ''}`}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => onToggle(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onToggle(key)
                  }
                }}
              >
                <span className="cs_metric_name">
                  <span className="cs_metric_caret" aria-hidden="true">
                    {open ? '▾' : '▸'}
                  </span>
                  {each.name}
                </span>
                <span className="cs_metric_bar" aria-hidden="true">
                  <span
                    style={{ width: `${(each[metric.key] / max) * 100}%` }}
                  />
                </span>
                <span className="cs_metric_value">
                  {count(each[metric.key])}
                  {isRate && (
                    <small>{rate(each[metric.key], each.intake)}</small>
                  )}
                </span>
              </li>
              {open && (
                <li className="cs_metric_detail">
                  <ContributorList
                    items={contributorsOf(each.name, metric.key)}
                    kind={metric.key}
                  />
                </li>
              )}
            </Fragment>
          )
        })}
      </ul>
    </section>
  )
}

/** CS팀 명단 편집 — 상담 담당자로 나온 이름을 눌러 넣고 뺀다. */
const MemberEditor = ({
  members,
  candidates,
  onSave,
  onClose,
}: {
  members: string[]
  candidates: { name: string; count: number }[]
  onSave: (members: string[]) => void
  onClose: () => void
}) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(members),
  )
  const closeRef = useRef<HTMLButtonElement>(null)
  useModal(onClose, closeRef)

  // 명단에는 있는데 최근 상담 담당자에는 없는 이름(퇴사 등)도 뺄 수 있게 보여준다.
  const options = [
    ...candidates,
    ...members
      .filter((name) => !candidates.some((each) => each.name === name))
      .map((name) => ({ name, count: 0 })),
  ]
  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="cs_editor_backdrop" onClick={onClose}>
      <div
        className="cs_editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cs_editor_head">
          <h2 id="cs-editor-title">CS팀 명단</h2>
          <button
            ref={closeRef}
            type="button"
            className="cs_editor_close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <p className="stats_desc">숫자는 지금까지 맡은 총 상담 수입니다.</p>
        <div className="cs_editor_options" role="group" aria-label="담당자">
          {options.map(({ name, count: total }) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.has(name)}
              className={selected.has(name) ? 'is-selected' : ''}
              onClick={() => toggle(name)}
            >
              <span className="cs_editor_check" aria-hidden="true">
                <Check strokeWidth={2.4} />
              </span>
              {name}
              <small>{total.toLocaleString('ko-KR')}</small>
            </button>
          ))}
        </div>
        <div className="cs_editor_actions">
          <span>{selected.size}명 선택</span>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="is-primary"
            // 후보 순서(많이 맡은 순)대로 저장한다.
            onClick={() =>
              onSave(
                options
                  .map((each) => each.name)
                  .filter((name) => selected.has(name)),
              )
            }
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

/** 인입통계 맨 아래 — CS팀 담당자별 성과. 위 인입통계와 같은 기간·단위로
 * 본다: 인입 처리·구매 전환·방문체험 전환
 * 카드, 개인 KPI에서 가져온 방문체험 확정·결제 전환(건수와 비율을 한 표에),
 * 그리고 지금 기준 콜백 미처리. */
export const CsTeamSection = ({
  csTeam,
  sorts,
  onSort,
  neglectExpanded,
  onToggleNeglect,
  today,
}: {
  csTeam: CsTeam
  sorts: Record<string, TableSort>
  onSort: (table: string, key: string) => void
  neglectExpanded: ReadonlySet<string>
  onToggleNeglect: (key: string) => void
  today: string
}) => {
  const { state, actions } = csTeam
  const { members, stats, candidates, editing, unit, kpi, neglect, views } =
    state
  // 그래프 툴팁·가장 큰 칸의 이름 — 표 머리글과 같은 기간 이름.
  const labels = kpi.periods.map((key) => periodLabel(key, unit))
  const noun = INFLOW_UNIT_NOUN[unit]
  // 기간(단위·첫 칸·끝 칸)이 바뀌면 카드·그래프를 새로 붙여 처음부터 다시
  // 그린다(그대로 두면 값만 바뀌어 막대·곡선이 그려지지 않는다).
  const drawKey = `${unit}:${kpi.periods[0]}:${kpi.periods[kpi.periods.length - 1]}`
  // 추이 목록 줄마다 — 누르면 그 줄 숫자를 이룬 상담이 펼쳐진다.
  const withContributors = (
    rows: TrendListRow[],
    card: string,
    kind: CsContributorKind,
  ): TrendListRow[] =>
    rows.map((row) => {
      const key = `trend:${card}:${row.key}`
      const open = state.openRows.has(key)
      return {
        ...row,
        open,
        onToggle: () => actions.toggleRow(key),
        detail: open ? (
          <ContributorList
            items={state.contributorsOf(row.key, kind)}
            kind={kind}
          />
        ) : null,
      }
    })
  const toggle = (key: CsCardKey, label: string) => (
    <Segmented
      options={VIEW_LABEL}
      value={views[key]}
      onChange={(next) => actions.changeView(key, next)}
      label={label}
    />
  )

  return (
    <div className="cs_team">
      <div className="cs_team_head">
        <div>
          <h2>CS팀 인입 성과</h2>
          <p className="stats_desc">
            위 인입통계와 같은 기간·단위로 봅니다. 카드는 그 기간에 접수된 상담
            중 처리된 것 기준(오기입·신규 상담 유입 제외) · 결제·방문체험 확정은
            지금까지 된 것까지 센다
          </p>
        </div>
        <button
          type="button"
          className="cs_team_edit"
          onClick={actions.openEditor}
        >
          <UsersRound strokeWidth={1.8} aria-hidden="true" />
          명단 설정
          {members.length > 0 && (
            <span className="cs_team_edit_count">{members.length}명</span>
          )}
        </button>
      </div>

      {members.length === 0 && (
        <div className="stats_card cs_team_empty">
          아직 CS팀 명단이 없습니다.{' '}
          <button
            type="button"
            className="cs_team_link"
            onClick={actions.openEditor}
          >
            명단 설정
          </button>
          에서 인입 담당자를 골라 주세요.
        </div>
      )}
      {members.length > 0 && (
        <>
          <div key={drawKey} className="cs_team_row">
            {METRICS.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                members={stats.members}
                total={stats.total}
                allIntake={stats.allIntake}
                openRows={state.openRows}
                onToggle={actions.toggleRow}
                contributorsOf={state.contributorsOf}
              />
            ))}
          </div>

          <KpiCard
            each={kpi.intake}
            unit={unit}
            periods={kpi.periods}
            sort={sorts['cs-kpi:intake']}
            onSort={(key) => onSort('cs-kpi:intake', key)}
            aside={toggle('intake', '인입 처리 수 보기')}
            body={
              views.intake === 'chart' ? (
                <TrendList
                  key={drawKey}
                  rows={withContributors(
                    kpiTrendRows(kpi.intake, labels),
                    'intake',
                    'intake',
                  )}
                  labels={labels}
                  columns={{
                    name: '담당자',
                    value: '합계',
                    bar: 'CS팀 중 비중',
                    peak: `가장 많은 ${noun}`,
                  }}
                />
              ) : undefined
            }
          />

          {kpi.kpis.map((each) => (
            <KpiPairCard
              key={each.id}
              each={each}
              unit={unit}
              periods={kpi.periods}
              sort={sorts[`cs-kpi:${each.id}`]}
              onSort={(key) => onSort(`cs-kpi:${each.id}`, key)}
              sortBy={each.sortBy}
              onSortBy={(by) => actions.changeSortBy(each.id, by)}
              aside={toggle(each.id as CsCardKey, `${each.title} 보기`)}
              body={
                views[each.id as CsCardKey] === 'chart' ? (
                  <TrendList
                    // 건수 순 / 비율 순을 바꿔도 그래프 내용이 바뀌므로 다시 그린다.
                    key={`${drawKey}:${each.sortBy}`}
                    rows={withContributors(
                      pairRows(each, labels, each.sortBy),
                      each.id,
                      each.id === 'confirm-rate' ? 'confirm' : 'paidAt',
                    )}
                    labels={labels}
                    columns={{
                      name: '담당자',
                      value: '건수',
                      bar: '전환율',
                      peak:
                        each.sortBy === 'count'
                          ? `가장 많은 ${noun}`
                          : `가장 높은 ${noun}`,
                    }}
                  />
                ) : undefined
              }
            />
          ))}

          <CallbackNeglect
            rows={neglect}
            today={today}
            expanded={neglectExpanded}
            onToggle={onToggleNeglect}
            sort={sorts['neglect:callback']}
            onSort={(key) => onSort('neglect:callback', key)}
            view={views.neglect}
            onView={(next) => actions.changeView('neglect', next)}
          />
        </>
      )}

      {editing && (
        <MemberEditor
          members={members}
          candidates={candidates}
          onSave={actions.save}
          onClose={actions.closeEditor}
        />
      )}
    </div>
  )
}
