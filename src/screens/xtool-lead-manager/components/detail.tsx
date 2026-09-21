import { useEffect, useState } from 'react'
import {
  Device,
  getLeadState,
  type ConsultationRecord,
  type IntakeRecord,
  type Lead,
  type LeadState,
  type PurchaseRecord,
} from '@/screens/xtool-lead-manager/entity'
import { EditingField } from '@/screens/xtool-lead-manager/types'
import {
  formatPhoneNumber,
  formatTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/screens/xtool-lead-manager/utils'
import '@/screens/xtool-lead-manager/styles/detail.scss'

const STATE_LABEL: Record<LeadState, string> = {
  new: '신규 유입',
  contacted: '상담 완료',
  purchased: '구매 완료',
}

const UTM_LABEL: Record<string, string> = {
  utm_source: '유입 채널',
  utm_medium: '매체',
  utm_campaign: '캠페인',
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const isEmpty = !value || value === '-'
  return (
    <div className="info_row">
      <span className="label">{label}</span>
      <span
        className={['value', mono ? 'mono' : '', isEmpty ? 'empty' : ''].join(
          ' ',
        )}
      >
        {isEmpty ? '값 없음' : value}
      </span>
    </div>
  )
}

/** 클릭하면 그 자리에서 바로 고치는 정보 행 — 표의 인라인 편집을 대신해
 * 상세 모달로 옮긴 자리다. rawValue는 편집 입력에 넣을 원본 값(예: 전화번호는
 * 숫자만, 접수 시각은 datetime-local 문자열), displayValue는 평소에 보여줄
 * 포맷된 값이다. */
function EditableInfoRow({
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
  onSave: (leadId: string, field: EditingField, value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawValue)

  if (editing) {
    return (
      <div className="info_row editing">
        <span className="label">{label}</span>
        <div className="edit_control">
          <input
            autoFocus
            type={inputType}
            className="control"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <button
            type="button"
            className="save_btn"
            onClick={async () => {
              await onSave(leadId, field, draft)
              setEditing(false)
            }}
          >
            저장
          </button>
          <button
            type="button"
            className="cancel_btn"
            onClick={() => setEditing(false)}
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  const isEmpty = !displayValue || displayValue === '-'
  return (
    <div
      className="info_row editable"
      onClick={() => {
        setDraft(rawValue)
        setEditing(true)
      }}
    >
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

const DeleteIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M4 6h12M8 6V4.5A1 1 0 0 1 9 3.5h2a1 1 0 0 1 1 1V6M5.5 6l.6 9.6a1.5 1.5 0 0 0 1.5 1.4h4.8a1.5 1.5 0 0 0 1.5-1.4l.6-9.6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <path
      d="M13.5 3.5l3 3L6 17l-3.5.5.5-3.5L13.5 3.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface IntakeRowProps {
  leadId: string
  record: IntakeRecord
  onUpdate: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => Promise<void>
  onDelete: (leadId: string, recordId: string) => Promise<void>
}

/** 접수 이력 1건 — 상담/구매 이력과 같은 클릭-편집 패턴이지만 device가
 * optional이다(지금 리드 생성 흐름엔 기기 입력이 없어 새 접수는 대부분 기기가
 * 비어 있음). 수정 모드에 들어가면 기기를 하나 고르도록(비워두는 옵션은 없음)
 * 해서 "값 없음 ↔ 값 있음"을 오가는 애매한 케이스를 피한다 — 기기를 지정하는
 * 건 지원하되, 지정한 기기를 다시 지우는 것까지는 지원하지 않는다. */
function IntakeRow({ leadId, record, onUpdate, onDelete }: IntakeRowProps) {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(
    record.device ?? Device.F2_ULTRA,
  )
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))

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
          <button
            type="button"
            className="save_btn"
            onClick={async () => {
              await onUpdate(leadId, record.id, {
                device,
                at: fromDatetimeLocalValue(at),
              })
              setEditing(false)
            }}
          >
            저장
          </button>
          <button
            type="button"
            className="cancel_btn"
            onClick={() => setEditing(false)}
          >
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
        <button
          type="button"
          className="icon_btn"
          onClick={() => setEditing(true)}
        >
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

interface ConsultationRowProps {
  leadId: string
  record: ConsultationRecord
  onUpdate: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => Promise<void>
  onDelete: (leadId: string, recordId: string) => Promise<void>
}

function ConsultationRow({
  leadId,
  record,
  onUpdate,
  onDelete,
}: ConsultationRowProps) {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(record.device)
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))

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
          <button
            type="button"
            className="save_btn"
            onClick={async () => {
              await onUpdate(leadId, record.id, {
                device,
                at: fromDatetimeLocalValue(at),
              })
              setEditing(false)
            }}
          >
            저장
          </button>
          <button
            type="button"
            className="cancel_btn"
            onClick={() => setEditing(false)}
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="record_row">
      <span className="device">{record.device}</span>
      <span className="at">{formatTime(record.at)}</span>
      <div className="record_actions">
        <button
          type="button"
          className="icon_btn"
          onClick={() => setEditing(true)}
        >
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
  )
}

interface PurchaseRowProps {
  leadId: string
  record: PurchaseRecord
  onUpdate: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device; price?: number },
  ) => Promise<void>
  onDelete: (leadId: string, recordId: string) => Promise<void>
}

function PurchaseRow({ leadId, record, onUpdate, onDelete }: PurchaseRowProps) {
  const [editing, setEditing] = useState(false)
  const [device, setDevice] = useState<Device>(record.device)
  const [at, setAt] = useState(toDatetimeLocalValue(record.at))
  const [price, setPrice] = useState(String(record.price))

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
          <button
            type="button"
            className="save_btn"
            onClick={async () => {
              const numericPrice = Number(price)
              if (Number.isNaN(numericPrice) || numericPrice <= 0) return
              await onUpdate(leadId, record.id, {
                device,
                at: fromDatetimeLocalValue(at),
                price: numericPrice,
              })
              setEditing(false)
            }}
          >
            저장
          </button>
          <button
            type="button"
            className="cancel_btn"
            onClick={() => setEditing(false)}
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="record_row">
      <span className="device">{record.device}</span>
      <span className="price">{record.price.toLocaleString('ko-KR')}원</span>
      <span className="at">{formatTime(record.at)}</span>
      <div className="record_actions">
        <button
          type="button"
          className="icon_btn"
          onClick={() => setEditing(true)}
        >
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
  )
}

export const Detail = ({
  lead,
  onConfirm,
  onUpdateIntake,
  onDeleteIntake,
  onUpdateConsultation,
  onDeleteConsultation,
  onUpdatePurchase,
  onDeletePurchase,
  onRegisterConsultation,
  onRegisterPurchase,
  onDeleteLead,
  onUpdateField,
}: {
  lead: Lead
  onConfirm: () => void
  onUpdateIntake: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => Promise<void>
  onDeleteIntake: (leadId: string, recordId: string) => Promise<void>
  onUpdateConsultation: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => Promise<void>
  onDeleteConsultation: (leadId: string, recordId: string) => Promise<void>
  onUpdatePurchase: (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device; price?: number },
  ) => Promise<void>
  onDeletePurchase: (leadId: string, recordId: string) => Promise<void>
  onRegisterConsultation: () => void
  onRegisterPurchase: () => void
  onDeleteLead: () => void
  onUpdateField: (
    leadId: string,
    field: EditingField,
    value: string,
  ) => Promise<void>
}) => {
  const state = getLeadState(lead)
  const [uaExpanded, setUaExpanded] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onConfirm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm])

  // 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수 있어 방어적으로
  // 기본값을 둔다.
  const sortedIntakes = [...(lead.intakes ?? [])].sort((a, b) => b.at - a.at)
  const sortedConsultations = [...(lead.consultations ?? [])].sort(
    (a, b) => b.at - a.at,
  )
  const sortedPurchases = [...(lead.purchases ?? [])].sort(
    (a, b) => b.at - a.at,
  )

  return (
    <div className="lead_manager_detail_modal" onClick={onConfirm}>
      <div className="detail_form" onClick={(e) => e.stopPropagation()}>
        <div className="header">
          <div className="header_title">
            <span className={['state_badge', state].join(' ')}>
              {STATE_LABEL[state]}
            </span>
            <span className="customer_name">{lead.fn || '이름 없음'}</span>
          </div>
          <button type="button" className="close_btn" onClick={onConfirm}>
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="body">
          <section className="section">
            <div className="section_title">기본 정보</div>
            <EditableInfoRow
              label="고객명"
              field={EditingField.FIRST_NAME}
              leadId={lead.id}
              rawValue={lead.fn}
              displayValue={lead.fn}
              onSave={onUpdateField}
            />
            <EditableInfoRow
              label="전화번호"
              field={EditingField.PHONE}
              leadId={lead.id}
              rawValue={lead.ph}
              displayValue={formatPhoneNumber(lead.ph)}
              mono
              onSave={onUpdateField}
            />
          </section>

          <section className="section">
            <div className="section_title">비고</div>
            <EditableInfoRow
              label="메모"
              field={EditingField.REMARKS}
              leadId={lead.id}
              rawValue={lead.remarks}
              displayValue={lead.remarks}
              onSave={onUpdateField}
            />
          </section>

          <section className="section">
            <div className="section_title">
              접수 이력 ({sortedIntakes.length})
            </div>
            {sortedIntakes.length > 0 ? (
              <div className="record_list">
                {sortedIntakes.map((record) => (
                  <IntakeRow
                    key={record.id}
                    leadId={lead.id}
                    record={record}
                    onUpdate={onUpdateIntake}
                    onDelete={onDeleteIntake}
                  />
                ))}
              </div>
            ) : (
              <div className="empty_state">접수 이력이 없습니다</div>
            )}
          </section>

          <section className="section">
            <div className="section_title">
              상담 이력 ({sortedConsultations.length})
            </div>
            {sortedConsultations.length > 0 ? (
              <div className="record_list">
                {sortedConsultations.map((record) => (
                  <ConsultationRow
                    key={record.id}
                    leadId={lead.id}
                    record={record}
                    onUpdate={onUpdateConsultation}
                    onDelete={onDeleteConsultation}
                  />
                ))}
              </div>
            ) : (
              <div className="empty_state">상담 이력이 없습니다</div>
            )}
          </section>

          <section className="section">
            <div className="section_title">
              구매 이력 ({sortedPurchases.length})
            </div>
            {sortedPurchases.length > 0 ? (
              <div className="record_list">
                {sortedPurchases.map((record) => (
                  <PurchaseRow
                    key={record.id}
                    leadId={lead.id}
                    record={record}
                    onUpdate={onUpdatePurchase}
                    onDelete={onDeletePurchase}
                  />
                ))}
              </div>
            ) : (
              <div className="empty_state">구매 이력이 없습니다</div>
            )}
          </section>

          <section className="section">
            <div className="section_title">유입 경로</div>
            <InfoRow label={UTM_LABEL.utm_source} value={lead.utm_source} />
            <InfoRow label={UTM_LABEL.utm_medium} value={lead.utm_medium} />
            <InfoRow label={UTM_LABEL.utm_campaign} value={lead.utm_campaign} />
          </section>

          <section className="section">
            <div className="section_title">추적 정보</div>
            <InfoRow label="IP 주소" value={lead.ip} mono />
            <InfoRow label="FBC" value={lead.fbc} mono />
            <InfoRow label="FBP" value={lead.fbp} mono />
            <div className="info_row column">
              <div className="row_head">
                <span className="label">User Agent</span>
                {lead.user_agent && (
                  <button
                    type="button"
                    className="expand_btn"
                    onClick={() => setUaExpanded((v) => !v)}
                  >
                    {uaExpanded ? '접기' : '전체 보기'}
                  </button>
                )}
              </div>
              <span
                className={[
                  'value mono ua',
                  uaExpanded ? 'expanded' : '',
                  !lead.user_agent ? 'empty' : '',
                ].join(' ')}
              >
                {lead.user_agent || '값 없음'}
              </span>
            </div>
          </section>
        </div>

        <div className="footer">
          <div className="register_row">
            <button
              type="button"
              className="btn register consultation"
              onClick={onRegisterConsultation}
            >
              상담 등록
            </button>
            <button
              type="button"
              className="btn register purchase"
              onClick={onRegisterPurchase}
            >
              구매 등록
            </button>
          </div>
          <div className="bottom_row">
            <button
              type="button"
              className="btn delete"
              onClick={onDeleteLead}
            >
              삭제
            </button>
            <button type="button" className="btn confirm" onClick={onConfirm}>
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
