import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/lead-glass.scss'
import { useMemo, useState } from 'react'
import {
  CalendarPlus,
  Inbox,
  MessagesSquare,
  Plus,
  ShoppingBag,
} from 'lucide-react'
import { StatTile } from '@/components/glass'
import { buildLeadOverview } from '@/screens/xtool-lead-manager/utils'
import type {
  useCreateLeadViewModel,
  useLeadMondayMatchViewModel,
  useMainViewModel,
} from '@/screens/xtool-lead-manager/view-model'
import {
  ConfirmModal,
  CreateModal,
  Detail,
  Loading,
  Table,
} from '@/screens/xtool-lead-manager/components'

// Nav와 페이지네이션 상태를 공유해야 해서(둘 다 useMainViewModel 결과가
// 필요) 이 훅은 더 이상 여기서 직접 호출하지 않는다 — 부모(index.tsx)가 한
// 번만 호출해 Main·Nav 양쪽에 내려준다.
type MainProps = ReturnType<typeof useMainViewModel> & {
  /** 리드 수기 등록 모달의 상태·동작 — 별도 view-model이라 따로 받는다. */
  createLead: ReturnType<typeof useCreateLeadViewModel>
  /** 열려 있는 리드와 같은 번호의 Monday 고객 — 상세 모달의 오른쪽 패널용. */
  mondayMatch: ReturnType<typeof useLeadMondayMatchViewModel>['state']
  onOpenInMonday: (phone: string) => void
}

export const Main = ({
  state,
  actions,
  component,
  createLead,
  mondayMatch,
  onOpenInMonday,
}: MainProps) => {
  const {
    selectedRow,
    variant,
    registerForm,
    detail,
    loading,
    initialLoading,
    filteredRows,
  } = state
  const {
    handleCancelConfirmClick,
    handleConfirmClick,
    updateRegisterForm,
    toggleRegisterFormTest,
    updateRegisterFormTestCode,
    hideDetail,
    showDetail,
    updateIntakeRecord,
    deleteIntakeRecord,
    updateConsultationRecord,
    deleteConsultationRecord,
    resendConsultationRecord,
    updatePurchaseRecord,
    deletePurchaseRecord,
    resendPurchaseRecord,
    registerConsultationRow,
    registerPurchaseRow,
    deleteRow,
    updateLeadField,
  } = actions
  const { ToastContainer } = component
  // 표 위 숫자 타일 — 검색·기기 필터가 걸린 목록 기준(페이지와 무관).
  // "오늘"은 화면을 연 날 기준(자정을 넘겨 켜 두면 새로고침 때 바뀐다).
  const [openedAt] = useState(() => Date.now())
  const overview = useMemo(
    () => buildLeadOverview(filteredRows, openedAt),
    [filteredRows, openedAt],
  )
  const percent = (part: number) =>
    overview.total > 0 ? `${((part / overview.total) * 100).toFixed(1)}%` : '-'
  const count = (value: number) =>
    initialLoading ? '-' : `${value.toLocaleString('ko-KR')}명`

  return (
    <div className="xtool-main lead_main glass_theme">
      <div className="wrapper">
        <div className="stats_tiles lead_tiles">
          <StatTile
            icon={Inbox}
            label="리드"
            value={count(overview.total)}
            sub="검색·기기 필터 반영"
          />
          <StatTile
            icon={CalendarPlus}
            label="오늘 접수"
            value={count(overview.today)}
            sub="오늘 접수 기록이 있는 리드"
          />
          <StatTile
            icon={MessagesSquare}
            label="상담 진행"
            value={count(overview.consulted)}
            sub={`리드의 ${percent(overview.consulted)}`}
          />
          <StatTile
            icon={ShoppingBag}
            label="구매"
            value={count(overview.purchased)}
            sub={`전환율 ${percent(overview.purchased)}`}
          />
        </div>
        <Table state={{ ...state }} actions={{ ...actions }} />
      </div>
      {selectedRow && (
        <ConfirmModal
          lead={selectedRow}
          variant={variant}
          registerForm={registerForm}
          onUpdateRegisterForm={updateRegisterForm}
          onToggleTest={toggleRegisterFormTest}
          onUpdateTestCode={updateRegisterFormTestCode}
          onCancel={handleCancelConfirmClick}
          onConfirm={handleConfirmClick}
        />
      )}
      {detail && (
        <Detail
          lead={detail}
          leads={filteredRows}
          onSelectLead={showDetail}
          onConfirm={hideDetail}
          onUpdateIntake={updateIntakeRecord}
          onDeleteIntake={deleteIntakeRecord}
          onUpdateConsultation={updateConsultationRecord}
          onDeleteConsultation={deleteConsultationRecord}
          onResendConsultation={resendConsultationRecord}
          onUpdatePurchase={updatePurchaseRecord}
          onDeletePurchase={deletePurchaseRecord}
          onResendPurchase={resendPurchaseRecord}
          onRegisterConsultation={() => registerConsultationRow(detail.id)}
          onRegisterPurchase={() => registerPurchaseRow(detail.id)}
          onDeleteLead={(nextLeadId) => deleteRow(detail.id, nextLeadId)}
          onUpdateField={updateLeadField}
          mondayMatch={mondayMatch}
          onOpenInMonday={onOpenInMonday}
        />
      )}
      {loading && !initialLoading && <Loading />}
      {createLead.state.createOpen && (
        <CreateModal state={createLead.state} actions={createLead.actions} />
      )}
      <button
        type="button"
        className="create-btn"
        onClick={createLead.actions.openCreateModal}
      >
        <Plus strokeWidth={2.2} aria-hidden="true" />
        리드 등록
      </button>
      <ToastContainer />
    </div>
  )
}
