import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday.scss'
import '@/screens/xtool-lead-manager/styles/monday-glass.scss'
import {
  CircleDollarSign,
  ShoppingBag,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { StatTile } from '@/components/glass'
import type {
  useMondayCapiViewModel,
  useMondayViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import { formatWon } from '@/screens/xtool-lead-manager/utils'
import { MondayCapiModal } from './monday-capi-modal'
import { MondayDetail } from './monday-detail'
import { MondaySideList } from './monday-side-list'
import { MondayHighlights } from './monday-highlights'
import { MondayReviewPanel } from './monday-review-panel'
import { MondayTable } from './monday-table'

type MondayMainProps = Pick<
  ReturnType<typeof useMondayViewModel>,
  'state' | 'actions'
> & {
  /** 상담·구매 기록의 CAPI 전송 확인 모달. */
  capi: ReturnType<typeof useMondayCapiViewModel>
}

/** Monday 고객 탭의 본문 — 표와, 그 위에 뜨는 두 모달(고객 상세 / 확인 필요
 * 목록). */
export const MondayMain = ({ state, actions, capi }: MondayMainProps) => {
  const {
    status,
    rows,
    filteredRows,
    detailSummary,
    detail,
    detailFailed,
    missingItems,
    paymentIssues,
    missingOpen,
    page,
    pageSize,
    highlights,
    overview,
    category,
  } = state
  const {
    openDetail,
    closeDetail,
    openMissing,
    closeMissing,
    reload,
    changeCategory,
  } = actions
  const ready = status === 'ready'
  // 확인 필요 — 자동으로 정리하지 못한 기록(monday-review-panel.tsx의 세 묶음).
  const duplicateCount = paymentIssues.filter(
    (issue) => issue.type === 'duplicate-consultation',
  ).length
  const reviewCount = missingItems.length + paymentIssues.length
  const percent = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-'

  return (
    <div className="xtool-main monday_main glass_theme">
      <div className="wrapper">
        {status === 'error' ? (
          <div className="monday_error">
            <p>Monday 고객 목록을 불러오지 못했습니다.</p>
            <button type="button" onClick={reload}>
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 고객 전체(검색·분류와 무관, 오기입 제외) 요약. */}
            <div className="stats_tiles monday_tiles">
              <StatTile
                icon={Users}
                label="전체 고객"
                value={
                  ready
                    ? `${overview.customers.toLocaleString('ko-KR')}명`
                    : '-'
                }
                sub="번호 하나 = 고객 1명 · 오기입 제외"
              />
              <StatTile
                icon={ShoppingBag}
                label="구매 고객"
                value={
                  ready ? `${overview.buyers.toLocaleString('ko-KR')}명` : '-'
                }
                sub={`전체 고객의 ${percent(overview.buyers, overview.customers)}`}
                onGo={
                  category === 'purchase'
                    ? undefined
                    : () => changeCategory('purchase')
                }
                linkLabel="구매 고객만 보기"
              />
              <StatTile
                icon={CircleDollarSign}
                label="이번 달 구매 금액"
                value={ready ? formatWon(overview.monthAmount) : '-'}
                sub={`${overview.monthBuyers.toLocaleString('ko-KR')}명 · 결제일 기준`}
              />
              <StatTile
                icon={Wallet}
                label="남은 잔금"
                value={ready ? formatWon(overview.balanceAmount) : '-'}
                warn={overview.balanceAmount > 0}
                sub={`${overview.balanceCustomers.toLocaleString('ko-KR')}명`}
                onGo={
                  category === 'balance'
                    ? undefined
                    : () => changeCategory('balance')
                }
                linkLabel="잔금 있는 고객만 보기"
              />
              <StatTile
                icon={TriangleAlert}
                label="확인 필요"
                value={ready ? `${reviewCount.toLocaleString('ko-KR')}건` : '-'}
                warn={ready && reviewCount > 0}
                sub={`결제 ${paymentIssues.length - duplicateCount} · 중복 ${duplicateCount} · 번호 ${missingItems.length}`}
                onGo={reviewCount > 0 ? openMissing : undefined}
                linkLabel="확인 필요 목록 열기"
              />
            </div>
            <MondayTable
              rows={rows}
              startIndex={(page - 1) * pageSize}
              loading={status === 'idle' || status === 'loading'}
              onOpen={openDetail}
            />
            {status === 'ready' && (
              <MondayHighlights highlights={highlights} onOpen={openDetail} />
            )}
          </>
        )}
      </div>
      {detailSummary && (
        <MondayDetail
          summary={detailSummary}
          customer={detail}
          failed={detailFailed}
          onClose={closeDetail}
          onSendCapi={(source) => detail && capi.actions.open(detail, source)}
          sideList={
            <MondaySideList
              customers={filteredRows}
              activePhone={detailSummary.phone}
              onSelect={openDetail}
              keysEnabled={!capi.state.source}
            />
          }
        />
      )}
      {capi.state.source && <MondayCapiModal capi={capi} />}
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
