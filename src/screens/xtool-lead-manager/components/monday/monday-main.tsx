import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday.scss'
import type { useMondayViewModel } from '@/screens/xtool-lead-manager/view-model'
import { MondayDetail } from './monday-detail'
import { MondayReviewPanel } from './monday-review-panel'
import { MondayTable } from './monday-table'

type MondayMainProps = Pick<
  ReturnType<typeof useMondayViewModel>,
  'state' | 'actions'
>

/** Monday 고객 탭의 본문 — 표와, 그 위에 뜨는 두 모달(고객 상세 / 확인 필요
 * 목록). */
export const MondayMain = ({ state, actions }: MondayMainProps) => {
  const {
    status,
    rows,
    detailSummary,
    detail,
    detailFailed,
    missingItems,
    paymentIssues,
    missingOpen,
    page,
    pageSize,
  } = state
  const { openDetail, closeDetail, closeMissing, reload } = actions

  return (
    <div className="xtool-main">
      <div className="wrapper">
        {status === 'error' ? (
          <div className="monday_error">
            <p>Monday 고객 목록을 불러오지 못했습니다.</p>
            <button type="button" onClick={reload}>
              다시 시도
            </button>
          </div>
        ) : (
          <MondayTable
            rows={rows}
            startIndex={(page - 1) * pageSize}
            loading={status === 'idle' || status === 'loading'}
            onOpen={openDetail}
          />
        )}
      </div>
      {detailSummary && (
        <MondayDetail
          summary={detailSummary}
          customer={detail}
          failed={detailFailed}
          onClose={closeDetail}
        />
      )}
      {missingOpen && (
        <MondayReviewPanel
          missingItems={missingItems}
          paymentIssues={paymentIssues}
          onOpenCustomer={(phone) => {
            closeMissing()
            openDetail(phone)
          }}
          onClose={closeMissing}
        />
      )}
    </div>
  )
}
