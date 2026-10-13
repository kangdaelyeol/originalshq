import type { Lead } from '@/screens/xtool-lead-manager/entity'
import type { EditingField } from '@/screens/xtool-lead-manager/types'
import {
  buildMondayCopyFields,
  emptyLeadFields,
  formatMondayDate,
  formatWon,
} from '@/screens/xtool-lead-manager/utils'
import type { useLeadMondayMatchViewModel } from '@/screens/xtool-lead-manager/view-model'
import '@/screens/xtool-lead-manager/styles/monday.scss'

type MondayMatch = ReturnType<typeof useLeadMondayMatchViewModel>['state']

/**
 * 리드 상세 옆의 Monday 패널 — 이 리드와 전화번호가 같은 Monday 고객을
 * 보여주고, 그 값을 리드의 필드로 복사한다.
 *
 * 복사는 한 방향(Monday → 리드)이고, 리드의 기존 수정 경로(onCopy =
 * updateLeadField)를 그대로 탄다 — 직접 입력해 저장한 것과 결과가 같다.
 * Monday 쪽은 바뀌지 않는다.
 */
export const DetailMondayPanel = ({
  lead,
  match,
  onCopy,
  onFillEmpty,
  onOpenInMonday,
}: {
  lead: Lead
  match: MondayMatch
  onCopy: (field: EditingField, value: string) => void
  /** 리드에서 비어 있는 필드를 한 번에 채운다. */
  onFillEmpty: (values: { field: EditingField; value: string }[]) => void
  /** Monday 고객 탭으로 넘어가 이 고객의 전체 기록을 연다. */
  onOpenInMonday: (phone: string) => void
}) => {
  const { status, customer } = match

  if (status !== 'matched' || !customer) {
    return (
      <aside className="detail_monday_panel">
        <div className="detail_monday_head">
          <span className="title">Monday</span>
        </div>
        <p className="detail_monday_message">
          {status === 'loading' && 'Monday에서 같은 번호를 찾는 중…'}
          {status === 'none' && 'Monday에 같은 전화번호의 고객이 없습니다.'}
          {status === 'error' && 'Monday 고객 정보를 불러오지 못했습니다.'}
        </p>
      </aside>
    )
  }

  const { summary } = customer
  const fields = buildMondayCopyFields(lead, customer)
  const fillable = emptyLeadFields(fields)

  return (
    <aside className="detail_monday_panel">
      <div className="detail_monday_head">
        <span className="title">Monday</span>
        <button
          type="button"
          className="detail_monday_open"
          onClick={() => onOpenInMonday(customer.phone)}
        >
          전체 기록 보기
        </button>
      </div>

      <div className="detail_monday_scroll">
        {/* 이 고객이 Monday에서 어디까지 갔는지 한눈에. */}
        <dl className="detail_monday_summary">
          <div>
            <dt>상담</dt>
            <dd>
              {summary.consultationCount}건
              {summary.latestConsultationStatus && (
                <small>{summary.latestConsultationStatus}</small>
              )}
            </dd>
          </div>
          <div>
            <dt>방문체험</dt>
            <dd>
              {summary.visitCount}건
              {summary.latestVisitAt && (
                <small>{formatMondayDate(summary.latestVisitAt)}</small>
              )}
            </dd>
          </div>
          <div>
            <dt>구매</dt>
            <dd>
              {summary.purchaseCount}건
              {summary.purchaseCount > 0 && (
                <small>{formatWon(summary.purchaseAmount)}</small>
              )}
            </dd>
          </div>
        </dl>

        <div className="detail_monday_copy_head">
          <span>리드로 복사</span>
          {fillable.length > 0 && (
            <button
              type="button"
              className="detail_monday_fill"
              onClick={() => onFillEmpty(fillable)}
            >
              빈 칸 {fillable.length}개 채우기
            </button>
          )}
        </div>

        {fields.length === 0 && (
          <p className="detail_monday_message">
            Monday에 복사할 수 있는 값이 없습니다.
          </p>
        )}

        {fields.map((field) => (
          <div className="detail_monday_field" key={field.field}>
            <span className="label">{field.label}</span>
            <ul>
              {field.candidates.map((candidate) => {
                const same = candidate === field.leadValue.trim()
                return (
                  <li key={candidate}>
                    <span className="value" title={candidate}>
                      {candidate}
                    </span>
                    {same ? (
                      <span className="same">리드와 같음</span>
                    ) : (
                      <button
                        type="button"
                        className="copy"
                        onClick={() => onCopy(field.field, candidate)}
                      >
                        {field.leadValue.trim() ? '바꾸기' : '복사'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  )
}
