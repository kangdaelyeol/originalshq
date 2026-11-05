/** Monday 기록 카드의 공통 틀 — 라벨 값, 카드 머리·본문, CAPI 버튼, 섹션. */
import { type ReactNode } from 'react'
import { Send } from 'lucide-react'
import {
  formatMondayDate,
  mondayStatusTone,
  canSendMondayCapi,
  type MondayCapiSource,
} from '@/screens/xtool-lead-manager/utils'
import { RecordUpdates } from './record-updates'

/** "라벨 값" 한 쌍 — 값이 없으면 아예 그리지 않아서, 보드마다 채워진 항목이
 * 달라도 빈 줄이 생기지 않는다. */
export const Field = ({ label, value }: { label: string; value: ReactNode }) =>
  value ? (
    <div className="monday_field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null

/** 기록 한 건의 틀 — 머리(날짜·보드·상태·CAPI 전송·Monday 링크)와 본문, 그리고
 * Monday 기록이면 맨 아래에 메모·파일 펼치기. */
export const RecordCard = ({
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
export const CapiButton = ({
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

export const Section = ({
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
