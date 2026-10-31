import { createContext, useContext, useState, type ReactNode } from 'react'
import { Send } from 'lucide-react'
import type {
  MondayAsset,
  MondayConsultation,
  MondayCustomer,
  MondayCustomerListItem,
  MondayFieldService,
  MondayItemUpdates,
  MondayPayment,
  MondayPurchase,
  MondayPurchaseLine,
  MondayRepair,
  MondaySampleTest,
  MondaySurvey,
  MondayTechInquiry,
  MondayTechTask,
  MondayVisit,
} from '@/screens/xtool-lead-manager/entity'
import {
  formatMondayDate,
  formatMondayPhone,
  formatWon,
  mondayStatusTone,
  canSendMondayCapi,
  type MondayCapiSource,
} from '@/screens/xtool-lead-manager/utils'
import {
  AutoHeight,
  LoadingPanel,
  Segmented,
  Spinner,
} from '@/components/glass'
import { useArrowTabs } from '@/screens/xtool-lead-manager/hooks/use-arrow-tabs'
import type { ItemUpdatesState } from '@/screens/xtool-lead-manager/view-model'
import '@/screens/xtool-lead-manager/styles/monday-updates.scss'
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

/** 기록마다 펼치는 메모·파일 — 받아 둔 것과 받는 함수. MondayDetail이 내려준다. */
const UpdatesContext = createContext<{
  states: Record<string, ItemUpdatesState>
  load: (itemId: string, force?: boolean) => void
} | null>(null)

const IMAGE_EXT = /^(jpe?g|png|gif|webp|heic|bmp|svg)$/
const VIDEO_EXT = /^(mp4|mov|webm|m4v|avi)$/

const formatSize = (size: number | null): string => {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

/** 첨부 파일 하나 — 이미지는 미리보기, 영상은 바로 재생, 나머지는 열기 링크.
 * 주소는 한 시간쯤 뒤 만료된다(다시 펼치면 새로 받는다). */
const AssetView = ({ asset }: { asset: MondayAsset }) => {
  const ext = asset.extension ?? ''
  if (asset.url && VIDEO_EXT.test(ext))
    return (
      <figure className="monday_asset is-video">
        <video src={asset.url} controls preload="metadata" />
        <figcaption>
          <a href={asset.url} target="_blank" rel="noreferrer">
            {asset.name}
          </a>{' '}
          {formatSize(asset.size)}
        </figcaption>
      </figure>
    )
  // HEIC는 브라우저가 못 그려서 Monday 미리보기(thumbnail)를 쓴다.
  const preview =
    IMAGE_EXT.test(ext) && ext !== 'heic' ? asset.url : asset.thumbnail
  if (asset.url && preview)
    return (
      <a
        className="monday_asset is-image"
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        title={`${asset.name} ${formatSize(asset.size)}`}
      >
        <img src={preview} alt={asset.name} loading="lazy" />
      </a>
    )
  return (
    <a
      className="monday_asset is-file"
      href={asset.url ?? undefined}
      target="_blank"
      rel="noreferrer"
    >
      <span className="ext">{ext || '파일'}</span>
      <span className="name">{asset.name}</span>
      <span className="size">{formatSize(asset.size)}</span>
    </a>
  )
}

const Assets = ({ assets }: { assets: MondayAsset[] }) =>
  assets.length > 0 ? (
    <div className="monday_assets">
      {assets.map((asset) => (
        <AssetView key={asset.id} asset={asset} />
      ))}
    </div>
  ) : null

/** Monday가 준 시각(UTC)을 한국 시간 "YYYY-MM-DD HH:mm"으로. */
const formatAt = (value: string | null): string => {
  const time = value ? Date.parse(value) : NaN
  if (Number.isNaN(time)) return ''
  return new Date(time + 9 * 3_600_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16)
}

const UpdatesBody = ({ data }: { data: MondayItemUpdates }) =>
  data.updates.length === 0 && data.files.length === 0 ? (
    <p className="monday_updates_empty">메모·파일이 없습니다.</p>
  ) : (
    <>
      {data.files.length > 0 && (
        <div className="monday_update">
          <div className="monday_update_head">파일 컬럼</div>
          <Assets assets={data.files} />
        </div>
      )}
      {data.updates.map((update) => (
        <div key={update.id} className="monday_update">
          <div className="monday_update_head">
            <strong>{update.author ?? '알 수 없음'}</strong>
            <span>{formatAt(update.createdAt)}</span>
          </div>
          {update.text && <p className="monday_update_text">{update.text}</p>}
          <Assets assets={update.assets} />
          {update.replies.length > 0 && (
            <ul className="monday_update_replies">
              {update.replies.map((reply) => (
                <li key={reply.id}>
                  <div className="monday_update_head">
                    <strong>{reply.author ?? '알 수 없음'}</strong>
                    <span>{formatAt(reply.createdAt)}</span>
                  </div>
                  <p className="monday_update_text">{reply.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  )

/** "메모·파일" 펼치기 — 처음 펼칠 때 Monday에서 받아온다. */
const RecordUpdates = ({ itemId }: { itemId: string }) => {
  const updates = useContext(UpdatesContext)
  const [open, setOpen] = useState(false)
  if (!updates) return null
  const state = updates.states[itemId]
  const toggle = () => {
    if (!open) updates.load(itemId)
    setOpen(!open)
  }
  const count =
    state?.status === 'ready'
      ? state.data.updates.length + state.data.files.length
      : null

  return (
    <div className="monday_updates">
      <button
        type="button"
        className="monday_updates_toggle"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? '▾' : '▸'} 메모·파일
        {count !== null && <span className="count">{count}</span>}
      </button>
      {open && (
        <div className="monday_updates_body">
          {!state || state.status === 'loading' ? (
            <p className="monday_updates_empty">
              <Spinner size={14} /> Monday에서 불러오는 중
            </p>
          ) : state.status === 'error' ? (
            <p className="monday_updates_empty">
              {state.error}{' '}
              <button
                type="button"
                className="monday_updates_retry"
                onClick={() => updates.load(itemId, true)}
              >
                다시 시도
              </button>
            </p>
          ) : (
            <UpdatesBody data={state.data} />
          )}
        </div>
      )}
    </div>
  )
}

/** 기록 한 건의 틀 — 머리(날짜·보드·상태·CAPI 전송·Monday 링크)와 본문, 그리고
 * Monday 기록이면 맨 아래에 메모·파일 펼치기. */
const RecordCard = ({
  date,
  boardName,
  status,
  url,
  itemId,
  action,
  children,
}: {
  date: string | null
  boardName: string
  status: string | null
  url: string | null
  itemId: string
  /** 머리 오른쪽 버튼(CAPI 전송). */
  action?: ReactNode
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
      {action}
      {url && (
        <a className="monday_link" href={url} target="_blank" rel="noreferrer">
          Monday에서 열기
        </a>
      )}
    </header>
    {children}
    {/* 온라인(Cafe24) 주문은 Monday 기록이 아니라 메모가 없다. */}
    {url && <RecordUpdates itemId={itemId} />}
  </article>
)

/** 상담·구매 기록을 Meta CAPI로 보내고 리드 탭으로 옮기는 버튼 — 누르면 확인
 * 모달(monday-capi-modal.tsx)이 뜬다. 오기입 상담·취소된 결제에는 없다. */
const CapiButton = ({
  source,
  onSend,
}: {
  source: MondayCapiSource
  onSend?: (source: MondayCapiSource) => void
}) =>
  onSend && canSendMondayCapi(source) ? (
    <button
      type="button"
      className="monday_capi_btn"
      onClick={() => onSend(source)}
    >
      <Send strokeWidth={1.8} aria-hidden="true" />
      CAPI 전송
    </button>
  ) : null

const Section = ({
  title,
  count,
  show = true,
  children,
}: {
  title: string
  count: number
  /** 위 토글에서 고른 종류가 아니면 false. */
  show?: boolean
  children: ReactNode
}) =>
  show && count > 0 ? (
    <section className="section">
      <h3 className="section_title">
        {title} <span className="monday_section_count">{count}</span>
      </h3>
      <div className="monday_records">{children}</div>
    </section>
  ) : null

const ConsultationCard = ({
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
    {record.notes && <p className="monday_notes">{record.notes}</p>}
  </RecordCard>
)

const VisitCard = ({ record }: { record: MondayVisit }) => (
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

const PurchaseCard = ({
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

const PaymentCard = ({ record }: { record: MondayPayment }) => (
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
const MoneySummary = ({ customer }: { customer: MondayCustomer }) => {
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

const SurveyCard = ({ record }: { record: MondaySurvey }) => (
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

const SampleTestCard = ({ record }: { record: MondaySampleTest }) => (
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

/** 기술지원팀 기록의 단계(보드 그룹) — 상태값과 같은 말이면 굳이 또 적지
 * 않는다("1차 안내" / "1차 안내"). */
const stageOf = (record: { stage: string | null; status: string | null }) =>
  record.stage && record.stage !== record.status ? record.stage : null

const FieldServiceCard = ({ record }: { record: MondayFieldService }) => (
  <RecordCard
    date={record.visitAt ?? record.receivedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
  >
    <dl className="monday_fields">
      <Field label="단계" value={stageOf(record)} />
      <Field label="출장 종류" value={record.type} />
      <Field label="접수일" value={record.receivedAt} />
      <Field label="방문 일정" value={record.visitAt} />
      <Field label="담당자" value={record.assignee} />
      <Field label="지역" value={record.region} />
      <Field label="주소" value={record.address} />
      <Field
        label="설치 품목"
        value={record.items
          .map((line) =>
            line.quantity && line.quantity !== 1
              ? `${line.name} ×${line.quantity}`
              : line.name,
          )
          .join(', ')}
      />
    </dl>
    {record.notes && <p className="monday_notes">{record.notes}</p>}
  </RecordCard>
)

/** AS 청구 줄 — 부품·공임과 금액. */
const PartTable = ({ parts }: { parts: MondayRepair['parts'] }) =>
  parts.length > 0 ? (
    <table className="monday_lines">
      <thead>
        <tr>
          <th>부품</th>
          <th>금액</th>
          <th>수량</th>
          <th>합계</th>
        </tr>
      </thead>
      <tbody>
        {parts.map((line, index) => (
          <tr key={index} className="product">
            <td>
              {line.part || line.name}
              {line.sku && <span className="monday_line_memo">{line.sku}</span>}
            </td>
            <td>{line.price === null ? '' : formatWon(line.price)}</td>
            <td>{line.quantity ?? ''}</td>
            <td>{formatWon(line.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null

const RepairCard = ({ record }: { record: MondayRepair }) => (
  <RecordCard
    date={record.receivedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
  >
    <dl className="monday_fields">
      <Field label="단계" value={stageOf(record)} />
      <Field label="기기" value={record.device} />
      <Field label="SN" value={record.serialNumber} />
      <Field label="담당자" value={record.assignee} />
      <Field label="완료일" value={record.completedAt} />
      <Field
        label="청구액"
        value={record.amount ? formatWon(record.amount) : null}
      />
      <Field label="주소" value={record.address} />
    </dl>
    {record.symptom && <p className="monday_notes">증상 — {record.symptom}</p>}
    {record.result && (
      <p className="monday_notes">수리 내역 — {record.result}</p>
    )}
    <PartTable parts={record.parts} />
  </RecordCard>
)

const TechInquiryCard = ({ record }: { record: MondayTechInquiry }) => (
  <RecordCard
    date={record.receivedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
  >
    <dl className="monday_fields">
      <Field label="단계" value={stageOf(record)} />
      <Field label="문의 종류" value={record.type} />
      <Field
        label="기기"
        value={[
          ...new Set(
            [record.deviceSeries, record.device].filter(
              (value) => value && value !== '기타',
            ),
          ),
        ].join(' · ')}
      />
      <Field label="담당자" value={record.assignee} />
    </dl>
    {record.content && <p className="monday_notes">{record.content}</p>}
    {record.resolution && (
      <p className="monday_notes">해결 방안 — {record.resolution}</p>
    )}
  </RecordCard>
)

const TechTaskCard = ({ record }: { record: MondayTechTask }) => (
  <RecordCard
    date={record.requestedAt}
    boardName={record.boardName}
    status={record.status}
    url={record.url}
    itemId={record.itemId}
  >
    <dl className="monday_fields">
      <Field label="단계" value={stageOf(record)} />
      <Field label="요청" value={record.requester} />
      <Field label="담당자" value={record.assignee} />
      <Field label="마감일" value={record.dueAt} />
      <Field label="완료일" value={record.completedAt} />
    </dl>
    {record.details && <p className="monday_notes">{record.details}</p>}
  </RecordCard>
)

/** 기록 종류 토글 — 고른 종류의 섹션만 보인다. 납부 내역은 구매와 같이 본다. */
type RecordTab =
  | 'all'
  | 'consultation'
  | 'visit'
  | 'purchase'
  | 'survey'
  | 'sampleTest'
  | 'fieldService'
  | 'repair'
  | 'techInquiry'
  | 'techTask'

const RECORD_TAB_LABEL: Record<RecordTab, string> = {
  all: '전체',
  consultation: '상담',
  visit: '방문체험',
  purchase: '구매',
  survey: '만족도',
  sampleTest: '샘플테스트',
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '기술 문의',
  techTask: '기타업무',
}

const recordCounts = (
  customer: MondayCustomer,
): Record<Exclude<RecordTab, 'all'>, number> => ({
  consultation: customer.consultations.length,
  visit: customer.visits.length,
  purchase: customer.purchases.length + customer.payments.length,
  survey: customer.surveys.length,
  sampleTest: customer.sampleTests.length,
  fieldService: customer.fieldServices.length,
  repair: customer.repairs.length,
  techInquiry: customer.techInquiries.length,
  techTask: customer.techTasks.length,
})

/** 기록 종류 토글 — 기록이 있는 종류만 버튼으로(전체 + 그 종류들). 좌/우
 * 방향키로 옮긴다. 다른 고객으로 넘어가 고른 종류가 없으면 전체로 보인다. */
const RecordTabs = ({
  customer,
  tab,
  onChange,
  keysEnabled,
}: {
  customer: MondayCustomer
  tab: RecordTab
  onChange: (next: RecordTab) => void
  keysEnabled: boolean
}) => {
  const counts = recordCounts(customer)
  const tabs: RecordTab[] = [
    'all',
    ...(Object.keys(counts) as Exclude<RecordTab, 'all'>[]).filter(
      (key) => counts[key] > 0,
    ),
  ]
  useArrowTabs(tabs, tab, onChange, keysEnabled)
  // 기록이 한 종류뿐이면 고를 게 없다.
  if (tabs.length <= 2) return null
  const options = Object.fromEntries(
    tabs.map((key) => [
      key,
      <span key={key} className="monday_category_label">
        {RECORD_TAB_LABEL[key]}
        {key !== 'all' && <span className="count">{counts[key]}</span>}
      </span>,
    ]),
  ) as Record<RecordTab, ReactNode>
  return (
    <div className="monday_record_tabs">
      <Segmented
        options={options}
        value={tab}
        onChange={onChange}
        label="기록 종류"
        size="md"
      />
    </div>
  )
}

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
