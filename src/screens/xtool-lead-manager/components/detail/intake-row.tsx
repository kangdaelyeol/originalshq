import {
  Device,
  type IntakeRecord,
} from '@/screens/xtool-lead-manager/entity'
import { formatTime } from '@/screens/xtool-lead-manager/utils'
import { useIntakeRowViewModel } from '@/screens/xtool-lead-manager/view-model/detail'
import { DeleteIcon, EditIcon } from './icons'
import type { DeleteRecord, IntakeUpdates, UpdateRecord } from './types'

interface IntakeRowProps {
  leadId: string
  record: IntakeRecord
  onUpdate: UpdateRecord<IntakeUpdates>
  onDelete: DeleteRecord
}

/** 접수 이력 1건 — 상담/구매 이력과 같은 클릭-편집 패턴이지만 device가
 * optional이다(지금 리드 생성 흐름엔 기기 입력이 없어 새 접수는 대부분 기기가
 * 비어 있음). 수정 모드에 들어가면 기기를 하나 고르도록(비워두는 옵션은 없음)
 * 해서 "값 없음 ↔ 값 있음"을 오가는 애매한 케이스를 피한다 — 기기를 지정하는
 * 건 지원하되, 지정한 기기를 다시 지우는 것까지는 지원하지 않는다. */
export function IntakeRow({
  leadId,
  record,
  onUpdate,
  onDelete,
}: IntakeRowProps) {
  const { state, actions } = useIntakeRowViewModel(record, (updates) =>
    onUpdate(leadId, record.id, updates),
  )
  const { editing, device, at } = state
  const { setDevice, setAt, startEdit, cancelEdit, save } = actions

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
    <div className="record_row">
      {record.device && <span className="device">{record.device}</span>}
      <span className="at">{formatTime(record.at)}</span>
      <div className="record_actions">
        <button type="button" className="icon_btn" onClick={startEdit}>
          <EditIcon />
        </button>
        <button
          type="button"
          className="icon_btn danger"
          onClick={() => {
            if (window.confirm('이 접수 기록을 삭제할까요?')) {
              onDelete(leadId, record.id)
            }
          }}
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  )
}
