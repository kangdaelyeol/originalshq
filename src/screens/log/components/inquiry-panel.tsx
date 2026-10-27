import { Fragment } from 'react'
import {
  INQUIRY_DEVICES,
  type Inquiry,
  type InquiryStepStatus,
} from '../client/inquiry-client'
import { formatAgo, formatDateTime } from '../utils/batch-run'
import {
  INQUIRY_PERIOD_OPTIONS,
  TEMPLATE_TOKENS,
  LMS_SUBJECT_MAX_BYTES,
  previewTemplate,
  SMS_MAX_BYTES,
  smsBytes,
  useInquiryLogViewModel,
  type InquiryFilter,
} from '../view-model/use-inquiry-log-view-model'
import { DeviceSelect } from './device-select'

const MONDAY_ITEM_URL = (boardId: string, itemId: string) =>
  `https://cyankorea-company.monday.com/boards/${boardId}/pulses/${itemId}`

const FILTERS: readonly { id: InquiryFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'problem', label: '확인 필요' },
]

const STEP_LABEL: Record<InquiryStepStatus, string> = {
  success: '완료',
  failed: '실패',
  pending: '처리 중',
  skipped: '건너뜀',
}
const STEP_ICON: Record<InquiryStepStatus, string> = {
  success: '✓',
  failed: '✕',
  pending: '…',
  skipped: '–',
}
const STEP_CLASS: Record<InquiryStepStatus, string> = {
  success: 'is-success',
  failed: 'is-failed',
  pending: 'is-running',
  skipped: 'is-pending',
}

/** 단계 상태 배지 — 기호 + 이름(색만으로 구분하지 않는다). */
const StepBadge = ({ status }: { status: InquiryStepStatus }) => (
  <span className={`batch-log__badge ${STEP_CLASS[status]}`}>
    <span aria-hidden="true">{STEP_ICON[status]}</span>
    {STEP_LABEL[status]}
  </span>
)

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || '-'}</dd>
  </div>
)

/** 시도 횟수 — 한 번에 끝났으면 보이지 않는다. */
const Attempts = ({
  status,
  attempts,
}: {
  status: InquiryStepStatus
  attempts?: number
}) =>
  attempts && attempts > 1 ? (
    <p className="inquiry-log__attempts">
      {status === 'success'
        ? `${attempts}번째 시도에 성공`
        : `${attempts}번 시도 후 실패`}
    </p>
  ) : null

/** 펼친 줄 — 받은 값 전부와 단계별 결과, 다시 실행 버튼. */
const InquiryDetail = ({
  inquiry,
  retrying,
  onRetry,
}: {
  inquiry: Inquiry
  retrying: string | null
  onRetry: (id: string, step: 'monday' | 'sms') => void
}) => {
  const busy = (step: string) => retrying === `${inquiry.id}:${step}`
  return (
    <div className="inquiry-log__detail">
      <dl className="inquiry-log__facts">
        <Fact label="이메일" value={inquiry.email} />
        <Fact label="할부상담여부" value={inquiry.installment} />
        <Fact label="회사·기관" value={inquiry.company ?? ''} />
        <Fact label="문의 유형" value={inquiry.inquiryType ?? ''} />
        <Fact label="문의 내용" value={inquiry.message ?? ''} />
        <Fact label="도입시기" value={inquiry.introPeriod ?? ''} />
        <Fact label="utm_source" value={inquiry.utmSource} />
        <Fact label="utm_medium" value={inquiry.utmMedium} />
        <Fact label="utm_campaign" value={inquiry.utmCampaign} />
        <Fact label="GA ClientId" value={inquiry.gaClientId} />
        <Fact label="fbc" value={inquiry.fbc} />
        <Fact label="fbp" value={inquiry.fbp} />
        <Fact label="IP" value={inquiry.ip} />
        <Fact label="브라우저" value={inquiry.userAgent} />
      </dl>
      <div className="inquiry-log__steps">
        <div className="inquiry-log__step">
          <h3>
            Monday 등록 <StepBadge status={inquiry.monday.status} />
          </h3>
          {inquiry.monday.itemId && (
            <a
              href={MONDAY_ITEM_URL(inquiry.boardId, inquiry.monday.itemId)}
              target="_blank"
              rel="noreferrer"
            >
              {inquiry.boardName} 보드에서 열기
            </a>
          )}
          <Attempts
            status={inquiry.monday.status}
            attempts={inquiry.monday.attempts}
          />
          {inquiry.monday.error && (
            <p className="batch-log__error">{inquiry.monday.error}</p>
          )}
          {inquiry.monday.status !== 'success' && (
            <button
              type="button"
              className="batch-log__refresh"
              disabled={busy('monday')}
              onClick={() => onRetry(inquiry.id, 'monday')}
            >
              {busy('monday') ? '등록 중…' : 'Monday에 다시 등록'}
            </button>
          )}
        </div>
        <div className="inquiry-log__step">
          <h3>
            접수 안내 문자 <StepBadge status={inquiry.sms.status} />
          </h3>
          {inquiry.sms.text && (
            <p className="inquiry-log__sms">
              {inquiry.sms.from ? `${inquiry.sms.from} → ` : ''}
              {inquiry.sms.to}
              <br />
              {inquiry.sms.subject && (
                <>
                  <strong>{inquiry.sms.subject}</strong>
                  <br />
                </>
              )}
              {inquiry.sms.text}
            </p>
          )}
          <Attempts
            status={inquiry.sms.status}
            attempts={inquiry.sms.attempts}
          />
          {inquiry.sms.error && (
            <p className="batch-log__error">{inquiry.sms.error}</p>
          )}
          {inquiry.sms.status !== 'success' && (
            <button
              type="button"
              className="batch-log__refresh"
              disabled={busy('sms')}
              onClick={() => onRetry(inquiry.id, 'sms')}
            >
              {busy('sms') ? '보내는 중…' : '문자 다시 보내기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * /log의 "문의 접수" 탭 — 웹사이트 상담 신청이 Monday 보드에 들어갔는지와
 * 접수 안내 문자가 나갔는지 확인한다(예전 Zapier 자동화를 대신하는
 * functions-xtool의 submitInquiry). 수정은 Monday에서 하고, 여기서는 들어온
 * 것만 확인한다. 문자 설정(발송 여부·발신 번호·내용)도 여기서 고친다.
 */
export function InquiryPanel() {
  const { state, actions } = useInquiryLogViewModel()
  const {
    days,
    filter,
    search,
    device,
    deviceCounts,
    selected,
    visibleSelected,
    deleting,
    rows,
    status,
    error,
    fetchedAt,
    now,
    summary,
    openId,
    retrying,
    actionError,
    draft,
    dirty,
    settingsOpen,
    saving,
    settingsMessage,
  } = state
  const allVisibleSelected = rows.length > 0 && visibleSelected === rows.length
  const confirmDelete = () => {
    if (
      window.confirm(
        `선택한 ${selected.size}건의 접수 기록을 지울까요?\n` +
          '지운 기록은 되돌릴 수 없습니다. Monday 아이템과 이미 보낸 문자는 지워지지 않습니다.',
      )
    ) {
      void actions.deleteSelected()
    }
  }
  const preview = draft ? previewTemplate(draft.template) : ''
  const bytes = smsBytes(preview)
  const isLms = bytes > SMS_MAX_BYTES
  const subjectBytes = draft ? smsBytes(draft.subject.trim()) : 0

  return (
    <>
      <header className="batch-log__header">
        <div>
          <h2 className="batch-log__title">문의 접수</h2>
          <p className="batch-log__muted">
            웹사이트 상담 신청이 Monday 보드에 등록되고 접수 안내 문자가
            나갔는지 확인합니다. 내용 수정은 Monday에서 합니다.
          </p>
        </div>
        <div className="batch-log__controls">
          <div
            className="batch-log__segmented"
            role="tablist"
            aria-label="보기"
          >
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === filter}
                className={option.id === filter ? 'is-active' : ''}
                onClick={() => actions.changeFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div
            className="batch-log__segmented"
            role="tablist"
            aria-label="기간"
          >
            {INQUIRY_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                role="tab"
                aria-selected={option.days === days}
                className={option.days === days ? 'is-active' : ''}
                onClick={() => actions.changeDays(option.days)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="batch-log__refresh"
            onClick={actions.toggleSettings}
            aria-expanded={settingsOpen}
          >
            문자 설정
          </button>
          <button
            type="button"
            className="batch-log__refresh"
            onClick={() => void actions.reload()}
          >
            새로고침
          </button>
        </div>
      </header>

      {settingsOpen && draft && (
        <section className="batch-log__card inquiry-log__settings">
          <h2>접수 안내 문자</h2>
          <p className="batch-log__muted batch-log__card-desc">
            상담 신청이 들어오면 신청자 번호(Monday 전화번호와 같은 번호)로
            보냅니다. 발신 번호는 SOLAPI에 등록된 번호여야 합니다.
          </p>
          <label className="inquiry-log__toggle">
            <input
              type="checkbox"
              checked={draft.smsEnabled}
              onChange={(event) =>
                actions.updateDraft({ smsEnabled: event.target.checked })
              }
            />
            문자 보내기
          </label>
          <label className="inquiry-log__field">
            <span>발신 번호</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="18777971"
              value={draft.senderNumber}
              onChange={(event) =>
                actions.updateDraft({ senderNumber: event.target.value })
              }
            />
          </label>
          <label className="inquiry-log__field">
            <span>
              장문 제목 — 내용이 {SMS_MAX_BYTES}byte를 넘어 장문(LMS)으로 갈
              때 붙습니다 · {subjectBytes}/{LMS_SUBJECT_MAX_BYTES}byte
            </span>
            <input
              type="text"
              placeholder="[엑스툴] 상담 신청 접수 안내"
              aria-invalid={subjectBytes > LMS_SUBJECT_MAX_BYTES}
              value={draft.subject}
              onChange={(event) =>
                actions.updateDraft({ subject: event.target.value })
              }
            />
          </label>
          <label className="inquiry-log__field">
            <span>문자 내용 — 쓸 수 있는 값: {TEMPLATE_TOKENS.join(' ')}</span>
            <textarea
              rows={4}
              value={draft.template}
              onChange={(event) =>
                actions.updateDraft({ template: event.target.value })
              }
            />
          </label>
          <p className="inquiry-log__preview">
            <span>
              미리보기 · {bytes}byte ·{' '}
              {isLms ? 'LMS(장문)' : 'SMS(단문)'}
            </span>
            {isLms && draft.subject.trim() && (
              <strong>{draft.subject.trim()}</strong>
            )}
            {preview}
          </p>
          <div className="inquiry-log__settings-actions">
            {settingsMessage && (
              <span className="batch-log__muted">{settingsMessage}</span>
            )}
            <button
              type="button"
              className="batch-log__refresh"
              disabled={!dirty || saving}
              onClick={() => void actions.saveSettings()}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </section>
      )}

      {status === 'error' && (
        <p className="batch-log__card batch-log__error">
          상담 신청 기록을 불러오지 못했습니다: {error}
        </p>
      )}
      {actionError && (
        <p className="batch-log__card batch-log__error">{actionError}</p>
      )}

      <section className="batch-log__totals" aria-label="기간 요약">
        <div>
          <span>상담 신청</span>
          <strong>{summary.total.toLocaleString('ko-KR')}건</strong>
        </div>
        <div>
          <span>Monday 등록</span>
          <strong>{summary.mondayOk.toLocaleString('ko-KR')}건</strong>
        </div>
        <div>
          <span>Monday 미등록</span>
          <strong className={summary.mondayFailed ? 'is-failed' : ''}>
            {summary.mondayFailed.toLocaleString('ko-KR')}건
          </strong>
        </div>
        <div>
          <span>문자 발송</span>
          <strong>{summary.smsOk.toLocaleString('ko-KR')}건</strong>
        </div>
        <div>
          <span>문자 실패</span>
          <strong className={summary.smsFailed ? 'is-failed' : ''}>
            {summary.smsFailed.toLocaleString('ko-KR')}건
          </strong>
        </div>
        <div>
          <span>마지막 조회</span>
          <strong className="is-small">
            {fetchedAt
              ? `${formatDateTime(fetchedAt).slice(-8)} (${formatAgo(fetchedAt, now)})`
              : status === 'loading'
                ? '불러오는 중…'
                : '-'}
          </strong>
        </div>
      </section>

      <section className="batch-log__card">
        <div className="inquiry-log__toolbar">
          <label className="inquiry-log__search">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle
                cx="9"
                cy="9"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="m13.5 13.5 3 3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              placeholder="고객명 · 전화번호 검색"
              aria-label="고객명 또는 전화번호로 검색"
              value={search}
              onChange={(event) => actions.changeSearch(event.target.value)}
            />
          </label>
          <DeviceSelect
            value={device}
            options={INQUIRY_DEVICES.map((each) => ({
              value: each.device,
              label: each.label,
              count: deviceCounts.get(each.device) ?? 0,
            }))}
            onChange={actions.changeDevice}
          />
          <span className="batch-log__muted inquiry-log__count">
            {rows.length.toLocaleString('ko-KR')}건
          </span>
          {selected.size > 0 && (
            <div className="inquiry-log__bulk">
              <span>{selected.size}건 선택</span>
              <button
                type="button"
                className="inquiry-log__delete"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? '지우는 중…' : '선택 삭제'}
              </button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="batch-log__empty">
            {status === 'loading'
              ? '불러오는 중…'
              : search || device
                ? '검색 조건에 맞는 신청이 없습니다.'
                : filter === 'problem'
                  ? '확인이 필요한 신청이 없습니다.'
                  : '이 기간에 들어온 상담 신청이 없습니다.'}
          </p>
        ) : (
          <div className="batch-log__table-scroll">
            <table className="batch-log__table">
              <thead>
                <tr>
                  <th className="inquiry-log__check-cell">
                    <input
                      type="checkbox"
                      className="inquiry-log__check"
                      aria-label="보이는 기록 전체 선택"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            visibleSelected > 0 && !allVisibleSelected
                        }
                      }}
                      onChange={actions.toggleSelectAll}
                    />
                  </th>
                  <th>접수 시각</th>
                  <th>기기</th>
                  <th>고객명</th>
                  <th>전화번호</th>
                  <th>유입</th>
                  <th>Monday</th>
                  <th>문자</th>
                  <th aria-label="펼치기" />
                </tr>
              </thead>
              <tbody>
                {rows.map((inquiry) => {
                  const open = openId === inquiry.id
                  return (
                    <Fragment key={inquiry.id}>
                      <tr
                        className={`batch-log__row${open ? ' is-open' : ''}`}
                        onClick={() => actions.toggleOpen(inquiry.id)}
                      >
                        <td
                          className="inquiry-log__check-cell"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="inquiry-log__check"
                            aria-label={`${inquiry.name || inquiry.phoneFormatted} 선택`}
                            checked={selected.has(inquiry.id)}
                            onChange={() => actions.toggleSelect(inquiry.id)}
                          />
                        </td>
                        <td>{formatDateTime(inquiry.receivedAt)}</td>
                        <td>{inquiry.boardName}</td>
                        <td>
                          {/* B2B는 회사명을 앞에 — Monday 아이템 이름과 같다. */}
                          {inquiry.company
                            ? `${inquiry.company} · ${inquiry.name || '-'}`
                            : inquiry.name || '-'}
                        </td>
                        <td>{inquiry.phoneFormatted}</td>
                        <td>
                          {[inquiry.utmSource, inquiry.utmMedium]
                            .filter(Boolean)
                            .join(' / ') || '-'}
                        </td>
                        <td>
                          <StepBadge status={inquiry.monday.status} />
                        </td>
                        <td>
                          <StepBadge status={inquiry.sms.status} />
                        </td>
                        <td className="batch-log__caret" aria-hidden="true">
                          {open ? '▾' : '▸'}
                        </td>
                      </tr>
                      {open && (
                        <tr className="batch-log__detail-row">
                          <td colSpan={9}>
                            <InquiryDetail
                              inquiry={inquiry}
                              retrying={retrying}
                              onRetry={(id, step) =>
                                void actions.retry(id, step)
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
