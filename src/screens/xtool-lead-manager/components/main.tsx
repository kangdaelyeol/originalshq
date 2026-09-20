import '@/screens/xtool-lead-manager/styles/main.scss'
import { useMainViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  ConfirmModal,
  CreateModal,
  Detail,
  Loading,
  Table,
} from '@/screens/xtool-lead-manager/components'

export const Main = () => {
  const { state, actions, component } = useMainViewModel()
  const { selectedRow, variant, registerForm, detail, loading, createOpen } =
    state
  const {
    handleCancelConfirmClick,
    handleConfirmClick,
    updateRegisterForm,
    hideDetail,
    updateConsultationRecord,
    deleteConsultationRecord,
    updatePurchaseRecord,
    deletePurchaseRecord,
    openCreateModal,
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
          onCancel={handleCancelConfirmClick}
          onConfirm={handleConfirmClick}
        />
      )}
      {detail && (
        <Detail
          lead={detail}
          onConfirm={hideDetail}
          onUpdateConsultation={updateConsultationRecord}
          onDeleteConsultation={deleteConsultationRecord}
          onUpdatePurchase={updatePurchaseRecord}
          onDeletePurchase={deletePurchaseRecord}
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
