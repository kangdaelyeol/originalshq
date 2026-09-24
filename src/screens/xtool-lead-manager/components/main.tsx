import '@/screens/xtool-lead-manager/styles/main.scss'
import { useMainViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  ConfirmModal,
  ConsultationSummary,
  CreateModal,
  Detail,
  Loading,
  Table,
} from '@/screens/xtool-lead-manager/components'

export const Main = () => {
  const { state, actions, component } = useMainViewModel()
  const {
    selectedRow,
    variant,
    registerForm,
    detail,
    loading,
    createOpen,
    allRows,
  } = state
  const {
    handleCancelConfirmClick,
    handleConfirmClick,
    updateRegisterForm,
    toggleRegisterFormTest,
    updateRegisterFormTestCode,
    hideDetail,
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
    openCreateModal,
  } = actions
  const { ToastContainer } = component

  return (
    <div className="xtool-main">
      <div className="wrapper">
        <Table state={{ ...state }} actions={{ ...actions }} />
        <ConsultationSummary leads={allRows} />
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
        />
      )}
      {loading && <Loading />}
      {createOpen && (
        <CreateModal state={{ ...state }} actions={{ ...actions }} />
      )}
      <div className="create-btn" onClick={openCreateModal}>
        +
      </div>
      <ToastContainer />
    </div>
  )
}
