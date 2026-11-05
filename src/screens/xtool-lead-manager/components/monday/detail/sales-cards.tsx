/** 상담·방문체험·구매·납부·만족도 조사·샘플테스트 기록 카드. */
import type {
  MondayConsultation,
  MondayCustomer,
  MondayPayment,
  MondayPurchase,
  MondayPurchaseLine,
  MondaySampleTest,
  MondaySurvey,
  MondayVisit,
} from '@/screens/xtool-lead-manager/entity'
import {
  formatWon,
  type MondayCapiSource,
} from '@/screens/xtool-lead-manager/utils'
import { Field, RecordCard, CapiButton } from './record-card'

export const ConsultationCard = ({
  record,
  onSendCapi,
}: {
  record: MondayConsultation
  onSendCapi?: (source: MondayCapiSource) => void
}) => (
  <RecordCard
    date={record.receivedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
    action={
      <CapiButton
        source={{ kind: 'consultation', record }}
        onSend={onSendCapi}
      />
    }
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
    {record.inquiryMessage && (
      <p className="monday_notes">고객 문의 — {record.inquiryMessage}</p>
    )}
    {record.notes && <p className="monday_notes">{record.notes}</p>}
  </RecordCard>
)

export const VisitCard = ({ record }: { record: MondayVisit }) => (
  <RecordCard
    date={record.visitAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
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

const LINE_KIND_LABEL: Record<MondayPurchaseLine['kind'], string> = {
  product: '',
  deferred: '계약금·분할납부',
  interest: '할부 이자',
  cancelled: '취소·반품',
}

/** 품목 줄 표 — 판매가·수량·할인·최종 금액. 계약금/분할납부 줄과 할부 이자
 * 줄은 구매 금액에 들어가지 않으므로 흐리게 하고 꼬리표를 붙인다. */
const LineTable = ({ lines }: { lines: MondayPurchaseLine[] }) =>
  lines.length > 0 ? (
    <table className="monday_lines">
      <thead>
        <tr>
          <th>품목</th>
          <th>판매가</th>
          <th>수량</th>
          <th>할인</th>
          <th>최종 금액</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={index} className={line.kind}>
            <td>
              {line.product || line.name}
              {line.kind !== 'product' && (
                <span className="monday_line_tag">
                  {LINE_KIND_LABEL[line.kind]}
                </span>
              )}
              {line.memo && (
                <span className="monday_line_memo">{line.memo}</span>
              )}
            </td>
            <td>{line.price === null ? '' : formatWon(line.price)}</td>
            <td>{line.quantity ?? ''}</td>
            <td>{line.discount ? formatWon(line.discount) : ''}</td>
            <td>{formatWon(line.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null

export const PurchaseCard = ({
  record,
  onSendCapi,
}: {
  record: MondayPurchase
  onSendCapi?: (source: MondayCapiSource) => void
}) => (
  <RecordCard
    date={record.paidAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
    action={
      <CapiButton source={{ kind: 'purchase', record }} onSend={onSendCapi} />
    }
  >
    <dl className="monday_fields">
      <Field
        label="구매 금액"
        value={
          <strong className={record.cancelled ? 'monday_cancelled' : ''}>
            {formatWon(record.amount)}
          </strong>
        }
      />
      <Field
        label="당일 받은 금액"
        value={
          record.deferredAmount !== 0 &&
          formatWon(record.amount + record.deferredAmount)
        }
      />
      <Field label="구분" value={record.origin === 'online' && '온라인몰'} />
      <Field
        label="할부 이자"
        value={record.interestAmount !== 0 && formatWon(record.interestAmount)}
      />
      <Field label="담당자" value={record.assignee} />
      <Field label="구매경로" value={record.channel} />
      <Field label="결제수단" value={record.method} />
      <Field label="수령방식" value={record.pickup} />
      <Field label="사업자" value={record.businessType} />
    </dl>
    <LineTable lines={record.lines} />
    {record.memo && <p className="monday_notes">{record.memo}</p>}
  </RecordCard>
)

export const PaymentCard = ({ record }: { record: MondayPayment }) => (
  <RecordCard
    date={record.paidAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
  >
    <dl className="monday_fields">
      <Field
        label="납부 금액"
        value={
          <strong className={record.cancelled ? 'monday_cancelled' : ''}>
            {formatWon(record.amount)}
          </strong>
        }
      />
      {record.adjustmentAmount ? (
        <Field label="할인" value={formatWon(record.adjustmentAmount)} />
      ) : null}
      {record.interestAmount ? (
        <Field label="할부 이자" value={formatWon(record.interestAmount)} />
      ) : null}
      <Field label="담당자" value={record.assignee} />
      <Field label="결제수단" value={record.method} />
    </dl>
    {record.memo && <p className="monday_notes">{record.memo}</p>}
  </RecordCard>
)

/** 구매 섹션 맨 위의 금액 요약 — 구매는 계약 기준이라 "얼마를 계약했고,
 * 얼마를 받았고, 얼마가 남았는지"를 한 줄로 본다. */
export const MoneySummary = ({ customer }: { customer: MondayCustomer }) => {
  const { summary } = customer
  if (summary.purchaseCount === 0 && summary.paymentCount === 0) return null

  return (
    <dl className="monday_money">
      <div>
        <dt>구매 금액</dt>
        <dd>{formatWon(summary.purchaseAmount)}</dd>
      </div>
      <div>
        <dt>받은 금액</dt>
        <dd>{formatWon(summary.receivedAmount)}</dd>
      </div>
      <div className={summary.balanceAmount > 0 ? 'balance' : ''}>
        <dt>잔금</dt>
        <dd>{formatWon(Math.max(summary.balanceAmount, 0))}</dd>
      </div>
      {summary.interestAmount !== 0 && (
        <div>
          <dt>할부 이자</dt>
          <dd>{formatWon(summary.interestAmount)}</dd>
        </div>
      )}
    </dl>
  )
}

export const SurveyCard = ({ record }: { record: MondaySurvey }) => (
  <RecordCard
    date={record.createdAt}
    boardName={record.boardName}
    status={record.rating ? `만족도 ${record.rating}` : null}
    url={record.url}
    itemId={record.itemId}
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

export const SampleTestCard = ({ record }: { record: MondaySampleTest }) => (
  <RecordCard
    date={record.requestedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
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
