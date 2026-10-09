import {
  Device,
  type ConsultationRecord,
} from '@/screens/xtool-lead-manager/entity'
import { formatTime } from '@/screens/xtool-lead-manager/utils'
import { useConsultationRowViewModel } from '@/screens/xtool-lead-manager/view-model/detail'
import { DeleteIcon, EditIcon, ResendIcon } from './icons'
import { ResendPanel } from './resend-panel'
import type {
  ConsultationUpdates,
  DeleteRecord,
  ResendRecord,
  UpdateRecord,
} from './types'

interface ConsultationRowProps {
  leadId: string
  record: ConsultationRecord
  onUpdate: UpdateRecord<ConsultationUpdates>
  onDelete: DeleteRecord
  onResend: ResendRecord
}

export function ConsultationRow({
  leadId,
  record,
  onUpdate,
  onDelete,
  onResend,
}: ConsultationRowProps) {
  const { state, actions } = useConsultationRowViewModel(record, (updates) =>
    onUpdate(leadId, record.id, updates),
  )
  const { editing, device, at, note, resendOpen } = state
  const {
    setDevice,
    setAt,
    setNote,
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
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
        <input
          className="control note_control"
          placeholder="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
              if (window.confirm('이 상담 기록을 삭제할까요?')) {
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
      {record.note && <div className="record_note">{record.note}</div>}
      {/* CAPI로 마지막에 실제 보낸 값의 스냅샷 — 이벤트 매니저에서 이
          상담 건이 어느 이벤트로 잡혔는지 대조해볼 때 쓴다. 둘 다 없으면
          (마이그레이션 전 레코드) 아예 안 보여준다. */}
      {(record.eventId || record.externalId) && (
        <div className="record_meta">
          {record.eventId && <span>event_id: {record.eventId}</span>}
          {record.externalId && <span>external_id: {record.externalId}</span>}
        </div>
      )}
    </div>
  )
}
