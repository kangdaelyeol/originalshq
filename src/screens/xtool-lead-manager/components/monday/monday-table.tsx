import { memo } from 'react'
import type { MondayCustomerListItem } from '@/screens/xtool-lead-manager/entity'
import {
  formatMondayDate,
  formatMondayPhone,
  mondayStatusTone,
} from '@/screens/xtool-lead-manager/utils'

interface MondayRowProps {
  customer: MondayCustomerListItem
  onOpen: (phone: string) => void
}

/** 건수와 최근 날짜를 두 줄로 — 리드 표의 status_stack과 같은 모양. */
const CountCell = ({ count, latest }: { count: number; latest: string | null }) =>
  count > 0 ? (
    <div className="status_stack">
      <span className="count">{count}건</span>
      <span className="latest">{formatMondayDate(latest)}</span>
    </div>
  ) : (
    <span className="monday_empty">-</span>
  )

const MondayRow = memo(function MondayRow({ customer, onOpen }: MondayRowProps) {
  const { summary, names } = customer
  const etcCount = summary.surveyCount + summary.sampleTestCount

  return (
    <tr className="row-clickable" onClick={() => onOpen(customer.phone)}>
      <td className="col-ph">
        <span>{formatMondayPhone(customer.phone)}</span>
      </td>

      {/* 이름 — 보드마다 다르게 적힌 이름이 있으면 대표 이름 옆에 "+n". */}
      <td className="col-monday-name" title={names.join('\n') || undefined}>
        <span>{names[0] ?? '이름 없음'}</span>
        {names.length > 1 && (
          <span className="monday_more">+{names.length - 1}</span>
        )}
      </td>

      <td className="col-monday-status">
        {summary.latestConsultationStatus ? (
          <span
            className={`monday_badge ${mondayStatusTone(summary.latestConsultationStatus)}`}
          >
            {summary.latestConsultationStatus}
          </span>
        ) : (
          <span className="monday_empty">-</span>
        )}
      </td>

      <td className="col-monday-count">
        <CountCell
          count={summary.consultationCount}
          latest={summary.latestConsultationAt}
        />
      </td>
      <td className="col-monday-count">
        <CountCell count={summary.visitCount} latest={summary.latestVisitAt} />
      </td>
      <td className="col-monday-count">
        <CountCell
          count={summary.purchaseCount}
          latest={summary.latestPurchaseAt}
        />
      </td>

      {/* 설문·샘플테스트는 드물어서 한 칸에 모은다. */}
      <td
        className="col-monday-etc"
        title={
          etcCount > 0
            ? `만족도 조사 ${summary.surveyCount}건 · 샘플테스트 ${summary.sampleTestCount}건`
            : undefined
        }
      >
        <span className={etcCount > 0 ? '' : 'monday_empty'}>
          {etcCount > 0 ? `${etcCount}건` : '-'}
        </span>
      </td>

      <td
        className="col-monday-assignee"
        title={summary.assignees.join(', ') || undefined}
      >
        <span>{summary.assignees.join(', ') || '-'}</span>
      </td>

      <td
        className="col-monday-boards"
        title={summary.boardNames.join('\n') || undefined}
      >
        <span>{summary.boardNames.length}개</span>
      </td>

      <td className="col-monday-updated">
        <span>{formatMondayDate(customer.lastUpdatedAt)}</span>
      </td>
    </tr>
  )
})

/** Monday 통합 고객 표 — 한 줄이 번호 하나(고객 1명)다. 줄을 누르면 그
 * 고객의 전체 기록(상세 모달)이 열린다. */
export const MondayTable = ({
  rows,
  onOpen,
}: {
  rows: MondayCustomerListItem[]
  onOpen: (phone: string) => void
}) => {
  return (
    <div className="table_container">
      <div className="table">
        <div className="table_scroll">
          <table className="lead_table monday_table">
            <thead>
              <tr>
                <th className="col-ph">전화번호</th>
                <th className="col-monday-name">이름</th>
                <th className="col-monday-status">최근 상담 상태</th>
                <th className="col-monday-count">상담</th>
                <th className="col-monday-count">방문체험</th>
                <th className="col-monday-count">구매</th>
                <th className="col-monday-etc">설문·샘플</th>
                <th className="col-monday-assignee">담당자</th>
                <th className="col-monday-boards">보드</th>
                <th className="col-monday-updated">최근 수정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <MondayRow
                  key={customer.phone}
                  customer={customer}
                  onOpen={onOpen}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="monday_no_rows" colSpan={10}>
                    조건에 맞는 고객이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
