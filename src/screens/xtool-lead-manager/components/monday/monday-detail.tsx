import type { ReactNode } from 'react'
import type {
  MondayConsultation,
  MondayCustomer,
  MondayCustomerListItem,
  MondayPurchase,
  MondaySampleTest,
  MondaySurvey,
  MondayVisit,
} from '@/screens/xtool-lead-manager/entity'
import {
  formatMondayDate,
  formatMondayPhone,
  mondayStatusTone,
} from '@/screens/xtool-lead-manager/utils'
import { CloseIcon } from '../detail/icons'
import '@/screens/xtool-lead-manager/styles/detail.scss'

/** "라벨 값" 한 쌍 — 값이 없으면 아예 그리지 않아서, 보드마다 채워진 항목이
 * 달라도 빈 줄이 생기지 않는다. */
const Field = ({ label, value }: { label: string; value: ReactNode }) =>
  value ? (
    <div className="monday_field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null

/** 기록 한 건의 틀 — 머리(날짜·보드·상태·Monday 링크)와 본문. */
const RecordCard = ({
  date,
  boardName,
  status,
  url,
  children,
}: {
  date: string | null
  boardName: string
  status: string | null
  url: string | null
  children: ReactNode
}) => (
  <article className="monday_record">
    <header className="monday_record_head">
      <span className="date">{formatMondayDate(date)}</span>
      <span className="board">{boardName}</span>
      {status && (
        <span className={`monday_badge ${mondayStatusTone(status)}`}>
          {status}
        </span>
      )}
      {url && (
        <a className="monday_link" href={url} target="_blank" rel="noreferrer">
          Monday에서 열기
        </a>
      )}
    </header>
    {children}
  </article>
)

const Section = ({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) =>
  count > 0 ? (
    <section className="section">
      <h3 className="section_title">
        {title} <span className="monday_section_count">{count}</span>
      </h3>
      <div className="monday_records">{children}</div>
    </section>
  ) : null

const ConsultationCard = ({ record }: { record: MondayConsultation }) => (
  <RecordCard
    date={record.receivedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
  >
    <dl className="monday_fields">
      <Field label="담당자" value={record.assignee} />
      <Field label="관심 기기" value={record.product} />
      <Field label="구매확률" value={record.probability} />
      <Field label="상담 마감일" value={record.closedAt} />
      <Field label="콜백" value={record.callbackDates.join(' → ')} />
      <Field label="결제일" value={record.paidAt} />
      <Field label="미전환일" value={record.notConvertedAt} />
      <Field
        label="진행"
        value={[
          record.visitConfirmed && '방문체험 확정',
          record.quoteIssued && '견적서 발행',
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <Field
        label="UTM"
        value={[record.utmSource, record.utmMedium, record.utmCampaign]
          .filter(Boolean)
          .join(' / ')}
      />
    </dl>
    {record.notes && <p className="monday_notes">{record.notes}</p>}
  </RecordCard>
)

const VisitCard = ({ record }: { record: MondayVisit }) => (
  <RecordCard
    date={record.visitAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
  >
    <dl className="monday_fields">
      <Field label="방문 일시" value={record.visitAt} />
      <Field label="담당자" value={record.assignee} />
      <Field label="예약 기기" value={record.reservedDevice} />
      <Field label="실제 체험 기기" value={record.actualDevice} />
      <Field label="상담 상태" value={record.consultationStatus} />
      <Field label="구매 가능성" value={record.probability} />
      <Field label="유입경로" value={record.source} />
      <Field label="소재" value={record.material} />
      <Field label="콜백" value={record.callbackDates.join(' → ')} />
      <Field label="결제일" value={record.paidAt} />
      <Field label="미전환일" value={record.notConvertedAt} />
      <Field label="진행" value={record.quoteIssued && '견적서 발행'} />
    </dl>
    {record.notes && <p className="monday_notes">{record.notes}</p>}
    {record.memo && <p className="monday_notes">{record.memo}</p>}
  </RecordCard>
)

const PurchaseCard = ({ record }: { record: MondayPurchase }) => (
  <RecordCard
    date={record.paidAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
  >
    <dl className="monday_fields">
      <Field label="주문" value={record.orders} />
      <Field label="담당자" value={record.assignee} />
      <Field label="구매경로" value={record.channel} />
      <Field label="결제수단" value={record.method} />
      <Field label="수령방식" value={record.pickup} />
      <Field label="사업자" value={record.businessType} />
    </dl>
    {record.memo && <p className="monday_notes">{record.memo}</p>}
  </RecordCard>
)

const SurveyCard = ({ record }: { record: MondaySurvey }) => (
  <RecordCard
    date={record.createdAt}
    boardName={record.boardName}
    status={record.rating ? `만족도 ${record.rating}` : null}
    url={record.url}
  >
    <dl className="monday_fields">
      <Field label="체험 기기" value={record.device} />
      <Field label="담당자" value={record.assignee} />
      <Field label="알게 된 경로" value={record.knownFrom} />
      <Field label="중요 요소" value={record.importantFactor} />
    </dl>
    {record.liked && <p className="monday_notes">좋았던 점 — {record.liked}</p>}
    {record.disliked && (
      <p className="monday_notes">아쉬운 점 — {record.disliked}</p>
    )}
  </RecordCard>
)

const SampleTestCard = ({ record }: { record: MondaySampleTest }) => (
  <RecordCard
    date={record.requestedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
  >
    <dl className="monday_fields">
      <Field label="테스트 기기" value={record.device} />
      <Field label="샘플 소재" value={record.material} />
      <Field label="담당자" value={record.assignee} />
      <Field label="완료일" value={record.completedAt} />
      <Field label="받을 주소" value={record.address} />
    </dl>
  </RecordCard>
)

/**
 * Monday 고객 상세 — 한 번호로 묶인 기록 전부를 종류별(상담/방문체험/구매/
 * 만족도 조사/샘플테스트)로, 각각 최근 것부터 보여준다. 읽기 전용이다:
 * 원본이 Monday라서 고칠 것은 각 기록의 "Monday에서 열기"로 가서 고친다.
 *
 * 머리(이름·번호)는 목록에서 이미 아는 값(summary)으로 바로 그리고, 기록은
 * 받아오는 대로(customer) 채운다.
 */
export const MondayDetail = ({
  summary,
  customer,
  failed,
  onClose,
}: {
  summary: MondayCustomerListItem
  customer: MondayCustomer | null
  failed: boolean
  onClose: () => void
}) => {
  const [primaryName, ...otherNames] = summary.names

  return (
    <div className="lead_manager_detail_modal" onClick={onClose}>
      <div
        className="detail_form monday_detail"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header">
          <div className="header_title">
            <span className="customer_name">{primaryName ?? '이름 없음'}</span>
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
                value={summary.otherPhones.map(formatMondayPhone).join(', ')}
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

          {failed && (
            <p className="monday_detail_message">
              기록을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.
            </p>
          )}
          {!failed && !customer && (
            <p className="monday_detail_message">기록을 불러오는 중…</p>
          )}

          {customer && (
            <>
              <Section title="상담" count={customer.consultations.length}>
                {customer.consultations.map((record) => (
                  <ConsultationCard key={record.itemId} record={record} />
                ))}
              </Section>
              <Section title="방문체험" count={customer.visits.length}>
                {customer.visits.map((record) => (
                  <VisitCard key={record.itemId} record={record} />
                ))}
              </Section>
              <Section title="구매" count={customer.purchases.length}>
                {customer.purchases.map((record) => (
                  <PurchaseCard key={record.itemId} record={record} />
                ))}
              </Section>
              <Section title="만족도 조사" count={customer.surveys.length}>
                {customer.surveys.map((record) => (
                  <SurveyCard key={record.itemId} record={record} />
                ))}
              </Section>
              <Section title="샘플테스트" count={customer.sampleTests.length}>
                {customer.sampleTests.map((record) => (
                  <SampleTestCard key={record.itemId} record={record} />
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
