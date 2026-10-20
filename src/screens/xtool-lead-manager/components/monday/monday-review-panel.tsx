import type {
  MondayMissingPhoneItem,
  MondayPaymentIssueItem,
} from '@/screens/xtool-lead-manager/entity'
import {
  formatMondayDate,
  formatMondayPhone,
} from '@/screens/xtool-lead-manager/utils'
import { CloseIcon } from '../detail/icons'
import '@/screens/xtool-lead-manager/styles/detail.scss'

const MondayLink = ({ url }: { url: string | null }) =>
  url ? (
    <a className="monday_link" href={url} target="_blank" rel="noreferrer">
      열기
    </a>
  ) : null

/**
 * 확인 필요 — 자동으로 정리하지 못해 사람이 Monday에서 봐야 하는 기록들.
 *
 *   · 결제 확인: 계약 건을 못 찾는 납부, 품목이 없어 금액을 모르는 결제 건,
 *     부호가 이상한 계약금/분할납부 줄 등. 고객 목록에는 들어가 있지만 금액이
 *     틀릴 수 있다.
 *   · 번호 확인: 전화번호가 비었거나 형식이 맞지 않아 어느 고객에도 묶이지
 *     못한 기록. 고객 목록에서 아예 빠져 있다.
 *
 * 여기서는 고칠 수 없고, 각 줄의 링크로 Monday에 가서 고치면 다음 동기화 때
 * 반영된다.
 */
export const MondayReviewPanel = ({
  missingItems,
  paymentIssues,
  onOpenCustomer,
  onClose,
}: {
  missingItems: MondayMissingPhoneItem[]
  paymentIssues: MondayPaymentIssueItem[]
  onOpenCustomer: (phone: string) => void
  onClose: () => void
}) => {
  // 보드별로 모아서 보여준다 — 고치는 사람은 보드 단위로 작업한다.
  const sortedMissing = [...missingItems].sort(
    (a, b) =>
      a.boardName.localeCompare(b.boardName) || a.name.localeCompare(b.name),
  )
  const sortedIssues = [...paymentIssues].sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      (b.date ?? '').localeCompare(a.date ?? ''),
  )

  return (
    <div className="lead_manager_detail_modal" onClick={onClose}>
      <div
        className="detail_form monday_detail monday_review"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header">
          <div className="header_title">
            <span className="customer_name">확인 필요</span>
            <span className="monday_phone">
              {missingItems.length + paymentIssues.length}건
            </span>
          </div>
          <button className="close_btn" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="body">
          <p className="monday_detail_message">
            자동으로 정리하지 못한 기록입니다. Monday에서 고치면 다음
            동기화(매일 09·11·13·15·17·22시) 때 반영됩니다.
          </p>

          {sortedIssues.length > 0 && (
            <section className="section">
              <h3 className="section_title">
                결제 확인{' '}
                <span className="monday_section_count">
                  {sortedIssues.length}
                </span>
              </h3>
              <table className="monday_review_table">
                <thead>
                  <tr>
                    <th>고객</th>
                    <th>날짜</th>
                    <th>내용</th>
                    <th aria-label="Monday 링크" />
                  </tr>
                </thead>
                <tbody>
                  {sortedIssues.map((issue) => (
                    <tr key={`${issue.itemId}-${issue.type}`}>
                      <td>
                        <button
                          type="button"
                          className="monday_customer_btn"
                          onClick={() => onOpenCustomer(issue.phone)}
                        >
                          {issue.customerName ?? issue.name ?? '이름 없음'}
                        </button>
                        <span className="sub">
                          {formatMondayPhone(issue.phone)}
                        </span>
                      </td>
                      <td className="nowrap">{formatMondayDate(issue.date)}</td>
                      <td>{issue.message}</td>
                      <td className="nowrap">
                        <MondayLink url={issue.url} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {sortedMissing.length > 0 && (
            <section className="section">
              <h3 className="section_title">
                번호 확인{' '}
                <span className="monday_section_count">
                  {sortedMissing.length}
                </span>
              </h3>
              <table className="monday_review_table">
                <thead>
                  <tr>
                    <th>보드</th>
                    <th>이름</th>
                    <th>적힌 값</th>
                    <th>최근 수정</th>
                    <th aria-label="Monday 링크" />
                  </tr>
                </thead>
                <tbody>
                  {sortedMissing.map((item) => (
                    <tr key={item.id}>
                      <td>{item.boardName}</td>
                      <td>{item.name || '-'}</td>
                      <td className="raw">{item.phoneRaw || '(비어 있음)'}</td>
                      <td className="nowrap">
                        {formatMondayDate(item.updatedAt)}
                      </td>
                      <td className="nowrap">
                        <MondayLink url={item.url} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
