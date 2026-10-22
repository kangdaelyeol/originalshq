import '@/screens/xtool-lead-manager/styles/main.scss'
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

  return (
    <div className="xtool-main">
      <div className="wrapper">
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
          onDeleteLead={() => deleteRow(detail.id)}
          onUpdateField={updateLeadField}
          mondayMatch={mondayMatch}
          onOpenInMonday={onOpenInMonday}
        />
      )}
      {loading && !initialLoading && <Loading />}
      {createLead.state.createOpen && (
        <CreateModal state={createLead.state} actions={createLead.actions} />
      )}
      <div className="create-btn" onClick={createLead.actions.openCreateModal}>
        +
      </div>
      <ToastContainer />
    </div>
  )
}
