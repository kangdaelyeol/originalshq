import { Fragment, type CSSProperties } from 'react'
import { Search } from 'lucide-react'
import { Segmented } from '@/components/glass'
import type { FullListView } from '../../view-model/use-channel-insight-page-view-model'
import {
  useFullListTableViewModel,
  type FullListRow,
} from '../../view-model/use-full-list-table-view-model'
import {
  channelSafeFields,
  METRIC_FIELDS,
  type MetricField,
} from '../metric-fields'
import { CHANNELS } from '../channels'
import { CHANNEL_CHIP_COLOR } from './constants'
import { ChannelLabel } from './channel-label'
import { InfoIcon, SortArrows } from '../icons'
import { SortableMetricHeader } from './metric-header'
import { CampaignCards } from './campaign-cards'

const VIEW_LABEL: Record<FullListView, string> = { card: '카드', table: '표' }

// 카드 보기의 정렬 — 큰 값·추이 그래프도 이 지표(이름 정렬이면 Spend).
const CARD_SORT = {
  spend: 'Spend',
  conversions: '전환',
  cpa: 'CPA',
  name: '이름',
} as const
type CardSortKey = keyof typeof CARD_SORT

/** 목록 표의 한 줄 — 캠페인(level 0, 펼치기 버튼)이나 그 아래 광고셋(level 1). */
function FullListTableRow({
  row,
  level,
  checked,
  onToggleSelect,
  open = false,
  onToggleOpen,
  showResultType,
  visibleFields,
  flashing,
  onFlashEnd,
}: {
  row: FullListRow
  level: 0 | 1
  checked: boolean
  onToggleSelect: (selectKey: string) => void
  open?: boolean
  /** 있으면 캠페인 줄을 눌러 광고셋을 펼친다. */
  onToggleOpen?: () => void
  showResultType: boolean
  visibleFields: readonly MetricField[]
  flashing: boolean
  onFlashEnd: () => void
}) {
  return (
    <tr
      data-select-key={row.selectKey}
      className={`channel-insight__full-list-row--level${level}${
        onToggleOpen ? ' channel-insight__table-row--clickable' : ''
      }${flashing ? ' channel-insight__full-list-row--flash' : ''}`}
      onClick={onToggleOpen}
      // 반짝임은 여러 애니메이션이 겹쳐 있어(빛줄기는 더 빨리 끝난다) 가장
      // 긴 빛·테두리 애니메이션(칸에서 끝나 줄로 올라온다)이 끝날 때만 비운다.
      onAnimationEnd={
        flashing
          ? (event) => {
              if (event.animationName.startsWith('channel-insight-row-flash'))
                onFlashEnd()
            }
          : undefined
      }
    >
      <td>
        <span
          className="channel-insight__full-list-name"
          style={{ paddingLeft: level * 22 }}
        >
          <input
            type="checkbox"
            className="channel-insight__full-list-check"
            checked={checked}
            aria-label={`${row.name} 교차표에 넣기`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => onToggleSelect(row.selectKey)}
          />
          {onToggleOpen ? (
            <button
              type="button"
              className="channel-insight__full-list-expand"
              aria-expanded={open}
              aria-label={`${row.name} 광고셋 ${open ? '접기' : '펼치기'}`}
              onClick={(event) => {
                event.stopPropagation()
                onToggleOpen()
              }}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            level === 0 && (
              <span className="channel-insight__full-list-expand" aria-hidden />
            )
          )}
          {row.name}
          {showResultType && row.resultType && (
            <span className="channel-insight__result-type-badge">
              {row.resultType}
            </span>
          )}
          {level === 0 && (row.children?.length ?? 0) > 0 && (
            <span className="channel-insight__full-list-count">
              광고셋 {row.children?.length}
            </span>
          )}
        </span>
      </td>
      {/* flex는 칸 안쪽 묶음에 준다 — td 자체를 flex로 두면 표 칸이 아니게 돼
          줄 높이만큼 늘어나지 않고(다른 칸보다 낮게) 따로 그려진다. */}
      <td>
        <span className="channel-insight__full-list-channels">
          {row.channels.map((ch) => (
            <ChannelLabel
              key={ch}
              channelKey={ch}
              label={CHANNELS.find((c) => c.key === ch)?.label ?? ch}
            />
          ))}
        </span>
      </td>
      {visibleFields.map((f) => (
        <td key={f.key}>{f.formatCompact(row.metrics[f.key])}</td>
      ))}
    </tr>
  )
}

/** 캠페인·광고셋 탭의 목록 — 전체 캠페인을 조회 기간 합계 기준(전체 요약 탭과
 * 같은 지표 컬럼)으로 한 줄씩 보여 주고, 캠페인 줄을 누르면 그 광고셋이 아래로
 * 펼쳐진다. 줄마다 체크박스로 아래 교차표·그래프에 넣을 캠페인·광고셋을
 * 고른다. 컬럼 헤더를 눌러 그 지표 기준으로 정렬한다(광고셋도 캠페인 안에서
 * 같은 기준으로). */
export function FullListTable({
  rows,
  headLabel,
  emptyLabel,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpanded,
  flashKey,
  onFlashEnd,
  view,
  onViewChange,
  periodLabel,
}: {
  rows: readonly FullListRow[]
  headLabel: string
  emptyLabel: string
  selected: ReadonlySet<string>
  onToggleSelect: (selectKey: string) => void
  /** 펼친 캠페인(row.key) — 위 요약 카드도 바꾸므로 밖에서 받는다. */
  expanded: ReadonlySet<string>
  onToggleExpanded: (key: string) => void
  /** 위 요약 카드에서 누른 줄 — 잠깐 반짝인다. */
  flashKey: string | null
  onFlashEnd: () => void
  /** 카드(캠페인만, 작은 추이 그래프) / 표(광고셋까지, 지표 칸). */
  view: FullListView
  onViewChange: (view: FullListView) => void
  /** 카드의 추이를 크게 볼 때 적을 기간. */
  periodLabel?: string
}) {
  const {
    sort,
    query,
    channelFilter,
    visibleKeys,
    showResultType,
    hasResultType,
    sortedRows,
    setChannelFilter,
    setQuery,
    chooseSort,
    toggleColumn,
    setShowResultType,
    toggleSort,
  } = useFullListTableViewModel(rows)
  // 이 표의 각 행은 캠페인/adset 하나(채널 필터와 무관하게 항상 combined
  // 값)라 오프라인/온라인/총 매출·ROAS는 항상 0이다 — 아예 뺀다.
  const listFields = channelSafeFields(METRIC_FIELDS)
  const visibleFields = listFields.filter((f) => visibleKeys.has(f.key))

  const cardSort = sort.key in CARD_SORT ? (sort.key as CardSortKey) : null

  return (
    <div className="channel-insight__full-list">
      {/* 위 줄 — 왼쪽 채널 필터, 오른쪽 이름 찾기·(카드) 정렬·보기. */}
      <div className="channel-insight__full-list-bar">
        <div
          className="channel-insight__full-list-channel-filter"
          role="group"
          aria-label="채널 필터"
        >
          <button
            type="button"
            className={`channel-insight__full-list-toggle-btn${channelFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={channelFilter === 'all'}
            onClick={() => setChannelFilter('all')}
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
              onClick={() => setChannelFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="channel-insight__full-list-tools">
          <label className="channel-insight__full-list-search">
            <Search strokeWidth={1.8} aria-hidden />
            <input
              type="search"
              value={query}
              placeholder="캠페인 · 광고셋 이름"
              aria-label="캠페인 · 광고셋 이름으로 찾기"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {view === 'card' && (
            <Segmented
              options={CARD_SORT}
              value={cardSort}
              onChange={chooseSort}
              label="정렬"
              role="buttons"
            />
          )}
          <Segmented
            options={VIEW_LABEL}
            value={view}
            onChange={onViewChange}
            label="목록 보기"
          />
        </div>
      </div>

      {view === 'card' ? (
        <CampaignCards
          rows={sortedRows}
          metricKey={sort.key === 'name' ? 'spend' : sort.key}
          selected={selected}
          onToggleSelect={onToggleSelect}
          flashKey={flashKey}
          onFlashEnd={onFlashEnd}
          emptyLabel={emptyLabel}
          periodLabel={periodLabel}
        />
      ) : (
        <>
          <div
            className="channel-insight__full-list-toggles"
            role="group"
            aria-label="컬럼 표시"
          >
            {listFields.map((f) => {
              const active = visibleKeys.has(f.key)
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
                  style={{ '--chip-color': f.color } as CSSProperties}
                  aria-pressed={active}
                  onClick={() => toggleColumn(f.key)}
                >
                  {f.label}
                </button>
              )
            })}
            {hasResultType && (
              <span className="channel-insight__full-list-toggle-item">
                <button
                  type="button"
                  className={`channel-insight__full-list-toggle-btn${showResultType ? ' is-active' : ''}`}
                  aria-pressed={showResultType}
                  onClick={() => setShowResultType((v) => !v)}
                >
                  전환 목표
                </button>
                {/* 토글 버튼 밖에 별도로 둔다 — 버튼 안에 넣으면 "?" 클릭이 토글까지
                같이 눌러버린다(SortableMetricHeader와 같은 이유). */}
                <span className="channel-insight__info" tabIndex={0}>
                  <InfoIcon />
                  <span
                    className="channel-insight__info-tooltip"
                    role="tooltip"
                  >
                    전환 목표(결과 유형)는 Meta 캠페인에만 표시됩니다 — Meta Ads
                    Manager의 "결과" 컬럼이 세는 액션 종류를 그대로 가져온
                    값으로, Google/Naver 캠페인엔 대응 개념이 없어 표시되지
                    않습니다.
                  </span>
                </span>
              </span>
            )}
          </div>

          <div className="channel-insight__table-wrap">
            <table className="channel-insight__table channel-insight__table--full-list">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="channel-insight__sort-head"
                      onClick={() => toggleSort('name')}
                    >
                      {headLabel}
                      <SortArrows active={sort.key === 'name'} dir={sort.dir} />
                    </button>
                  </th>
                  <th>Channel</th>
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
                {sortedRows.length === 0 ? (
                  <tr>
                    <td
                      className="empty-label"
                      colSpan={visibleFields.length + 2}
                    >
                      {emptyLabel}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => {
                    const open = expanded.has(row.key)
                    const children = row.children ?? []
                    return (
                      <Fragment key={row.key}>
                        <FullListTableRow
                          row={row}
                          level={0}
                          checked={selected.has(row.selectKey)}
                          onToggleSelect={onToggleSelect}
                          open={open}
                          onToggleOpen={
                            children.length > 0
                              ? () => onToggleExpanded(row.key)
                              : undefined
                          }
                          showResultType={showResultType}
                          visibleFields={visibleFields}
                          flashing={flashKey === row.selectKey}
                          onFlashEnd={onFlashEnd}
                        />
                        {open &&
                          children.map((child) => (
                            <FullListTableRow
                              key={child.key}
                              row={child}
                              level={1}
                              checked={selected.has(child.selectKey)}
                              onToggleSelect={onToggleSelect}
                              showResultType={showResultType}
                              visibleFields={visibleFields}
                              flashing={flashKey === child.selectKey}
                              onFlashEnd={onFlashEnd}
                            />
                          ))}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
