/** 기술지원팀 기록 카드 — 출장·AS·기술 문의·기타업무. */
import type {
  MondayFieldService,
  MondayRepair,
  MondayTechInquiry,
  MondayTechTask,
} from '@/screens/xtool-lead-manager/entity'
import { formatWon } from '@/screens/xtool-lead-manager/utils'
import { Field, RecordCard } from './record-card'

/** 기술지원팀 기록의 단계(보드 그룹) — 상태값과 같은 말이면 굳이 또 적지
 * 않는다("1차 안내" / "1차 안내"). */
const stageOf = (record: { stage: string | null; status: string | null }) =>
  record.stage && record.stage !== record.status ? record.stage : null

export const FieldServiceCard = ({
  record,
}: {
  record: MondayFieldService
}) => (
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

export const RepairCard = ({ record }: { record: MondayRepair }) => (
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

export const TechInquiryCard = ({ record }: { record: MondayTechInquiry }) => (
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

export const TechTaskCard = ({ record }: { record: MondayTechTask }) => (
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
