import type { Lead, LeadState } from '@/screens/xtool-lead-manager/entity'
import { EditingField } from '@/screens/xtool-lead-manager/types'
import { formatPhoneNumber } from '@/screens/xtool-lead-manager/utils'
import { useDetailViewModel } from '@/screens/xtool-lead-manager/view-model/detail'
import { DetailSideList } from '../detail-side-list'
import { ConsultationRow } from './consultation-row'
import { EditableInfoRow, EditableUserAgentRow } from './editable-info-row'
import { CloseIcon } from './icons'
import { IntakeRow } from './intake-row'
import { PurchaseRow } from './purchase-row'
import type {
  ConsultationUpdates,
  DeleteRecord,
  IntakeUpdates,
  PurchaseUpdates,
  ResendRecord,
  UpdateLeadField,
  UpdateRecord,
} from './types'
import '@/screens/xtool-lead-manager/styles/detail.scss'

const STATE_LABEL: Record<LeadState, string> = {
  new: '신규 유입',
  contacted: '상담 완료',
  purchased: '구매 완료',
}

const UTM_LABEL: Record<string, string> = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
}

/**
 * 고객 상세 모달 — 왼쪽에 검색된 고객 목록, 오른쪽에 한 고객의 기본 정보·
 * 접수/상담/구매 이력·유입 경로·추적 정보를 보여주고 그 자리에서 고친다.
 *
 * 이 파일은 모달의 뼈대와 섹션 배치만 갖는다. 각 줄의 모양과 동작은 같은
 * 폴더의 컴포넌트(editable-info-row, intake-row, consultation-row,
 * purchase-row)가, 상태는 view-model/detail의 훅이 맡는다.
 */
export const Detail = ({
  lead,
  leads,
  onSelectLead,
  onConfirm,
  onUpdateIntake,
  onDeleteIntake,
  onUpdateConsultation,
  onDeleteConsultation,
  onResendConsultation,
  onUpdatePurchase,
  onDeletePurchase,
  onResendPurchase,
  onRegisterConsultation,
  onRegisterPurchase,
  onDeleteLead,
  onUpdateField,
}: {
  lead: Lead
  /** 왼쪽 고객 목록에 뿌릴 검색된 전체 고객 — 지금 열려 있는 lead와는 별개다. */
  leads: Lead[]
  onSelectLead: (rowId: string) => void
  /** 모달 닫기 — 배경 클릭, 닫기 버튼, 확인 버튼, Esc가 전부 이걸 부른다. */
  onConfirm: () => void
  onUpdateIntake: UpdateRecord<IntakeUpdates>
  onDeleteIntake: DeleteRecord
  onUpdateConsultation: UpdateRecord<ConsultationUpdates>
  onDeleteConsultation: DeleteRecord
  onResendConsultation: ResendRecord
  onUpdatePurchase: UpdateRecord<PurchaseUpdates>
  onDeletePurchase: DeleteRecord
  onResendPurchase: ResendRecord
  onRegisterConsultation: () => void
  onRegisterPurchase: () => void
  onDeleteLead: () => void
  onUpdateField: UpdateLeadField
}) => {
  const { state } = useDetailViewModel(lead, onConfirm)
  const {
    leadState,
    intakes: sortedIntakes,
    consultations: sortedConsultations,
    purchases: sortedPurchases,
  } = state

  return (
    <div className="lead_manager_detail_modal" onClick={onConfirm}>
      <div className="detail_layout" onClick={(e) => e.stopPropagation()}>
        <DetailSideList
          leads={leads}
          activeLeadId={lead.id}
          onSelect={onSelectLead}
        />
        <div className="detail_form">
          <div className="header">
            <div className="header_title">
              <span className={['state_badge', leadState].join(' ')}>
                {STATE_LABEL[leadState]}
              </span>
              <span className="customer_name">{lead.fn || '이름 없음'}</span>
            </div>
            <button type="button" className="close_btn" onClick={onConfirm}>
              <CloseIcon />
            </button>
          </div>

          <div className="body">
            <section className="section">
              <div className="section_title">Basic Info</div>
              <EditableInfoRow
                label="Name"
                field={EditingField.FIRST_NAME}
                leadId={lead.id}
                rawValue={lead.fn}
                displayValue={lead.fn}
                onSave={onUpdateField}
              />
              <EditableInfoRow
                label="Phone"
                field={EditingField.PHONE}
                leadId={lead.id}
                rawValue={lead.ph}
                displayValue={formatPhoneNumber(lead.ph)}
                mono
                onSave={onUpdateField}
              />
              {/* 필수가 아니라 비어 있을 수 있고(예전 리드엔 키도 없다), 지우려면
                  빈 값으로 저장하면 된다. */}
              <EditableInfoRow
                label="Email"
                field={EditingField.EMAIL}
                leadId={lead.id}
                rawValue={lead.em ?? ''}
                displayValue={lead.em ?? ''}
                onSave={onUpdateField}
              />
              {/* 직책·회사명·동반 구매자 등 내부 참고용 메모라 기본 정보에
                  속한다 — 예전엔 따로 섹션이었다. */}
              <EditableInfoRow
                label="Remarks"
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
                      onResend={onResendConsultation}
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
                      onResend={onResendPurchase}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty_state">구매 이력이 없습니다</div>
              )}
            </section>

            <section className="section">
              <div className="section_title">Traffic Source</div>
              <EditableInfoRow
                label={UTM_LABEL.utm_source}
                field={EditingField.UTM_SOURCE}
                leadId={lead.id}
                rawValue={lead.utm_source}
                displayValue={lead.utm_source}
                onSave={onUpdateField}
              />
              <EditableInfoRow
                label={UTM_LABEL.utm_medium}
                field={EditingField.UTM_MEDIUM}
                leadId={lead.id}
                rawValue={lead.utm_medium}
                displayValue={lead.utm_medium}
                onSave={onUpdateField}
              />
              <EditableInfoRow
                label={UTM_LABEL.utm_campaign}
                field={EditingField.UTM_CAMPAIGN}
                leadId={lead.id}
                rawValue={lead.utm_campaign}
                displayValue={lead.utm_campaign}
                onSave={onUpdateField}
              />
            </section>

            <section className="section">
              <div className="section_title">Tracking</div>
              <EditableInfoRow
                label="IP Address"
                field={EditingField.IP}
                leadId={lead.id}
                rawValue={lead.ip}
                displayValue={lead.ip}
                mono
                onSave={onUpdateField}
              />
              <EditableInfoRow
                label="fbc"
                field={EditingField.FBC}
                leadId={lead.id}
                rawValue={lead.fbc}
                displayValue={lead.fbc}
                mono
                onSave={onUpdateField}
              />
              <EditableInfoRow
                label="fbp"
                field={EditingField.FBP}
                leadId={lead.id}
                rawValue={lead.fbp}
                displayValue={lead.fbp}
                mono
                onSave={onUpdateField}
              />
              {/* 문의 폼의 _ga 쿠키 값 — 상담 등록 때 GA4 이벤트를 이 고객의
                  웹 방문에 붙이는 데 쓴다. 비어 있으면 전화번호 해시로 대신한다. */}
              <EditableInfoRow
                label="GA4 Client ID"
                field={EditingField.GA4_CLIENT_ID}
                leadId={lead.id}
                rawValue={lead.ga4ClientId ?? ''}
                displayValue={lead.ga4ClientId ?? ''}
                mono
                onSave={onUpdateField}
              />
              <EditableUserAgentRow
                leadId={lead.id}
                rawValue={lead.user_agent}
                onSave={onUpdateField}
              />
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
    </div>
  )
}
