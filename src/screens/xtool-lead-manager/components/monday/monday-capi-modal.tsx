import '@/screens/xtool-lead-manager/styles/monday-capi.scss'
import { useRef, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Send, X } from 'lucide-react'
import { Segmented } from '@/components/glass'
import { Device } from '@/screens/xtool-lead-manager/entity'
import type { CreateLeadFormValues } from '@/screens/xtool-lead-manager/types'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import {
  formatMondayDate,
  formatMondayPhone,
  formatWon,
  MONDAY_CAPI_KIND_LABEL,
} from '@/screens/xtool-lead-manager/utils'
import type {
  MondayCapiTarget,
  useMondayCapiViewModel,
} from '@/screens/xtool-lead-manager/view-model'

type MondayCapi = ReturnType<typeof useMondayCapiViewModel>

const META_EVENT = { consultation: 'Contact', purchase: 'Purchase' } as const

// 조사 — 상담을/구매를, 상담이/구매가.
const OBJECT = { consultation: '상담을', purchase: '구매를' } as const
const SUBJECT = { consultation: '상담이', purchase: '구매가' } as const

const TARGET_LABEL: Record<MondayCapiTarget, string> = {
  existing: '이 리드에 추가',
  new: '새 리드로 등록',
}

const Row = ({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) => (
  <div className="monday_capi_row">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
  </div>
)

/** 글자 입력 한 칸 — 폼 값 이름이 곧 id 뒤쪽. */
const TextRow = ({
  label,
  field,
  form,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  field: keyof CreateLeadFormValues
  form: CreateLeadFormValues
  onChange: (field: keyof CreateLeadFormValues, value: string) => void
  type?: string
  placeholder?: string
}) => (
  <Row label={label} htmlFor={`monday-capi-${field}`}>
    <input
      id={`monday-capi-${field}`}
      type={type}
      className="monday_capi_control"
      value={String(form[field])}
      placeholder={placeholder}
      onChange={(event) => onChange(field, event.target.value)}
    />
  </Row>
)

/**
 * Monday 기록 → Meta CAPI 전송 확인 모달. 기록으로 미리 채운 폼을 고쳐서
 * "전송"을 눌러야 실제로 보낸다. 리드 탭에 같은 번호의 리드가 있으면 그
 * 리드에 더하고(고객 정보는 그 리드 것으로 보낸다), 없으면 새 리드를 만든다.
 */
export const MondayCapiModal = ({ capi }: { capi: MondayCapi }) => {
  const { state, actions } = capi
  const {
    source,
    form,
    leadsStatus,
    match,
    target,
    useExisting,
    sameDay,
    sending,
    error,
    result,
  } = state
  const closeRef = useRef<HTMLButtonElement>(null)
  useModal(actions.close, closeRef)
  if (!source) return null

  const kindLabel = MONDAY_CAPI_KIND_LABEL[source.kind]
  const event = META_EVENT[source.kind]
  const sourceDate =
    source.kind === 'consultation'
      ? source.record.receivedAt
      : source.record.paidAt

  return (
    <div className="monday_capi_backdrop" onClick={actions.close}>
      <div
        className="monday_capi"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monday-capi-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="monday_capi_head">
          <div>
            <h2 id="monday-capi-title">
              {kindLabel} CAPI 전송 <span>Meta {event}</span>
            </h2>
            <p>
              {formatMondayDate(sourceDate)} · {source.record.boardName}
              {source.kind === 'purchase' &&
                ` · ${formatWon(source.record.amount)}`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="monday_capi_close"
            aria-label="닫기"
            onClick={actions.close}
            disabled={sending}
          >
            <X strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        {result ? (
          <div className={`monday_capi_result${result.ok ? '' : ' is-error'}`}>
            {result.ok ? (
              <>
                <CheckCircle2 strokeWidth={1.8} aria-hidden="true" />
                <strong>Meta {event} 전송 완료</strong>
                <p>
                  {result.created ? '새 리드' : '리드 탭의'}{' '}
                  {result.lead.fn || formatMondayPhone(result.lead.ph)}에{' '}
                  {kindLabel} 1건을 더했습니다.
                </p>
                {result.eventId && (
                  <code title="이벤트 관리자에서 찾을 때">
                    event_id {result.eventId}
                  </code>
                )}
              </>
            ) : (
              <>
                <AlertTriangle strokeWidth={1.8} aria-hidden="true" />
                <strong>
                  {result.leadCreated
                    ? `리드는 만들었지만 ${kindLabel} 등록(CAPI)에 실패했습니다`
                    : '전송하지 못했습니다'}
                </strong>
                <p>{result.message}</p>
                {result.leadCreated && (
                  <p>
                    같은 고객을 다시 만들지 말고, 리드 탭에서 그 리드의{' '}
                    {kindLabel} 등록을 다시 시도해 주세요.
                  </p>
                )}
              </>
            )}
            <div className="monday_capi_actions">
              <button
                type="button"
                className="is-primary"
                onClick={actions.close}
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 보낼 곳 — 리드 탭에 같은 번호가 있는지. */}
            <div className="monday_capi_target">
              {leadsStatus === 'loading' && (
                <p>리드 탭에서 같은 번호를 찾는 중…</p>
              )}
              {leadsStatus === 'error' && (
                <p className="is-warn">
                  리드 목록을 불러오지 못해 같은 번호를 확인하지 못했습니다.
                  이대로 보내면 새 리드를 만듭니다.
                </p>
              )}
              {leadsStatus === 'ready' && !match && (
                <p>
                  리드 탭에 같은 번호가 없어 새 리드를 만들고{' '}
                  {OBJECT[source.kind]} 등록합니다.
                </p>
              )}
              {match && (
                <>
                  <div className="monday_capi_match">
                    <div>
                      <strong>{match.fn || '이름 없음'}</strong>
                      <span>
                        {formatMondayPhone(match.ph)} · 상담{' '}
                        {match.consultations?.length ?? 0} · 구매{' '}
                        {match.purchases?.length ?? 0}
                      </span>
                    </div>
                    <Segmented
                      options={TARGET_LABEL}
                      value={target}
                      onChange={actions.changeTarget}
                      label="보낼 곳"
                    />
                  </div>
                  <p>
                    {useExisting
                      ? `리드 탭에 같은 번호의 리드가 있어 그 리드에 ${OBJECT[source.kind]} 더합니다. CAPI의 고객 정보(이름·이메일·fbc 등)는 그 리드에 저장된 값으로 보냅니다.`
                      : '같은 번호의 리드가 있지만 새 리드를 하나 더 만듭니다.'}
                  </p>
                  {useExisting && sameDay > 0 && (
                    <p className="is-warn">
                      이 리드에 같은 날 {SUBJECT[source.kind]} 이미 {sameDay}건
                      있습니다. 같은 기록을 다시 보내면 Meta에 중복으로
                      잡힙니다.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="monday_capi_body">
              <p className="monday_capi_label">{event} 이벤트</p>
              <div className="monday_capi_grid">
                {/* 기본 select — 유리 Select의 목록은 스크롤되는 폼 안에서 잘린다. */}
                <Row label="기기" htmlFor="monday-capi-device">
                  <select
                    id="monday-capi-device"
                    className="monday_capi_control"
                    value={form.device}
                    onChange={(event) =>
                      actions.updateField('device', event.target.value)
                    }
                  >
                    {Object.values(Device).map((device) => (
                      <option key={device} value={device}>
                        {device}
                      </option>
                    ))}
                  </select>
                </Row>
                <TextRow
                  label={`${kindLabel} 시각`}
                  field="createdAt"
                  type="datetime-local"
                  form={form}
                  onChange={actions.updateField}
                />
                {source.kind === 'purchase' && (
                  <TextRow
                    label="구매 금액(원)"
                    field="price"
                    type="number"
                    form={form}
                    onChange={actions.updateField}
                  />
                )}
              </div>
              <label className="monday_capi_check">
                <input
                  type="checkbox"
                  checked={form.isTest}
                  onChange={actions.toggleTest}
                />
                테스트 이벤트로 전송
              </label>
              {form.isTest && (
                <Row label="test_event_code" htmlFor="monday-capi-test-code">
                  <input
                    id="monday-capi-test-code"
                    className="monday_capi_control"
                    placeholder="TEST12345"
                    value={form.testEventCode}
                    onChange={(event) =>
                      actions.changeTestCode(event.target.value)
                    }
                  />
                </Row>
              )}

              <p className="monday_capi_label">고객</p>
              <div className="monday_capi_grid">
                <TextRow
                  label="전화번호"
                  field="ph"
                  form={form}
                  onChange={actions.updateField}
                />
                {!useExisting && (
                  <>
                    <TextRow
                      label="이름"
                      field="fn"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="이메일"
                      field="em"
                      type="email"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="비고"
                      field="remarks"
                      form={form}
                      onChange={actions.updateField}
                    />
                  </>
                )}
              </div>

              {!useExisting && (
                <>
                  <p className="monday_capi_label">유입 추적</p>
                  <div className="monday_capi_grid">
                    <TextRow
                      label="utm_source"
                      field="utm_source"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="utm_medium"
                      field="utm_medium"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="utm_campaign"
                      field="utm_campaign"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="fbc"
                      field="fbc"
                      form={form}
                      onChange={actions.updateField}
                    />
                    <TextRow
                      label="fbp"
                      field="fbp"
                      form={form}
                      onChange={actions.updateField}
                    />
                  </div>
                </>
              )}
            </div>

            {error && <p className="monday_capi_error">{error}</p>}
            <div className="monday_capi_actions">
              <button type="button" onClick={actions.close} disabled={sending}>
                취소
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={actions.send}
                disabled={sending || leadsStatus === 'loading'}
              >
                <Send strokeWidth={1.8} aria-hidden="true" />
                {sending
                  ? '보내는 중…'
                  : useExisting
                    ? `이 리드에 ${kindLabel} 등록 + 전송`
                    : `새 리드 + ${kindLabel} 등록 + 전송`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
