import '@/screens/xtool-lead-manager/styles/main.scss'
import { useMainViewModel } from '@/screens/xtool-lead-manager/view-model'
import {
  ConfirmModal,
  Detail,
  Loading,
  Table,
} from '@/screens/xtool-lead-manager/components'

export const Main = () => {
  const { state, actions } = useMainViewModel()
  const { rows, selectedRowIndex, variant, detail, loading } = state

  const { handleCancelConfirmClick, handleConfirmClick, hideDetail } = actions

  return (
    <div className="xtool-main">
      <div className="wrapper">
        <Table state={{ ...state }} actions={{ ...actions }} type="new" />

        <div className="table_divider">
          <div className="line" />
        </div>
        <Table state={{ ...state }} actions={{ ...actions }} type="contacted" />

        <div className="table_divider">
          <div className="line" />
        </div>
        <Table state={{ ...state }} actions={{ ...actions }} type="purchased" />
      </div>
      {selectedRowIndex !== -1 && (
        <ConfirmModal
          lead={rows[selectedRowIndex]}
          variant={variant}
          onCancel={handleCancelConfirmClick}
          onConfirm={handleConfirmClick}
        />
      )}
      {detail && <Detail lead={detail} onConfirm={hideDetail} />}
      {loading && <Loading />}
    </div>
  )
}
