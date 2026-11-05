import { useState, type ReactNode } from 'react'
import type {
  MondayCustomer,
  MondayCustomerListItem,
} from '@/screens/xtool-lead-manager/entity'
import {
  formatMondayDate,
  formatMondayPhone,
  type MondayCapiSource,
} from '@/screens/xtool-lead-manager/utils'
import { AutoHeight, LoadingPanel } from '@/components/glass'
import type { ItemUpdatesState } from '@/screens/xtool-lead-manager/view-model'
import '@/screens/xtool-lead-manager/styles/monday-updates.scss'
import { CloseIcon } from '../detail/icons'
import '@/screens/xtool-lead-manager/styles/detail.scss'
import { UpdatesContext } from './detail/updates-context'
import { Field, Section } from './detail/record-card'
import {
  ConsultationCard,
  VisitCard,
  PurchaseCard,
  PaymentCard,
  MoneySummary,
  SurveyCard,
  SampleTestCard,
} from './detail/sales-cards'
import {
  FieldServiceCard,
  RepairCard,
  TechInquiryCard,
  TechTaskCard,
} from './detail/tech-cards'
import { type RecordTab, recordCounts } from './detail/record-tab-counts'
import { RecordTabs } from './detail/record-tabs'

/**
 * Monday 고객 상세 — 한 번호로 묶인 기록 전부를 종류별(상담/방문체험/구매/
 * 납부 내역/만족도 조사/샘플테스트, 기술지원팀의 출장/AS/기술 문의/기타업무)로, 각각 최근 것부터 보여준다. 읽기 전용이다:
 * 원본이 Monday라서 고칠 것은 각 기록의 "Monday에서 열기"로 가서 고친다.
 * 상담·구매 기록은 "CAPI 전송"으로 Meta에 보내며 리드 탭으로 옮길 수 있다
 * (onSendCapi — 확인 모달은 부모가 띄운다). 왼쪽에는 고객 목록(sideList)을
 * 두어 다른 고객으로 바로 넘어간다.
 *
 * 머리(이름·번호)는 목록에서 이미 아는 값(summary)으로 바로 그리고, 기록은
 * 받아오는 대로(customer) 채운다.
 */
export const MondayDetail = ({
  summary,
  customer,
  failed,
  onClose,
  onSendCapi,
  sideList,
  itemUpdates,
  onLoadUpdates,
  keysEnabled = true,
}: {
  summary: MondayCustomerListItem
  customer: MondayCustomer | null
  failed: boolean
  onClose: () => void
  onSendCapi?: (source: MondayCapiSource) => void
  /** 왼쪽 고객 목록(monday-side-list.tsx). */
  sideList?: ReactNode
  /** 기록별 메모·파일(받아 둔 것)과 받는 함수. */
  itemUpdates?: Record<string, ItemUpdatesState>
  onLoadUpdates?: (itemId: string, force?: boolean) => void
  /** 위에 다른 모달(CAPI 전송)이 떠 있으면 false — 방향키를 듣지 않는다. */
  keysEnabled?: boolean
}) => {
  const [pickedTab, setPickedTab] = useState<RecordTab>('all')
  // 다른 고객으로 넘어가 고른 종류의 기록이 없으면 전체로 본다(고른 값은
  // 남겨 두어, 그 종류가 있는 고객으로 오면 다시 그 종류만).
  const tab: RecordTab =
    customer && pickedTab !== 'all' && recordCounts(customer)[pickedTab] === 0
      ? 'all'
      : pickedTab
  const show = (kind: Exclude<RecordTab, 'all'>) =>
    tab === 'all' || tab === kind
  const [primaryName, ...otherNames] = summary.names

  return (
    <UpdatesContext.Provider
      value={
        itemUpdates && onLoadUpdates
          ? { states: itemUpdates, load: onLoadUpdates }
          : null
      }
    >
      <div className="lead_manager_detail_modal" onClick={onClose}>
        <div
          className="detail_layout monday_detail_layout"
          onClick={(e) => e.stopPropagation()}
        >
          {sideList}
          <div
            className="detail_form monday_detail"
            role="dialog"
            aria-modal="true"
          >
            <div className="header">
              <div className="header_title">
                <span className="customer_name">
                  {primaryName ?? '이름 없음'}
                </span>
                <span className="monday_phone">
                  {formatMondayPhone(summary.phone)}
                </span>
              </div>
              <button className="close_btn" onClick={onClose} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>

            <div className="body">
              <section className="section">
                <dl className="monday_fields">
                  <Field label="다른 이름" value={otherNames.join(', ')} />
                  <Field
                    label="다른 번호"
                    value={summary.otherPhones
                      .map(formatMondayPhone)
                      .join(', ')}
                  />
                  <Field label="이메일" value={summary.emails.join(', ')} />
                  <Field
                    label="담당자"
                    value={summary.summary.assignees.join(', ')}
                  />
                  <Field
                    label="보드"
                    value={summary.summary.boardNames.join(', ')}
                  />
                </dl>
              </section>

              {/* 불러오는 자리 → 다 받은 기록: 높이가 자라고 기록이 선명해진다. */}
              <AutoHeight>
                {failed && (
                  <p className="monday_detail_message">
                    기록을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.
                  </p>
                )}
                {!failed && !customer && (
                  <LoadingPanel label="기록을 불러오는 중" minHeight={220} />
                )}

                {customer && (
                  <div className="glass_reveal">
                    <RecordTabs
                      customer={customer}
                      tab={tab}
                      onChange={setPickedTab}
                      keysEnabled={keysEnabled}
                    />
                    <Section
                      title="상담"
                      show={show('consultation')}
                      count={customer.consultations.length}
                    >
                      {customer.consultations.map((record) => (
                        <ConsultationCard
                          key={record.itemId}
                          record={record}
                          onSendCapi={onSendCapi}
                        />
                      ))}
                    </Section>
                    <Section
                      title="방문체험"
                      show={show('visit')}
                      count={customer.visits.length}
                    >
                      {customer.visits.map((record) => (
                        <VisitCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    {customer.issues.length > 0 &&
                      (show('consultation') || show('purchase')) && (
                        <ul className="monday_issues">
                          {customer.issues.map((issue) => (
                            <li key={`${issue.itemId}-${issue.type}`}>
                              <span>
                                {formatMondayDate(issue.date)} · {issue.message}
                              </span>
                              {issue.url && (
                                <a
                                  className="monday_link"
                                  href={issue.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Monday에서 열기
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    <Section
                      title="구매"
                      show={show('purchase')}
                      count={customer.purchases.length}
                    >
                      <MoneySummary customer={customer} />
                      {customer.purchases.map((record) => (
                        <PurchaseCard
                          key={record.itemId}
                          record={record}
                          onSendCapi={onSendCapi}
                        />
                      ))}
                    </Section>
                    <Section
                      title="납부 내역"
                      show={show('purchase')}
                      count={customer.payments.length}
                    >
                      {customer.purchases.length === 0 && (
                        <MoneySummary customer={customer} />
                      )}
                      {customer.payments.map((record) => (
                        <PaymentCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="만족도 조사"
                      show={show('survey')}
                      count={customer.surveys.length}
                    >
                      {customer.surveys.map((record) => (
                        <SurveyCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="샘플테스트"
                      show={show('sampleTest')}
                      count={customer.sampleTests.length}
                    >
                      {customer.sampleTests.map((record) => (
                        <SampleTestCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="출장"
                      show={show('fieldService')}
                      count={customer.fieldServices.length}
                    >
                      {customer.fieldServices.map((record) => (
                        <FieldServiceCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="AS"
                      show={show('repair')}
                      count={customer.repairs.length}
                    >
                      {customer.repairs.map((record) => (
                        <RepairCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="기술 문의"
                      show={show('techInquiry')}
                      count={customer.techInquiries.length}
                    >
                      {customer.techInquiries.map((record) => (
                        <TechInquiryCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                    <Section
                      title="기타업무"
                      show={show('techTask')}
                      count={customer.techTasks.length}
                    >
                      {customer.techTasks.map((record) => (
                        <TechTaskCard key={record.itemId} record={record} />
                      ))}
                    </Section>
                  </div>
                )}
              </AutoHeight>
            </div>
          </div>
        </div>
      </div>
    </UpdatesContext.Provider>
  )
}
