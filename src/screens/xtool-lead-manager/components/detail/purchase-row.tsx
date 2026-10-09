import {
  Device,
  type PurchaseRecord,
} from '@/screens/xtool-lead-manager/entity'
import { formatTime } from '@/screens/xtool-lead-manager/utils'
import { usePurchaseRowViewModel } from '@/screens/xtool-lead-manager/view-model/detail'
import { DeleteIcon, EditIcon, ResendIcon } from './icons'
import { ResendPanel } from './resend-panel'
import type {
  DeleteRecord,
  PurchaseUpdates,
  ResendRecord,
  UpdateRecord,
} from './types'

interface PurchaseRowProps {
  leadId: string
  record: PurchaseRecord
  onUpdate: UpdateRecord<PurchaseUpdates>
  onDelete: DeleteRecord
  onResend: ResendRecord
}

export function PurchaseRow({
  leadId,
  record,
  onUpdate,
  onDelete,
  onResend,
}: PurchaseRowProps) {
  const { state, actions } = usePurchaseRowViewModel(record, (updates) =>
    onUpdate(leadId, record.id, updates),
  )
  const { editing, device, at, price, resendOpen } = state
  const {
    setDevice,
    setAt,
    setPrice,
    startEdit,
    cancelEdit,
    toggleResend,
    closeResend,
    save,
  } = actions

  if (editing) {
    return (
      <div className="record_row editing">
        <select
          className="control"
          value={device}
          onChange={(e) => setDevice(e.target.value as Device)}
        >
          {Object.values(Device).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          className="control"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          className="control"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
        <div className="record_actions">
          <button type="button" className="save_btn" onClick={save}>
            저장
          </button>
          <button type="button" className="cancel_btn" onClick={cancelEdit}>
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="record_row_wrap">
      <div className="record_row">
        <span className="device">{record.device}</span>
        <span className="price">{record.price.toLocaleString('ko-KR')}원</span>
        <span className="at">{formatTime(record.at)}</span>
        <div className="record_actions">
          <button
            type="button"
            className="icon_btn"
            title="Meta CAPI 이벤트 다시 보내기"
            onClick={toggleResend}
          >
            <ResendIcon />
          </button>
          <button type="button" className="icon_btn" onClick={startEdit}>
            <EditIcon />
          </button>
          <button
            type="button"
            className="icon_btn danger"
            onClick={() => {
              if (window.confirm('이 구매 기록을 삭제할까요?')) {
                onDelete(leadId, record.id)
              }
            }}
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
      {resendOpen && (
        <ResendPanel
          onResend={(testEventCode) =>
            onResend(leadId, record.id, testEventCode)
          }
          onClose={closeResend}
        />
      )}
      {/* ConsultationRow와 같은 이유 — CAPI로 실제 보낸 값의 스냅샷. */}
      {(record.eventId || record.externalId) && (
        <div className="record_meta">
          {record.eventId && <span>event_id: {record.eventId}</span>}
          {record.externalId && <span>external_id: {record.externalId}</span>}
        </div>
      )}
    </div>
  )
}
