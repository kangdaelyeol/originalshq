import type { ReactNode } from 'react'
import type {
  PivotView,
} from '../../view-model/use-channel-insight-page-view-model'
import {
  aggregateMetrics,
  emptyMetrics,
  groupByDayOfWeek,
  groupByWeek,
  metricsForDateSubset,
  weekdayLabelOf,
  type DateSummary,
} from '../../client'
import {
  channelSafeFields,
  METRIC_FIELDS,
  type MetricKey,
} from '../metric-fields'
import { MetricHeaderLabel } from './metric-header'
import { averageValueOf } from './metric-values'
import { SplitDecimalValue } from './split-decimal-value'
import { PIVOT_VIEW_OPTIONS } from './constants'

// ------------------------------------------------------------------ 캠페인/adset 교차표
interface PivotGroup {
  key: string
  label: string
  byDate: readonly DateSummary[]
}

/** 캠페인/adset 탭 전용 — 선택된 항목(캠페인 또는 adset) × 선택된 지표를 교차
 * 표시한다. 첫 두 행은 항상 합계/평균(조회 기간 전체 기준)이고, 그 아래는
 * view에 따라 날짜(최신순)/요일/주차 단위로 묶인다. 어느 축이든 각 셀은 그
 * 축이 가리키는 날짜 구간으로 그룹의 byDate를 다시 필터링해 합산하므로
 * (metricsForDateSubset), 세 모드가 같은 렌더 경로를 탄다. */
export function PivotSummary({
  groups,
  metricKeys,
  dates,
  emptyLabel,
  showUnit,
  view,
  toolbar,
}: {
  groups: readonly PivotGroup[]
  metricKeys: readonly MetricKey[]
  dates: readonly string[]
  emptyLabel: string
  /** 지표 헤더에 단위(원/%/회 등)를 같이 보여줄지. */
  showUnit: boolean
  view: PivotView
  /** 제목 옆 컨트롤(보기 단위·지표·단위 표시) — 이 표에만 걸리는 설정이라
   * 표 머리에 같이 둔다. */
  toolbar: ReactNode
}) {
  // 캠페인/adset 단위는 오프라인/온라인/총 매출·ROAS를 귀속시킬 방법이 없어
  // 항상 0이라(ACCOUNT_ONLY_METRIC_KEYS) 사용자가 지표 선택에서 골랐더라도
  // 이 표에서는 아예 뺀다.
  const metricFields = channelSafeFields(METRIC_FIELDS).filter((f) =>
    metricKeys.includes(f.key),
  )

  const head = (
    <div className="channel-insight__section-head">
      <h3 className="channel-insight__section-title">
        선택한 캠페인·광고셋 비교
      </h3>
      <div
        className="channel-insight__metric-row"
        role="group"
        aria-label="비교 표 설정"
      >
        {toolbar}
      </div>
    </div>
  )

  if (groups.length === 0 || metricFields.length === 0) {
    return (
      <section className="channel-insight__section channel-insight__pivot">
        {head}
        <p className="channel-insight__result-empty">
          {groups.length === 0 ? emptyLabel : '표시할 지표를 선택해주세요.'}
        </p>
      </section>
    )
  }

  // 합계/평균 행 — 조회 기간 전체 기준이라 view(날짜/요일/주차)와 무관하게 항상
  // 같다. sum 연산은 "0인 날"이 명시적으로 있든 아예 없든 결과가 같으므로,
  // g.byDate를 그대로 합치면 된다(과거처럼 dates 전체를 순회하며 emptyMetrics로
  // 채워 넣을 필요가 없다).
  const dayCount = dates.length || 1
  const groupAverages = groups.map((g) => ({
    key: g.key,
    agg: aggregateMetrics(g.byDate),
  }))

  // 행 축(첫 컬럼) — view에 따라 날짜/요일/주차로 갈라진다. 각 행은 "그 구간에
  // 속하는 날짜인지" predicate만 들고 있고, 실제 값은 렌더링 시 그룹별로
  // metricsForDateSubset을 태워 구한다.
  type PivotRow = {
    key: string
    label: string
    predicate: (d: string) => boolean
  }
  let pivotRows: PivotRow[] = []
  if (dates.length > 0) {
    if (view === 'byDate') {
      // 최신 날짜가 위로 오도록 — dates는 오름차순으로 들어오므로 뒤집기만.
      pivotRows = [...dates].reverse().map((date) => ({
        key: date,
        label: `${date} (${weekdayLabelOf(date)})`,
        predicate: (d) => d === date,
      }))
    } else if (view === 'byDayOfWeek') {
      // 실제 값 없이 날짜만으로 요일 라벨 집합을 구한다(월요일부터, 데이터에
      // 있는 요일만) — insight-aggregate의 표준 순서를 그대로 재사용.
      pivotRows = groupByDayOfWeek(
        dates.map((d) => ({ date: d, ...emptyMetrics() })),
      ).map((row) => ({
        key: row.dayOfWeek,
        label: row.dayOfWeek,
        predicate: (d) => weekdayLabelOf(d) === row.dayOfWeek,
      }))
    } else {
      // groupByWeek의 주차 경계는 rows 내용과 무관하게 startDate/endDate만으로
      // 정해지므로, 구간만 뽑아 쓰고 집계값(전부 0)은 버린다.
      // 날짜별과 같이 최신 주가 위.
      pivotRows = groupByWeek([], dates[0], dates[dates.length - 1])
        .map((week) => ({
          key: week.period,
          label: week.period,
          predicate: (d: string) => d >= week.startDate && d <= week.endDate,
        }))
        .reverse()
    }
  }

  return (
    <section className="channel-insight__section channel-insight__pivot">
      {head}
      <div className="channel-insight__table-wrap">
        <table className="channel-insight__table channel-insight__table--pivot">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="channel-insight__pivot-date-head channel-insight__pivot-sticky-col"
              >
                {PIVOT_VIEW_OPTIONS.find((o) => o.value === view)?.label ??
                  '날짜'}
              </th>
              {groups.map((g) => (
                <th
                  key={g.key}
                  colSpan={metricFields.length}
                  className="channel-insight__pivot-group-head"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {groups.flatMap((g) =>
                metricFields.map((f) => (
                  <th
                    key={`${g.key}-${f.key}`}
                    className="channel-insight__pivot-metric-head"
                  >
                    <MetricHeaderLabel
                      field={f}
                      label={showUnit ? `${f.label}(${f.unit})` : undefined}
                    />
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 ? (
              <tr>
                <td colSpan={1 + groups.length * metricFields.length}>
                  데이터 없음
                </td>
              </tr>
            ) : (
              <>
                <tr className="channel-insight__table-row--total">
                  <td className="channel-insight__pivot-sticky-col">합계</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        {f.formatCompact(agg[f.key])}
                      </td>
                    )),
                  )}
                </tr>
                <tr className="channel-insight__table-row--average">
                  <td className="channel-insight__pivot-sticky-col">평균</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        <SplitDecimalValue
                          text={f.formatCompact(
                            averageValueOf(f, agg, dayCount),
                          )}
                        />
                      </td>
                    )),
                  )}
                </tr>
                {pivotRows.map((row) => (
                  <tr key={row.key}>
                    <td className="channel-insight__pivot-sticky-col">
                      {row.label}
                    </td>
                    {groups.flatMap((g) => {
                      const agg = metricsForDateSubset(g.byDate, row.predicate)
                      return metricFields.map((f) => (
                        <td key={`${g.key}-${f.key}`}>
                          {f.formatCompact(agg[f.key])}
                        </td>
                      ))
                    })}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ 캠페인·광고셋 목록
