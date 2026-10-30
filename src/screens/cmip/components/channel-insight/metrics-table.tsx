import { Fragment, type CSSProperties } from 'react'
import { useMetricsTableViewModel } from '../../view-model/use-metrics-table-view-model'
import { aggregateMetrics, type MetricsSummary } from '../../client'
import {
  ACCOUNT_ONLY_METRIC_KEYS,
  channelSafeFields,
  METRIC_FIELDS,
  type MetricKey,
} from '../metric-fields'
import { CHANNELS, type ChannelKey } from '../channels'
import { CHANNEL_CHIP_COLOR } from './constants'
import { ChannelLabel } from './channel-label'
import { ChevronIcon, SortArrows } from '../icons'
import { MetricCell } from './metric-cell'
import { SortableMetricHeader } from './metric-header'
import { averageValueOf } from './metric-values'
import { SplitDecimalValue } from './split-decimal-value'

interface ChannelBreakdown {
  meta: MetricsSummary
  google: MetricsSummary
  naver: MetricsSummary
  openai: MetricsSummary
}

export function MetricsTable<T extends MetricsSummary>({
  rows,
  rowKey,
  headLabel,
  headValue,
  getChannelBreakdown,
  channels,
  showCompare,
  visibleKeys,
  onToggleMetric,
  channelFilter,
  onChannelFilterChange,
  labelDefaultDir = 'desc',
}: {
  rows: readonly T[]
  rowKey: (row: T) => string
  headLabel: string
  headValue: (row: T) => string
  /** 그 행(날짜/요일/주차)이 가리키는 기간의 채널별 total — 드롭다운으로 펼쳐 보여준다.
   * channelFilter가 'all'이 아니면(이미 그 채널 하나만 보는 중이라) 아예 안 쓰인다. */
  getChannelBreakdown: (row: T) => ChannelBreakdown
  /** 펼쳤을 때 보여줄 채널 — 이 캠페인/adset에 아예 데이터가 없는 채널(예: Meta
   * 전용 캠페인의 Google)은 모든 행이 0으로만 나와서 무의미하니 미리 제외하고 받는다.
   * channelFilter가 'all'이 아니면 호출부가 빈 배열을 넘겨 펼치기 자체를 끈다. */
  channels: readonly { key: ChannelKey; label: string }[]
  /** 켜면 각 지표 칸 왼쪽에 바로 앞 행 대비 증감·등락률을 같이 보여준다. */
  showCompare: boolean
  /** 표시할 지표 컬럼 — 재조회할 때마다 이 표(MetricsTable) 자체가 로딩
   * 스켈레톤과 자리를 바꿔치기(unmount/remount)해서, 상태를 여기 안에 두면
   * 조회할 때마다 필터가 풀려버린다. 그래서 호출부(ResultPanel)가 들고 있다가
   * 넘겨준다. */
  visibleKeys: ReadonlySet<MetricKey>
  onToggleMetric: (key: MetricKey) => void
  /** 채널 필터 — "전체"(combined 합계, 기본)이거나 특정 채널 하나. rows 자체를
   * 어느 걸 넘길지(combined.byDate 대 meta.byDate 등)는 호출부가 결정하고,
   * 여기서는 필터 버튼 상태만 그대로 받아 그리고 되돌려준다(값도 visibleKeys와
   * 같은 이유로 ResultPanel이 들고 있다). */
  channelFilter: 'all' | ChannelKey
  onChannelFilterChange: (value: 'all' | ChannelKey) => void
  /** 첫 칸(날짜·요일·기간)의 기본 정렬 — 날짜·주차·기간은 최신이 위(desc),
   * 요일은 월~일 순서(asc). */
  labelDefaultDir?: 'asc' | 'desc'
}) {
  const { expanded, sort, displayRows, compareRowAt, toggleSort, toggle } =
    useMetricsTableViewModel(rows, labelDefaultDir)

  // channelFilter가 특정 채널이면 rows 자체가 그 채널 단독 값(호출부가 넘겨줌)이라
  // 매출/ROAS 지표가 항상 0으로만 나온다 — 컬럼 토글 목록·표시 컬럼 둘 다에서
  // 아예 뺀다(토글 버튼만 남겨두면 눌러도 아무 변화가 없어 혼란스럽다).
  const toggleableFields =
    channelFilter === 'all' ? METRIC_FIELDS : channelSafeFields(METRIC_FIELDS)
  const visibleFields = toggleableFields.filter((f) => visibleKeys.has(f.key))
  // 맨 아래 합계/평균 행 — 정렬·채널 필터와 무관하게 항상 이 표에 실제로 보이는
  // rows(=현재 channelFilter 기준 전체) 전체를 기준으로 한다. PivotSummary의
  // 합계/평균 행(맨 위)과 같은 계산(averageValueOf)을 공유하되, 여기는 일수가
  // 아니라 "이 표에 있는 행 수"로 나눈다 — 일별 표는 행 하나가 하루라 결과가
  // 같고, 요일별·주차별·지정 기간 표는 "행 평균"이 더 자연스럽다.
  const totals = rows.length > 0 ? aggregateMetrics(rows) : null

  return (
    <div className="channel-insight__table-block">
      <div
        className="channel-insight__full-list-channel-filter"
        role="group"
        aria-label="채널 필터"
      >
        <button
          type="button"
          className={`channel-insight__full-list-toggle-btn${channelFilter === 'all' ? ' is-active' : ''}`}
          aria-pressed={channelFilter === 'all'}
          onClick={() => onChannelFilterChange('all')}
        >
          전체
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`channel-insight__full-list-toggle-btn${channelFilter === c.key ? ' is-active' : ''}`}
            style={
              { '--chip-color': CHANNEL_CHIP_COLOR[c.key] } as CSSProperties
            }
            aria-pressed={channelFilter === c.key}
            onClick={() => onChannelFilterChange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        className="channel-insight__full-list-toggles"
        role="group"
        aria-label="컬럼 표시"
      >
        {toggleableFields.map((f) => {
          const active = visibleKeys.has(f.key)
          return (
            <button
              key={f.key}
              type="button"
              className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
              style={{ '--chip-color': f.color } as CSSProperties}
              aria-pressed={active}
              onClick={() => onToggleMetric(f.key)}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* 줄이 많으면(예: 6개월을 일별로) 약 20줄 높이에서 세로 스크롤 —
          머리글은 위에, 합계·평균은 아래에 붙어 있다. */}
      <div className="channel-insight__table-wrap channel-insight__table-wrap--scroll">
        <table className="channel-insight__table">
          <thead>
            <tr>
              <th
                className="channel-insight__table-toggle-head"
                aria-hidden="true"
              />
              <th>
                <button
                  type="button"
                  className="channel-insight__sort-head"
                  onClick={() => toggleSort('label')}
                >
                  {headLabel}
                  <SortArrows active={sort.key === 'label'} dir={sort.dir} />
                </button>
              </th>
              {visibleFields.map((f) => (
                <th key={f.key}>
                  <SortableMetricHeader
                    field={f}
                    active={sort.key === f.key}
                    dir={sort.dir}
                    onSort={() => toggleSort(f.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length + 2}>데이터 없음</td>
              </tr>
            ) : (
              displayRows.map((row, index) => {
                const key = rowKey(row)
                // 채널 필터가 걸려 있으면(이미 그 채널 하나만 보는 중이라)
                // channels가 빈 배열로 넘어온다 — 펼쳐봐야 보여줄 채널별
                // 분해가 없으므로 펼치기 자체를 끈다.
                const canExpand = channels.length > 0
                const isOpen = canExpand && expanded.has(key)
                const breakdown = isOpen ? getChannelBreakdown(row) : null
                // 대비 대상 — 지표로 정렬했으면 화면상 바로 윗 행, 기간
                // 순서면 시간상 이전 기간(최신이 위일 때는 바로 아랫줄).
                // 정렬을 바꾸면 비교 대상도 같이 바뀐다(roas-panel 표와 같은
                // 기준).
                const prevRow = compareRowAt(index)
                // 채널별 펼침 행도 메인 행과 같은 기준으로
                // 대비를 보여준다 — 그 채널의 윗 행 값이 필요하니 윗 행을 같은
                // 방식으로 한 번 더 분해해둔다.
                const prevBreakdown =
                  isOpen && showCompare && prevRow
                    ? getChannelBreakdown(prevRow)
                    : null
                return (
                  <Fragment key={key}>
                    <tr
                      className={
                        canExpand
                          ? 'channel-insight__table-row--clickable'
                          : undefined
                      }
                      role={canExpand ? 'button' : undefined}
                      tabIndex={canExpand ? 0 : undefined}
                      aria-expanded={canExpand ? isOpen : undefined}
                      onClick={canExpand ? () => toggle(key) : undefined}
                      onKeyDown={
                        canExpand
                          ? (e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              toggle(key)
                            }
                          : undefined
                      }
                    >
                      <td className="channel-insight__table-toggle-cell">
                        {canExpand && (
                          <span
                            className={`channel-insight__table-toggle${
                              isOpen ? ' is-open' : ''
                            }`}
                          >
                            <ChevronIcon />
                          </span>
                        )}
                      </td>
                      <td>{headValue(row)}</td>
                      {visibleFields.map((f) => (
                        <td key={f.key}>
                          <MetricCell
                            value={row[f.key]}
                            prevValue={prevRow ? prevRow[f.key] : null}
                            format={f.formatCompact}
                            showCompare={showCompare}
                          />
                        </td>
                      ))}
                    </tr>
                    {breakdown &&
                      channels.map((channel) => (
                        <tr
                          key={`${key}-${channel.key}`}
                          className="channel-insight__table-row--channel"
                        >
                          <td />
                          <td className="channel-insight__table-channel-label">
                            <ChannelLabel
                              channelKey={channel.key}
                              label={channel.label}
                            />
                          </td>
                          {visibleFields.map((f) =>
                            ACCOUNT_ONLY_METRIC_KEYS.has(f.key) ? (
                              <td key={f.key}>—</td>
                            ) : (
                              <td key={f.key}>
                                <MetricCell
                                  value={breakdown[channel.key][f.key]}
                                  prevValue={
                                    prevBreakdown
                                      ? prevBreakdown[channel.key][f.key]
                                      : null
                                  }
                                  format={f.formatCompact}
                                  showCompare={showCompare}
                                />
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                  </Fragment>
                )
              })
            )}
            {totals && (
              <>
                <tr className="channel-insight__table-row--total">
                  <td />
                  <td>합계</td>
                  {visibleFields.map((f) => (
                    <td key={f.key}>{f.formatCompact(totals[f.key])}</td>
                  ))}
                </tr>
                <tr className="channel-insight__table-row--average">
                  <td />
                  <td>평균</td>
                  {visibleFields.map((f) => (
                    <td key={f.key}>
                      <SplitDecimalValue
                        text={f.formatCompact(
                          averageValueOf(f, totals, rows.length),
                        )}
                      />
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
