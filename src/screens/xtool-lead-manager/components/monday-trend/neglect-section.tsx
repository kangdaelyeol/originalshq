import { Fragment } from 'react'
import type { useMondayTrendViewModel } from '@/screens/xtool-lead-manager/view-model'
import type { NeglectRow, TableSort } from '@/screens/xtool-lead-manager/utils'
import { SortableTh } from './sortable-th'

type NeglectProps = {
  neglect: ReturnType<typeof useMondayTrendViewModel>['state']['neglect']
  onToggle: (key: string) => void
  sorts: Record<string, TableSort>
  onSort: (table: string, key: string) => void
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
}: {
  kind: 'callback' | 'visit'
  title: string
  description: string
  rows: NeglectRow[]
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  sort: TableSort | undefined
  onSort: (key: string) => void
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
      <h2>
        {title} <span className="neglect_total">{total.neglected}건</span>
      </h2>
      <p className="stats_desc">{description}</p>

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
                        <ul>
                          {row.items.map((item) => (
                            <li key={item.itemId}>
                              <span className="name">{item.name}</span>
                              <span className="board">{item.boardName}</span>
                              <span className="status">
                                {[item.visitStatus, item.status]
                                  .filter(Boolean)
                                  .join(' · ') || '상태 없음'}
                              </span>
                              <span className="dates">
                                마지막 연락 {item.lastTouchAt ?? '-'} · 기한{' '}
                                {item.dueAt}
                              </span>
                              <span
                                className={[
                                  'overdue',
                                  item.overdue > 30 ? 'old' : '',
                                ]
                                  .join(' ')
                                  .trim()}
                              >
                                {item.overdue}일 지남
                              </span>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Monday
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
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
}: {
  rows: NeglectRow[]
  today: string
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  sort: TableSort | undefined
  onSort: (key: string) => void
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
  />
)

export const NeglectSection = ({
  neglect,
  onToggle,
  sorts,
  onSort,
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
    />
  </>
)
