import type { KeyboardEvent, ReactNode } from 'react'
import {
  Banknote,
  CalendarCheck,
  CreditCard,
  Hourglass,
  Percent,
  PhoneCall,
  ShoppingBag,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Segmented, StatTile, TrendList } from '@/components/glass'
import type {
  CardView,
  useMondayTrendViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  formatKpi,
  KPI_UNIT_LABEL,
  periodLabel,
  periodOptions,
  type KpiRange,
  type KpiUnit,
  type TableSort,
} from '@/screens/xtool-lead-manager/utils'
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'
import { NeglectSection } from './neglect-section'
import { kpiTrendColumns, kpiTrendRows } from './kpi-trend-rows'
import { SortableTh } from './sortable-th'

type Kpi = ReturnType<typeof useMondayTrendViewModel>['state']['kpi']

/**
 * 개인 KPI의 기간 고르기 — 내비 줄에 들어간다. 단위마다 고르는 방식이 다르다:
 * 일별은 cmip 달력, 주별·월별은 시작·끝 주(월) 선택. 기간은 단위마다 따로
 * 기억해서, 단위를 오가도 각자 고른 기간이 남아 있다.
 */
export const KpiControls = ({
  kpi,
  onUnit,
  onRange,
}: {
  kpi: Pick<Kpi, 'unit' | 'range' | 'firstDate'>
  onUnit: (unit: KpiUnit) => void
  onRange: (range: Partial<KpiRange>) => void
}) => {
  const { unit, range, firstDate } = kpi
  const options = unit === 'day' ? [] : periodOptions(unit, firstDate)

  return (
    <>
      <Segmented
        options={KPI_UNIT_LABEL}
        value={unit}
        onChange={onUnit}
        label="묶는 단위"
        size="md"
      />
      {unit === 'day' ? (
        <DateRangePicker
          dateStart={range.from}
          dateEnd={range.to}
          onChange={(from, to) => onRange({ from, to })}
        />
      ) : (
        <>
          <div className="page_size_select">
            <select
              value={range.from}
              aria-label={unit === 'week' ? '시작 주' : '시작 월'}
              onChange={(e) => onRange({ from: e.target.value })}
            >
              {options.map((key) => (
                <option key={key} value={key}>
                  {periodLabel(key, unit)}
                </option>
              ))}
            </select>
          </div>
          <span className="stats_nav_label">~</span>
          <div className="page_size_select">
            <select
              value={range.to}
              aria-label={unit === 'week' ? '끝 주' : '끝 월'}
              onChange={(e) => onRange({ to: e.target.value })}
            >
              {options.map((key) => (
                <option key={key} value={key}>
                  {periodLabel(key, unit)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </>
  )
}

type Neglect = ReturnType<typeof useMondayTrendViewModel>['state']['neglect']

const VIEW_LABEL: Record<CardView, string> = {
  chart: '그래프',
  table: '표',
}

/** 단위별 "날/주/달" — 추이 목록의 가장 큰 칸 머리글. */
const UNIT_NOUN: Record<KpiUnit, string> = {
  day: '날',
  week: '주',
  month: '달',
}

/** 지표 타일의 아이콘. */
const KPI_ICON: Record<string, LucideIcon> = {
  'confirm-count': CalendarCheck,
  'confirm-rate': Percent,
  'paid-rate': CreditCard,
  'direct-paid': ShoppingBag,
  'visit-paid-rate': Target,
  'visit-sales': Wallet,
  sales: Banknote,
}
type KpiResult = Kpi['kpis'][number]
type Cell = { num?: number; den?: number }

/** 비율 칸에 마우스를 올리면 보이는 분자/분모. */
const ratioTitle = (each: KpiResult, cell: Cell): string | undefined =>
  each.format === 'percent' ? `${cell.num ?? 0} / ${cell.den ?? 0}` : undefined

/** 지표 하나의 카드(전체 보기) — 줄이 담당자, 칸이 기간, 맨 오른쪽이 조회 기간
 * 전체, 맨 아래가 모든 담당자 합. */
export const KpiCard = ({
  each,
  unit,
  periods,
  sort,
  onSort,
  aside,
  body,
}: {
  each: KpiResult
  unit: Kpi['unit']
  periods: string[]
  sort: TableSort | undefined
  onSort: (key: string) => void
  /** 합계 아래에 덧붙이는 것(보기 전환 등). */
  aside?: ReactNode
  /** 표 대신 그릴 것(그래프 보기) — 없으면 표. */
  body?: ReactNode
}) => {
  const title = (cell: Cell) => ratioTitle(each, cell)
  const totalEl = (
    <strong className="kpi_total" title={title(each.sum.total)}>
      {formatKpi(each.sum.total, each.format)}
    </strong>
  )
  return (
    <section className="stats_card kpi_card">
      <div className="kpi_head">
        <div>
          <h2>{each.title}</h2>
          <p className="stats_desc">{each.description}</p>
        </div>
        {aside ? (
          <div className="kpi_side">
            {totalEl}
            {aside}
          </div>
        ) : (
          totalEl
        )}
      </div>
      {body ??
        (each.rows.length === 0 ? (
          <p className="kpi_empty">이 기간에 기록이 없습니다.</p>
        ) : (
          <div className="trend_table_scroll">
            <table className="stats_table kpi_table">
              <thead>
                <tr>
                  <SortableTh columnKey="assignee" sort={sort} onSort={onSort}>
                    담당자
                  </SortableTh>
                  {periods.map((key) => (
                    <SortableTh
                      key={key}
                      columnKey={key}
                      sort={sort}
                      onSort={onSort}
                    >
                      {periodLabel(key, unit)}
                    </SortableTh>
                  ))}
                  <SortableTh
                    columnKey="total"
                    sort={sort}
                    onSort={onSort}
                    className="kpi_total_col"
                  >
                    전체
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {each.rows.map((row) => (
                  <tr key={row.assignee}>
                    <td>{row.assignee}</td>
                    {row.byPeriod.map((cell, i) => (
                      <td key={periods[i]} title={title(cell)}>
                        {formatKpi(cell, each.format)}
                      </td>
                    ))}
                    <td className="kpi_total_col" title={title(row.total)}>
                      {formatKpi(row.total, each.format)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{each.format === 'percent' ? '전체' : '합계'}</td>
                  {each.sum.byPeriod.map((cell, i) => (
                    <td key={periods[i]} title={title(cell)}>
                      {formatKpi(cell, each.format)}
                    </td>
                  ))}
                  <td className="kpi_total_col" title={title(each.sum.total)}>
                    {formatKpi(each.sum.total, each.format)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
    </section>
  )
}

/** 한 담당자 요약 — 위에 지표별 조회 기간 전체 값(타일), 아래에 지표 × 기간
 * 표. 이 담당자의 기록이 없는 지표는 '-'(비율)나 0으로 보인다. */
const PersonSummary = ({
  assignee,
  kpi,
  neglect,
}: {
  assignee: string
  kpi: Kpi
  neglect: Neglect
}) => {
  const { unit, periods, kpis } = kpi
  const blank = { value: 0, num: 0, den: 0 }
  const rowOf = (each: KpiResult) =>
    each.rows.find((row) => row.assignee === assignee) ?? {
      assignee,
      total: blank,
      byPeriod: periods.map(() => blank),
    }
  const neglected = (rows: Neglect['callback']) =>
    rows.find((row) => row.assignee === assignee)?.neglected ?? 0

  return (
    <>
      <section className="stats_card">
        <h2>{assignee} 요약</h2>
        <p className="stats_desc">
          조회 기간 전체 값. 방치는 기간과 무관한 {neglect.today} 기준입니다.
        </p>
        <div className="stats_tiles kpi_person_tiles">
          {kpis.map((each) => {
            const row = rowOf(each)
            const team = each.sum.total
            return (
              <StatTile
                key={each.id}
                icon={KPI_ICON[each.id] ?? TrendingUp}
                label={each.title}
                value={formatKpi(row.total, each.format)}
                sub={
                  each.format === 'percent'
                    ? `${row.total.num ?? 0}건 / ${row.total.den ?? 0}건 · 팀 ${formatKpi(team, 'percent')}`
                    : `팀 전체의 ${
                        team.value > 0
                          ? ((row.total.value / team.value) * 100).toFixed(1)
                          : '0.0'
                      }%`
                }
              />
            )
          })}
          <StatTile
            icon={PhoneCall}
            label="콜백 미처리"
            value={`${neglected(neglect.callback)}건`}
            warn={neglected(neglect.callback) > 0}
            sub="다음 연락 기한을 넘긴 상담"
          />
          <StatTile
            icon={Hourglass}
            label="방문체험 고객 미처리"
            value={`${neglected(neglect.visit)}건`}
            warn={neglected(neglect.visit) > 0}
            sub="다음 연락 기한을 넘긴 방문체험"
          />
        </div>
      </section>

      <section className="stats_card">
        <h2>{KPI_UNIT_LABEL[unit]} 지표</h2>
        <div className="trend_table_scroll">
          <table className="stats_table kpi_table">
            <thead>
              <tr>
                <th>지표</th>
                {periods.map((key) => (
                  <th key={key}>{periodLabel(key, unit)}</th>
                ))}
                <th className="kpi_total_col">전체</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((each) => {
                const row = rowOf(each)
                return (
                  <tr key={each.id}>
                    <td>{each.title}</td>
                    {row.byPeriod.map((cell, i) => (
                      <td key={periods[i]} title={ratioTitle(each, cell)}>
                        {formatKpi(cell, each.format)}
                      </td>
                    ))}
                    <td
                      className="kpi_total_col"
                      title={ratioTitle(each, row.total)}
                    >
                      {formatKpi(row.total, each.format)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/**
 * 개인 KPI — 맨 위에서 담당자를 고른다. "전체"면 지표마다 카드 하나(줄 =
 * 담당자)를, 한 담당자면 그 사람의 지표만 모은 요약을 보여 준다. 그 아래에는
 * 방치 현황(오늘 기준)이 붙는다 — 한 담당자를 고르면 그 사람 줄만.
 *
 * 비율은 기간·담당자를 합친 분자·분모로 다시 나눈 값이라(비율의 평균이
 * 아니라) 칸에 마우스를 올리면 분자/분모가 보인다.
 */
export const KpiSection = ({
  kpi,
  neglect,
  sorts,
  onSort,
  onSelectAssignee,
  onToggleNeglect,
  views,
  onView,
}: {
  kpi: Kpi
  neglect: Neglect
  sorts: Record<string, TableSort>
  onSort: (table: string, key: string) => void
  onSelectAssignee: (assignee: string | null) => void
  onToggleNeglect: (key: string) => void
  /** 카드마다의 보기(지표 id·neglect:callback·neglect:visit, 없으면 그래프). */
  views: Record<string, CardView>
  onView: (id: string, view: CardView) => void
}) => {
  const { unit, periods, kpis, assignees, assignee } = kpi
  const viewOf = (id: string): CardView => views[id] ?? 'chart'
  const labels = periods.map((key) => periodLabel(key, unit))
  // 기간이 바뀌면 그래프를 새로 붙여 처음부터 다시 그린다.
  const drawKey = `${unit}:${periods[0]}:${periods[periods.length - 1]}`
  const options = [null, ...assignees]

  /** ←/→로 이전·다음 담당자(끝에서는 반대쪽 끝으로), Home/End로 처음·끝. 고르는
   * 것과 동시에 포커스도 그 칩으로 옮긴다. */
  const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.indexOf(assignee)
    const last = options.length - 1
    const next =
      event.key === 'ArrowRight'
        ? current === last
          ? 0
          : current + 1
        : event.key === 'ArrowLeft'
          ? current === 0
            ? last
            : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    onSelectAssignee(options[next])
    const buttons =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button')
    buttons[next]?.focus()
  }

  const only = (rows: Neglect['callback']) =>
    assignee ? rows.filter((row) => row.assignee === assignee) : rows

  return (
    <>
      {/* 탭 목록 하나로 묶어, Tab 키로는 고른 칩 하나에만 들어오고 그 안에서는
          ←/→(Home/End)로 옮기면 바로 그 담당자가 골라진다. */}
      <div
        className="kpi_assignees"
        role="tablist"
        aria-label="담당자"
        onKeyDown={moveByKey}
      >
        {options.map((name) => (
          <button
            key={name ?? ''}
            type="button"
            role="tab"
            aria-selected={name === assignee}
            tabIndex={name === assignee ? 0 : -1}
            className={name === assignee ? 'active' : ''}
            onClick={() => onSelectAssignee(name)}
          >
            {name ?? '전체'}
          </button>
        ))}
      </div>

      {assignee ? (
        <PersonSummary assignee={assignee} kpi={kpi} neglect={neglect} />
      ) : (
        kpis.map((each) => (
          <KpiCard
            key={each.id}
            each={each}
            unit={unit}
            periods={periods}
            sort={sorts[`kpi:${each.id}`]}
            onSort={(key) => onSort(`kpi:${each.id}`, key)}
            aside={
              <Segmented
                options={VIEW_LABEL}
                value={viewOf(each.id)}
                onChange={(next) => onView(each.id, next)}
                label={`${each.title} 보기`}
              />
            }
            body={
              viewOf(each.id) === 'chart' ? (
                <TrendList
                  key={drawKey}
                  rows={kpiTrendRows(each, labels)}
                  labels={labels}
                  columns={kpiTrendColumns(each, UNIT_NOUN[unit])}
                />
              ) : undefined
            }
          />
        ))
      )}

      <h2 className="kpi_group_title">
        방치 현황 <small>{neglect.today} 기준 · 위 기간 선택과 무관</small>
      </h2>
      <NeglectSection
        neglect={{
          ...neglect,
          callback: only(neglect.callback),
          visit: only(neglect.visit),
        }}
        onToggle={onToggleNeglect}
        sorts={sorts}
        onSort={onSort}
        views={{
          callback: viewOf('neglect:callback'),
          visit: viewOf('neglect:visit'),
        }}
        onView={(kind, next) => onView(`neglect:${kind}`, next)}
      />

      <p className="stats_footnote">
        모든 지표는 그 기간에 일어난 일 기준입니다 — 예를 들어 결제 전환율은 그
        기간에 들어온 상담 수 대비 그 기간에 결제된 수라서, 이전 기간에 들어온
        상담이 이번 기간에 결제되면 이번 기간에 잡힙니다. 담당자는 각 보드의 주
        담당자(첫 번째)입니다.
      </p>
    </>
  )
}
