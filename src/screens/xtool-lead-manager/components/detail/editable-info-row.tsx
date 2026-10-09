import { useState } from 'react'
import { EditingField } from '@/screens/xtool-lead-manager/types'
import { useInlineEditViewModel } from '@/screens/xtool-lead-manager/view-model/detail'
import type { UpdateLeadField } from './types'

/** 클릭하면 그 자리에서 바로 고치는 정보 행 — 표의 인라인 편집을 대신해
 * 상세 모달로 옮긴 자리다. rawValue는 편집 입력에 넣을 원본 값(예: 전화번호는
 * 숫자만, 접수 시각은 datetime-local 문자열), displayValue는 평소에 보여줄
 * 포맷된 값이다. */
export function EditableInfoRow({
  label,
  field,
  leadId,
  rawValue,
  displayValue,
  mono = false,
  inputType = 'text',
  onSave,
}: {
  label: string
  field: EditingField
  leadId: string
  rawValue: string
  displayValue: string
  mono?: boolean
  inputType?: 'text' | 'datetime-local'
  onSave: UpdateLeadField
}) {
  const { state, actions } = useInlineEditViewModel(rawValue, (value) =>
    onSave(leadId, field, value),
  )
  const { editing, draft } = state
  const { setDraft, start, cancel, save } = actions

  if (editing) {
    return (
      <div className="info_row editing">
        <span className="label">{label}</span>
        <div className="edit_control">
          <input
            autoFocus
            type={inputType}
            className={['control', mono ? 'mono' : ''].join(' ')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
            }}
          />
          <button type="button" className="save_btn" onClick={save}>
            저장
          </button>
          <button type="button" className="cancel_btn" onClick={cancel}>
            취소
          </button>
        </div>
      </div>
    )
  }

  const isEmpty = !displayValue || displayValue === '-'
  return (
    <div className="info_row editable" onClick={start}>
      <span className="label">{label}</span>
      <span
        className={['value', mono ? 'mono' : '', isEmpty ? 'empty' : ''].join(
          ' ',
        )}
      >
        {isEmpty ? '값 없음' : displayValue}
      </span>
    </div>
  )
}

/** User Agent 전용 편집 행 — 값이 길어서 EditableInfoRow의 한 줄(label+value)
 * 레이아웃 대신 세로로 쌓고(column), 평소엔 한 줄로 잘라 보여주다가 "전체
 * 보기"로 펼칠 수 있게 한 기존 동작은 그대로 두면서 편집만 추가한다. */
export function EditableUserAgentRow({
  leadId,
  rawValue,
  onSave,
}: {
  leadId: string
  rawValue: string
  onSave: UpdateLeadField
}) {
  const { state, actions } = useInlineEditViewModel(rawValue, (value) =>
    onSave(leadId, EditingField.USER_AGENT, value),
  )
  const { editing, draft } = state
  const { setDraft, start, cancel, save } = actions
  // 긴 값을 한 줄로 잘라 보여줄지/전부 펼칠지 — 편집과 무관한 표시 상태라
  // 이 컴포넌트에 그대로 둔다.
  const [expanded, setExpanded] = useState(false)

  if (editing) {
    return (
      <div className="info_row column editing">
        <span className="label">User Agent</span>
        <div className="edit_control column">
          <textarea
            autoFocus
            className="control"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
            }}
          />
          <div className="edit_actions">
            <button type="button" className="save_btn" onClick={save}>
              저장
            </button>
            <button type="button" className="cancel_btn" onClick={cancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isEmpty = !rawValue
  return (
    <div className="info_row column">
      <div className="row_head">
        <span className="label">User Agent</span>
        <div className="row_head_actions">
          {!isEmpty && (
            <button
              type="button"
              className="expand_btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '접기' : '전체 보기'}
            </button>
          )}
          <button type="button" className="expand_btn" onClick={start}>
            수정
          </button>
        </div>
      </div>
      <span
        className={[
          'value mono ua',
          expanded ? 'expanded' : '',
          isEmpty ? 'empty' : '',
        ].join(' ')}
      >
        {isEmpty ? '값 없음' : rawValue}
      </span>
    </div>
  )
}
