import {
  EditingField,
  SortField,
  type EditingCell,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'
import {
  displayName,
  formatPhoneNumber,
  formatTime,
  toDatetimeLocalValue,
} from '@/screens/xtool-lead-manager/utils'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import type {
  ConsultationRecord,
  Lead,
  PurchaseRecord,
} from '@/screens/xtool-lead-manager/entity'

interface TableActions {
  toggleAllChecked: () => void
  toggleSort: (field: SortField) => void
  startEditing: (rowId: string, field: EditingField) => void
  handleFieldChange: (rowId: string, field: EditingField, value: string) => void
  stopEditing: () => void
  showDetail: (rowId: string) => void
  handleEditingKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  deleteRow: (rowId: string) => void
  registerConsultationRow: (rowId: string) => void
  registerPurchaseRow: (rowId: string) => void
  toggleTestRow: (rowId: string) => void
  updateTestEventCode: (rowId: string, code: string) => void
}

interface TableState {
  allChecked: boolean
  sortField: SortField
  sortDirection: SortDirection
  editingCell: EditingCell | null
  rows: Lead[]
  /** 행마다 "테스트" 체크 여부 + test_event_code 입력값 — 등록(contactLead/
   * purchaseLead)에 얹어 보낼 값이라 Lead 데이터와 별개로 rowId로만 관리한다. */
  testRows: Record<string, { checked: boolean; code: string }>
}

interface TableProps {
  state: TableState
  actions: TableActions
}

const latestAt = (records: { at: number }[]): number =>
  records.reduce((max, r) => Math.max(max, r.at), 0)

const consultationTitle = (records: ConsultationRecord[]): string =>
  records
    .map((r) => `${formatTime(r.at)} · ${r.device}`)
    .reverse()
    .join('\n')

const purchaseTitle = (records: PurchaseRecord[]): string =>
  records
    .map(
      (r) =>
        `${formatTime(r.at)} · ${r.device} · ${r.price.toLocaleString('ko-KR')}원`,
    )
    .reverse()
    .join('\n')

/**
 * 예전엔 div + flex로 "표처럼 보이게만" 짠 구조라, 헤더와 행의 칸 개수·폭을
 * 수동으로 맞춰야 했다(실제로 register/delete/detail 헤더 칸이 통째로 빠져있던
 * 버그, 표마다 필요한 폭이 다른데 min-width 하나를 공유해 칸이 찌그러지던
 * 버그가 둘 다 여기서 비롯됐다). cmip처럼 진짜 <table>로 바꾸면 브라우저가
 * 헤더·행의 컬럼 폭을 항상 같은 기준으로 맞춰주므로 이 종류의 버그 자체가
 * 안 생긴다.
 *
 * 상담/구매를 다건으로 지원하면서 신규유입/상담완료/구매완료 3개 보드로
 * 나눌 이유가 없어져 표 하나로 통합했다 — 각 행에는 항상 "상담 등록"/
 * "구매 등록" 버튼이 함께 있고, 고객명을 누르면 그 고객의 상담·구매 이력을
 * 모달로 볼 수 있다.
 */
export const Table = ({ state, actions }: TableProps) => {
  const {
    toggleAllChecked,
    toggleSort,
    handleFieldChange,
    startEditing,
    stopEditing,
    showDetail,
    handleEditingKeyDown,
    deleteRow,
    registerConsultationRow,
    registerPurchaseRow,
    toggleTestRow,
    updateTestEventCode,
  } = actions

  const { allChecked, sortField, sortDirection, rows, editingCell, testRows } =
    state

  return (
    <div className="table_container">
      <div className="table">
        <div className="table_scroll">
          <table className="lead_table">
            <thead>
              <tr>
                <th className="col-cb">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allChecked}
                    onClick={toggleAllChecked}
                    className={[allChecked ? 'checked' : '', 'check-btn'].join(
                      ' ',
                    )}
                  >
                    {allChecked && (
                      <svg viewBox="0 0 14 14" fill="none">
                        <path
                          pathLength={40}
                          d="M3 7.2 5.6 10 11 4"
                          stroke="#eeeeee"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={40}
                        />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="col-created">
                  접수일
                  <SortButton
                    columnKey={SortField.CREATED_AT}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-fn">
                  고객명
                  <SortButton
                    columnKey={SortField.FIRST_NAME}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-ph">
                  전화번호
                  <SortButton
                    columnKey={SortField.PHONE}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </th>
                <th className="col-remarks">비고</th>
                <th className="col-status">상담 현황</th>
                <th className="col-status">구매 현황</th>
                <th className="col-test">테스트</th>
                <th className="col-register" aria-hidden="true" />
                <th className="col-register" aria-hidden="true" />
                <th className="col-delete" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditingFn =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.FIRST_NAME
                const isEditingPh =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.PHONE
                const isEditingRemarks =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.REMARKS
                const isEditingCreatedAt =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.CREATED_AT
                // 마이그레이션 전의 옛 리드 문서엔 이 배열 필드 자체가 없을 수
                // 있어(Firestore에 값이 없던 필드는 undefined로 온다) 방어적으로
                // 기본값을 준다.
                const consultations = row.consultations ?? []
                const purchases = row.purchases ?? []

                return (
                  <tr key={row.id}>
                    {/* Checkbox Cell */}
                    <td className="col-cb">
                      <button
                        type="button"
                        role="checkbox"
                        className={[
                          allChecked ? 'checked' : '',
                          'check-btn',
                        ].join(' ')}
                        aria-checked={false}
                      >
                        {allChecked && (
                          <svg viewBox="0 0 14 14" fill="none">
                            <path
                              pathLength={40}
                              d="M3 7.2 5.6 10 11 4"
                              stroke="#eeeeee"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={40}
                            />
                          </svg>
                        )}
                      </button>
                    </td>

                    {/* CreatedAt cell */}
                    <td
                      className="col-created editable"
                      onClick={() =>
                        !isEditingCreatedAt &&
                        startEditing(row.id, EditingField.CREATED_AT)
                      }
                    >
                      {isEditingCreatedAt ? (
                        <input
                          autoFocus
                          type="datetime-local"
                          value={toDatetimeLocalValue(row.createdAt)}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              EditingField.CREATED_AT,
                              e.target.value,
                            )
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <span>
                          {row.createdAt !== 0
                            ? formatTime(row.createdAt)
                            : '등록하기'}
                        </span>
                      )}
                    </td>

                    {/* First name Cell — 클릭하면 이력 모달이 아니라 인라인
                        수정(다른 필드와 동일), 이력 모달은 이름 옆 버튼으로 연다. */}
                    <td
                      className="col-fn editable"
                      onClick={() =>
                        !isEditingFn &&
                        startEditing(row.id, EditingField.FIRST_NAME)
                      }
                    >
                      {isEditingFn ? (
                        <input
                          autoFocus
                          value={row.fn}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              EditingField.FIRST_NAME,
                              e.target.value,
                            )
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <button
                          type="button"
                          className="name-link"
                          onClick={(e) => {
                            e.stopPropagation()
                            showDetail(row.id)
                          }}
                        >
                          {displayName(row.fn)}
                        </button>
                      )}
                    </td>

                    {/* Phone number Cell */}
                    <td
                      className="col-ph editable"
                      onClick={() =>
                        !isEditingPh &&
                        startEditing(row.id, EditingField.PHONE)
                      }
                    >
                      {isEditingPh ? (
                        <input
                          autoFocus
                          value={row.ph}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              EditingField.PHONE,
                              e.target.value,
                            )
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <span>{formatPhoneNumber(row.ph)}</span>
                      )}
                    </td>

                    {/* Remarks cell — 회사명/직책/동반 구매자 등 내부 참고용 메모 */}
                    <td
                      className="col-remarks editable"
                      onClick={() =>
                        !isEditingRemarks &&
                        startEditing(row.id, EditingField.REMARKS)
                      }
                    >
                      {isEditingRemarks ? (
                        <input
                          autoFocus
                          value={row.remarks}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              EditingField.REMARKS,
                              e.target.value,
                            )
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <span>{row.remarks || '-'}</span>
                      )}
                    </td>

                    {/* Consultation status cell */}
                    <td
                      className="col-status"
                      title={consultationTitle(consultations)}
                    >
                      {consultations.length > 0 ? (
                        <div className="status_stack">
                          <span className="count">
                            {consultations.length}건
                          </span>
                          <span className="latest">
                            {formatTime(latestAt(consultations))}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* Purchase status cell */}
                    <td
                      className="col-status"
                      title={purchaseTitle(purchases)}
                    >
                      {purchases.length > 0 ? (
                        <div className="status_stack">
                          <span className="count">{purchases.length}건</span>
                          <span className="latest">
                            {formatTime(latestAt(purchases))}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>

                    {/* Test checkbox + test_event_code — 켜두면 다음 등록
                        (상담/구매 무관) 클릭 때 Meta CAPI 호출에 test_event_code가
                        실려 나가 이벤트 관리자의 테스트 이벤트로 잡힌다. */}
                    <td className="col-test">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={testRows[row.id]?.checked ?? false}
                        onClick={() => toggleTestRow(row.id)}
                        className={[
                          testRows[row.id]?.checked ? 'checked' : '',
                          'check-btn',
                        ].join(' ')}
                      >
                        {testRows[row.id]?.checked && (
                          <svg viewBox="0 0 14 14" fill="none">
                            <path
                              pathLength={40}
                              d="M3 7.2 5.6 10 11 4"
                              stroke="#eeeeee"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={40}
                            />
                          </svg>
                        )}
                      </button>
                      {testRows[row.id]?.checked && (
                        <input
                          className="test-event-code-input"
                          placeholder="test_event_code"
                          value={testRows[row.id]?.code ?? ''}
                          onChange={(e) =>
                            updateTestEventCode(row.id, e.target.value)
                          }
                        />
                      )}
                    </td>

                    {/* Register consultation button */}
                    <td className="col-register">
                      <button
                        type="button"
                        className="register-btn"
                        onClick={() => registerConsultationRow(row.id)}
                      >
                        상담 등록
                      </button>
                    </td>

                    {/* Register purchase button */}
                    <td className="col-register">
                      <button
                        type="button"
                        className="register-btn purchase"
                        onClick={() => registerPurchaseRow(row.id)}
                      >
                        구매 등록
                      </button>
                    </td>

                    {/* Delete button */}
                    <td className="col-delete">
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteRow(row.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
