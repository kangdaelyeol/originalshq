import {
  EditingField,
  SortField,
  type EditingCell,
  type SortDirection,
  type TableFold,
} from '@/screens/xtool-lead-manager/types'
import {
  displayName,
  formatPhoneNumber,
  formatTime,
  toDatetimeLocalValue,
} from '@/screens/xtool-lead-manager/utils'
import { SortButton } from '@/screens/xtool-lead-manager/components'
import {
  Device,
  LeadState,
  type Lead,
} from '@/screens/xtool-lead-manager/entity'

interface TableActions {
  toggleFold: (field: LeadState) => void
  toggleAllChecked: () => void
  toggleSort: (field: SortField) => void
  startEditing: (rowId: string, field: EditingField) => void
  handleFieldChange: (rowId: string, field: EditingField, value: string) => void
  stopEditing: () => void
  showDetail: (rowId: string) => void
  handleEditingKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleDeviceUpdate: (rowId: string, device: Device) => void
  deleteRow: (rowId: string) => void
  registerRow: (rowId: string) => Promise<void>
  toggleTestRow: (rowId: string) => void
  updateTestEventCode: (rowId: string, code: string) => void
}

interface TableState {
  fold: TableFold
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
  type: LeadState
}

export const Table = ({ state, actions, type }: TableProps) => {
  const {
    toggleAllChecked,
    toggleSort,
    handleFieldChange,
    startEditing,
    stopEditing,
    showDetail,
    handleEditingKeyDown,
    handleDeviceUpdate,
    deleteRow,
    registerRow,
    toggleFold,
    toggleTestRow,
    updateTestEventCode,
  } = actions

  const {
    allChecked,
    sortField,
    sortDirection,
    rows,
    editingCell,
    fold,
    testRows,
  } = state

  const tableLabel =
    type === 'new'
      ? '신규 유입'
      : type === 'contacted'
        ? '상담 완료'
        : '구매 완료'

  const tableLabelCN =
    type === 'new'
      ? 'new-read'
      : type === 'contacted'
        ? 'purchase-complete'
        : 'read-complete'

  return (
    <div className="table_container">
      <div
        className={['table_label', tableLabelCN].join(' ')}
        onClick={() => toggleFold(type)}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          width="16"
          height="16"
          aria-hidden="true"
          className={['arrow', fold[type] ? 'fold' : ''].join(' ')}
        >
          <path
            fill="currentColor"
            d="M12.76 10.56a.77.77 0 0 0 0-1.116L8.397 5.233a.84.84 0 0 0-1.157 0 .77.77 0 0 0 0 1.116l3.785 3.653-3.785 3.652a.77.77 0 0 0 0 1.117.84.84 0 0 0 1.157 0l4.363-4.211Z"
          ></path>
          {type === 'contacted' && (
            <path
              fill="currentColor"
              d="M12.76 10.56a.77.77 0 0 0 0-1.116L8.397 5.233a.84.84 0 0 0-1.157 0 .77.77 0 0 0 0 1.116l3.785 3.653-3.785 3.652a.77.77 0 0 0 0 1.117.84.84 0 0 0 1.157 0l4.363-4.211Z"
            ></path>
          )}
        </svg>
        {tableLabel}
      </div>
      {!fold[type] && (
        <div className="table">
          <div className={['table_left', tableLabelCN].join(' ')} />
          {/* Table Header Section */}
          <div className="table_header">
            <div className="item cb">
              <button
                type="button"
                role="checkbox"
                aria-checked={allChecked}
                onClick={toggleAllChecked}
                className={[allChecked ? 'checked' : '', 'check-btn'].join(' ')}
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
            </div>
            <div className="item created">
              상담 시각
              <SortButton
                columnKey={SortField.CREATED_AT}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item fn">
              고객명
              <SortButton
                columnKey={SortField.FIRST_NAME}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item ph">
              전화번호
              <SortButton
                columnKey={SortField.PHONE}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item device">상담기기</div>
            {type !== 'new' && <div className="item price">구매금액</div>}
            {type !== 'new' && <div className="item purchased">구매시각</div>}
            {/* 구매 완료 표엔 더 등록할 액션(등록 버튼)이 없어 테스트 체크도
                의미가 없으므로 같이 숨긴다. */}
            {type !== LeadState.PURCHASED && (
              <div className="item test">테스트</div>
            )}
            {/* 아래 행(table_row)엔 register/delete/detail 칸이 있는데 헤더엔
                대응하는 칸이 없어서, 폭이 좁아지면 헤더와 행의 칼럼 경계선이
                어긋나 보였다 — 내용 없는 칸이라도 폭을 맞춰 넣는다. */}
            {type !== LeadState.PURCHASED && <div className="item register" />}
            <div className="item delete" />
            <div className="item detail" />
          </div>

          {/* Table Rows Section */}
          <div className="row_section">
            {rows
              .filter((row) => row.state === type)
              .map((row) => {
                const isEditingFn =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.FIRST_NAME
                const isEditingPh =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.PHONE
                const isEditingPrice =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.PRICE
                const isEditingCreatedAt =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.CREATED_AT
                const isEditingPurchasedAt =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === EditingField.PURCHASED_AT

                return (
                  <div className="table_row" key={row.id}>
                    {/* Checkbox Cell */}
                    <div className="item cb">
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
                    </div>

                    {/* CreatedAt cell */}
                    <div
                      className="item created editable"
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
                    </div>

                    {/* First name Cell */}
                    <div
                      className="item fn editable"
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
                        <span>{displayName(row.fn)}</span>
                      )}
                    </div>

                    {/* Phone number Cell */}
                    <div
                      className="item ph editable"
                      onClick={() =>
                        !isEditingPh && startEditing(row.id, EditingField.PHONE)
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
                    </div>

                    {/* Device Cell */}
                    <div className="item device">
                      <select
                        value={row.device}
                        onChange={(e) =>
                          handleDeviceUpdate(row.id, e.target.value as Device)
                        }
                      >
                        {Object.values(Device).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Price Cell */}
                    {type !== LeadState.NEW && (
                      <div
                        className="item price editable"
                        onClick={() =>
                          !isEditingPrice &&
                          startEditing(row.id, EditingField.PRICE)
                        }
                      >
                        {isEditingPrice ? (
                          <input
                            autoFocus
                            value={row.price}
                            onChange={(e) =>
                              handleFieldChange(
                                row.id,
                                EditingField.PRICE,
                                e.target.value,
                              )
                            }
                            onBlur={stopEditing}
                            onKeyDown={handleEditingKeyDown}
                          />
                        ) : (
                          <span>{row.price}</span>
                        )}
                      </div>
                    )}

                    {/* PurchasedAt Cell */}
                    {type !== 'new' && (
                      <div
                        className="item purchased editable"
                        onClick={() =>
                          !isEditingPurchasedAt &&
                          startEditing(row.id, EditingField.PURCHASED_AT)
                        }
                      >
                        {isEditingPurchasedAt ? (
                          <input
                            autoFocus
                            type="datetime-local"
                            value={toDatetimeLocalValue(row.purchasedAt)}
                            onChange={(e) =>
                              handleFieldChange(
                                row.id,
                                EditingField.PURCHASED_AT,
                                e.target.value,
                              )
                            }
                            onBlur={stopEditing}
                            onKeyDown={handleEditingKeyDown}
                          />
                        ) : (
                          <span>
                            {row.purchasedAt !== 0
                              ? formatTime(row.purchasedAt)
                              : '등록하기'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Test checkbox + test_event_code — 켜두면 다음 "등록"
                        클릭 때 Meta CAPI 호출에 test_event_code가 실려 나가
                        이벤트 관리자의 테스트 이벤트로 잡힌다. */}
                    {type !== LeadState.PURCHASED && (
                      <div className="item test">
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
                      </div>
                    )}

                    {/* Register button */}
                    {type !== LeadState.PURCHASED && (
                      <div className="item register">
                        <button
                          type="button"
                          className="register-btn"
                          onClick={() => registerRow(row.id)}
                        >
                          등록
                        </button>
                      </div>
                    )}

                    {/* Delete button */}
                    <div className="item delete">
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteRow(row.id)}
                      >
                        삭제
                      </button>
                    </div>

                    {/* Detail button */}
                    <div className="item detail">
                      <button
                        type="button"
                        className="detail-btn"
                        onClick={() => showDetail(row.id)}
                      >
                        자세히 보기
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
