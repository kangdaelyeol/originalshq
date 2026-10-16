import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  formatKpi,
  KPI_UNIT_LABEL,
  periodLabel,
  periodOptions,
  type KpiRange,
  type KpiUnit,
} from '@/screens/xtool-lead-manager/utils'
import { DateRangePicker } from '@/screens/cmip/components/date-range-picker'

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
  kpi: Kpi
  onUnit: (unit: KpiUnit) => void
  onRange: (range: Partial<KpiRange>) => void
}) => {
  const { unit, range, firstDate } = kpi
  const options = unit === 'day' ? [] : periodOptions(unit, firstDate)

  return (
    <>
      <div className="stats_scope" role="tablist" aria-label="묶는 단위">
        {(Object.keys(KPI_UNIT_LABEL) as KpiUnit[]).map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={each === unit}
            className={each === unit ? 'active' : ''}
            onClick={() => onUnit(each)}
          >
            {KPI_UNIT_LABEL[each]}
          </button>
        ))}
      </div>
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

/**
 * 개인 KPI — 지표마다 카드 하나. 카드 안의 표는 줄이 담당자, 칸이 기간(일/주/
 * 월)이고 맨 오른쪽이 조회 기간 전체, 맨 아래가 모든 담당자 합이다. 비율은
 * 기간·담당자를 합친 분자·분모로 다시 나눈 값이라(비율의 평균이 아니라) 칸에
 * 마우스를 올리면 분자/분모가 보인다.
 */
export const KpiSection = ({ kpi }: { kpi: Kpi }) => {
  const { unit, periods, kpis } = kpi

  return (
    <>
      {kpis.map((each) => {
        const ratio = each.format === 'percent'
        const title = (cell: { num?: number; den?: number }) =>
          ratio ? `${cell.num ?? 0} / ${cell.den ?? 0}` : undefined
        return (
          <section key={each.id} className="stats_card kpi_card">
            <div className="kpi_head">
              <div>
                <h2>{each.title}</h2>
                <p className="stats_desc">{each.description}</p>
              </div>
              <strong className="kpi_total" title={title(each.sum.total)}>
                {formatKpi(each.sum.total, each.format)}
              </strong>
            </div>
            {each.rows.length === 0 ? (
              <p className="kpi_empty">이 기간에 기록이 없습니다.</p>
            ) : (
              <div className="trend_table_scroll">
                <table className="stats_table kpi_table">
                  <thead>
                    <tr>
                      <th>담당자</th>
                      {periods.map((key) => (
                        <th key={key}>{periodLabel(key, unit)}</th>
                      ))}
                      <th className="kpi_total_col">전체</th>
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
                      <td>{ratio ? '전체' : '합계'}</td>
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
            )}
          </section>
        )
      })}
      <p className="stats_footnote">
        모든 지표는 그 기간에 일어난 일 기준입니다 — 예를 들어 결제 전환율은 그
        기간에 들어온 상담 수 대비 그 기간에 결제된 수라서, 이전 기간에 들어온
        상담이 이번 기간에 결제되면 이번 기간에 잡힙니다. 담당자는 각 보드의 주
        담당자(첫 번째)입니다.
      </p>
    </>
  )
}
