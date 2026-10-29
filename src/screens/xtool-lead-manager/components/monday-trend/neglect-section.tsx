import { Fragment } from 'react'
import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import type { NeglectRow, TableSort } from '@/screens/xtool-lead-manager/utils'
import { SortableTh } from './sortable-th'
import { StackedBars, Segmented, type StackSegment } from '@/components/glass'

type NeglectProps = {
  neglect: ReturnType<typeof useMondayTrendViewModel>['state']['neglect']
  onToggle: (key: string) => void
  sorts: Record<string, TableSort>
  onSort: (table: string, key: string) => void
  /** 표마다 그래프 / 표. */
  views: Record<'callback' | 'visit', NeglectView>
  onView: (kind: 'callback' | 'visit', view: NeglectView) => void
}

/** 방치 표의 칸 — 키는 NeglectRow의 필드 이름. */
const COLUMNS: { key: keyof NeglectRow; label: string }[] = [
  { key: 'assignee', label: '담당자' },
  { key: 'open', label: '진행 중' },
  { key: 'onHold', label: '보류' },
  { key: 'neglected', label: '미처리' },
  { key: 'rate', label: '미처리율' },
  { key: 'recent', label: '1~7일' },
  { key: 'month', label: '8~30일' },
  { key: 'old', label: '31일 이상' },
]

const percent = (rate: number): string => `${(rate * 100).toFixed(0)}%`

/** 펼친 담당자의 방치 기록 — 표의 펼친 줄과 그래프의 펼친 줄이 같이 쓴다. */
const NeglectItems = ({ items }: { items: NeglectRow['items'] }) => (
  <ul className="neglect_items">
    {items.map((item) => (
      <li key={item.itemId}>
        <span className="name">{item.name}</span>
        <span className="board">{item.boardName}</span>
        <span className="status">
          {[item.visitStatus, item.status].filter(Boolean).join(' · ') ||
            '상태 없음'}
        </span>
        <span className="dates">
          마지막 연락 {item.lastTouchAt ?? '-'} · 기한 {item.dueAt}
        </span>
        <span
          className={['overdue', item.overdue > 30 ? 'old' : '']
            .join(' ')
            .trim()}
        >
          {item.overdue}일 지남
        </span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">
            Monday
          </a>
        )}
      </li>
    ))}
  </ul>
)

/** 경과일 조각 — 1~7일 → 8~30일 → 31일 이상, 노랑 → 주황 → 빨강(scss .stack). */
const AGE_SEGMENTS: StackSegment[] = [
  { key: 'recent', label: '1~7일', color: 'var(--age-recent)' },
  { key: 'month', label: '8~30일', color: 'var(--age-month)' },
  { key: 'old', label: '31일 이상', color: 'var(--age-old)' },
]

export type NeglectView = 'chart' | 'table'

const VIEW_LABEL: Record<NeglectView, string> = {
  chart: '그래프',
  table: '표',
}

/** 담당자별 방치 표 하나 — 줄을 누르면 그 담당자의 방치 기록이 펼쳐진다. */
const NeglectTable = ({
  kind,
  title,
  description,
  rows,
  expanded,
  onToggle,
  sort,
  onSort,
  view = 'table',
  onView,
}: {
  kind: 'callback' | 'visit'
  title: string
  description: string
  rows: NeglectRow[]
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  sort: TableSort | undefined
  onSort: (key: string) => void
  /** 그래프(경과일 쌓은 막대) / 표 — onView가 있을 때만 고를 수 있다. */
  view?: NeglectView
  onView?: (next: NeglectView) => void
}) => {
  const total = rows.reduce(
    (sum, row) => ({
      open: sum.open + row.open,
      onHold: sum.onHold + row.onHold,
      neglected: sum.neglected + row.neglected,
      recent: sum.recent + row.recent,
      month: sum.month + row.month,
      old: sum.old + row.old,
    }),
    { open: 0, onHold: 0, neglected: 0, recent: 0, month: 0, old: 0 },
  )

  return (
    <section className="stats_card">
      <div className="kpi_head">
        <div>
          <h2>
            {title} <span className="neglect_total">{total.neglected}건</span>
          </h2>
          <p className="stats_desc">{description}</p>
        </div>
        {onView && (
          <Segmented
            options={VIEW_LABEL}
            value={view}
            onChange={onView}
            label={`${title} 보기`}
          />
        )}
      </div>

      {onView && view === 'chart' ? (
        <StackedBars
          segments={AGE_SEGMENTS}
          rows={[...rows]
            .sort((a, b) => b.neglected - a.neglected)
            .map((row) => {
              const key = `${kind}:${row.assignee}`
              return {
                key,
                label: row.assignee,
                values: { recent: row.recent, month: row.month, old: row.old },
                total: row.neglected,
                aside: (
                  <>
                    진행 중 {row.open} · <strong>{percent(row.rate)}</strong>
                    {row.old > 0 && (
                      <span className="glass_stack_badge">31일+ {row.old}</span>
                    )}
                  </>
                ),
                detail:
                  row.neglected > 0 ? (
                    <NeglectItems items={row.items} />
                  ) : undefined,
                open: expanded.has(key),
                onToggle: () => onToggle(key),
              }
            })}
          sum={{
            values: {
              recent: total.recent,
              month: total.month,
              old: total.old,
            },
            total: total.neglected,
          }}
          sumLabel="전체"
        />
      ) : (
        <div className="trend_table_scroll neglect_table_scroll">
          <table className="stats_table neglect_table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <SortableTh
                    key={column.key}
                    columnKey={column.key}
                    sort={sort}
                    onSort={onSort}
                  >
                    {column.label}
                  </SortableTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${kind}:${row.assignee}`
                const open = expanded.has(key)
                return (
                  <Fragment key={key}>
                    <tr
                      className={[
                        'neglect_row',
                        row.neglected > 0 ? 'clickable' : '',
                        open ? 'open' : '',
                      ]
                        .join(' ')
                        .trim()}
                      onClick={() => row.neglected > 0 && onToggle(key)}
                      aria-expanded={row.neglected > 0 ? open : undefined}
                    >
                      <td>
                        {row.neglected > 0 && (
                          <span className="neglect_caret" aria-hidden="true">
                            {open ? '▾' : '▸'}
                          </span>
                        )}
                        {row.assignee}
                      </td>
                      <td>{row.open}</td>
                      <td>{row.onHold}</td>
                      <td className={row.neglected > 0 ? 'neglect_count' : ''}>
                        {row.neglected}
                      </td>
                      <td>{percent(row.rate)}</td>
                      <td>{row.recent}</td>
                      <td>{row.month}</td>
                      <td className={row.old > 0 ? 'neglect_old' : ''}>
                        {row.old}
                      </td>
                    </tr>
                    {open && (
                      <tr className="neglect_detail">
                        <td colSpan={8}>
                          <NeglectItems items={row.items} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>합계</td>
                <td>{total.open}</td>
                <td>{total.onHold}</td>
                <td>{total.neglected}</td>
                <td>
                  {percent(total.open === 0 ? 0 : total.neglected / total.open)}
                </td>
                <td>{total.recent}</td>
                <td>{total.month}</td>
                <td>{total.old}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * 방치 현황 — 담당자별로, 다음 연락 기한을 넘긴 채 진행 중으로 남아 있는
 * 기록이 몇 건인지. 기간 선택과 무관한 "오늘 기준" 현황이다.
 *
 * 방치 기준(functions-xtool/src/monday/followups.ts):
 *   · 진행 중 = 상담 진행 상태가 결제·미전환·오기입이 아니고, 완료 그룹("완료",
 *     "완료된 영업")이 아닌 것. 방문체험은 체험 완료·노쇼도 뺀다.
 *   · 보류 = 보류 상태이거나 "보류" 그룹 — 방치로 세지 않고 따로 센다.
 *   · 기한 = 상담 마감일, 없으면 마지막 연락일 + 7일
 *   · 방치 = 보류가 아닌 진행 중 기록 가운데 기한이 오늘보다 지난 것
 */
const CALLBACK_DESCRIPTION = (today: string) => `
기간 선택과 무관(${today} 기준 전체 데이터). 상담 보드에서 진행 중(신규·콜백)인데다음 연락 기한(상담 마감일)을 넘긴 건. 상담 진행 상태가 미전환·결제이거나 방문체험이 확정된 건과 보류에 있는 명단 제외.
`

/** 콜백 미처리 표 하나만 — 인입통계 CS팀 섹션이 CS팀 담당자만 걸러 쓴다. */
export const CallbackNeglect = ({
  rows,
  today,
  expanded,
  onToggle,
  sort,
  onSort,
  view,
  onView,
}: {
  rows: NeglectRow[]
  today: string
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  sort: TableSort | undefined
  onSort: (key: string) => void
  view: NeglectView
  onView: (next: NeglectView) => void
}) => (
  <NeglectTable
    kind="callback"
    title="콜백 미처리"
    description={CALLBACK_DESCRIPTION(today)}
    rows={rows}
    expanded={expanded}
    onToggle={onToggle}
    sort={sort}
    onSort={onSort}
    view={view}
    onView={onView}
  />
)

export const NeglectSection = ({
  neglect,
  onToggle,
  sorts,
  onSort,
  views,
  onView,
}: NeglectProps) => (
  <>
    <NeglectTable
      kind="callback"
      title="콜백 미처리"
      description={CALLBACK_DESCRIPTION(neglect.today)}
      rows={neglect.callback}
      expanded={neglect.expanded}
      onToggle={onToggle}
      sort={sorts['neglect:callback']}
      onSort={(key) => onSort('neglect:callback', key)}
      view={views.callback}
      onView={(next) => onView('callback', next)}
    />
    <NeglectTable
      kind="visit"
      title="방문체험 고객 방치"
      description="방문체험 보드에서 상담이 진행 중인데 다음 연락 기한을 넘긴 건. 체험 완료·노쇼는 방문체험 단계가 끝난 것이라 빼고(일정 연기·체험 취소·방문 대기만 대상), 보류는 보류 칸에 따로 셉니다."
      rows={neglect.visit}
      expanded={neglect.expanded}
      onToggle={onToggle}
      sort={sorts['neglect:visit']}
      onSort={(key) => onSort('neglect:visit', key)}
      view={views.visit}
      onView={(next) => onView('visit', next)}
    />
  </>
)
