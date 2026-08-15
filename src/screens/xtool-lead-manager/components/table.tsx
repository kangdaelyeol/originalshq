import {
  DEVICE_OPTIONS,
  type Device,
  type EditingCell,
  type EditingField,
  type Lead,
  type LeadState,
  type SortDirection,
  type SortField,
  type TableFold,
} from '@/screens/xtool-lead-manager/types'
import {
  formatPhoneNumber,
  formatTime,
} from '@/screens/xtool-lead-manager/utils'
import { SortButton } from '@/screens/xtool-lead-manager/components/sort-button'

interface TableActions {
  toggleFold: (field: LeadState) => void
  toggleAllChecked: () => void
  toggleSort: (field: SortField) => void
  startEditing: (rowId: string, field: EditingField) => void
  updateCellValue: (rowId: string, field: EditingField, value: string) => void
  stopEditing: () => void
  showDetail: (rowId: string) => void
  handleEditingKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  updateDevice: (rowId: string, device: Device) => void
  deleteRow: (rowId: string) => void
  registerRow: (rowId: string) => Promise<void>
}

interface TableState {
  fold: TableFold
  allChecked: boolean
  sortField: SortField
  sortDirection: SortDirection
  editingCell: EditingCell | null
  rows: Lead[]
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
    updateCellValue,
    startEditing,
    stopEditing,
    showDetail,
    handleEditingKeyDown,
    updateDevice,
    deleteRow,
    registerRow,
    toggleFold,
  } = actions

  const { allChecked, sortField, sortDirection, rows, editingCell, fold } =
    state

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
                columnKey="createdAt"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item fn">
              고객명
              <SortButton
                columnKey="fn"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item ph">
              전화번호
              <SortButton
                columnKey="ph"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
            <div className="item device">상담기기</div>
            {type !== 'new' && <div className="item price">구매금액</div>}
            {type === 'purchased' && (
              <div className="item purchased">구매시각</div>
            )}
          </div>

          <div className="row_section">
            {rows
              .filter((row) => row.state === type)
              .map((row) => {
                const isEditingFn =
                  editingCell?.rowId === row.id && editingCell?.field === 'fn'
                const isEditingPh =
                  editingCell?.rowId === row.id && editingCell?.field === 'ph'
                const isEditingPrice =
                  editingCell?.rowId === row.id &&
                  editingCell?.field === 'price'
                return (
                  <div className="table_row" key={row.id}>
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

                    <div className="item created">
                      {formatTime(row.createdAt)}
                    </div>

                    <div
                      className="item fn editable"
                      onClick={() => !isEditingFn && startEditing(row.id, 'fn')}
                    >
                      {isEditingFn ? (
                        <input
                          autoFocus
                          value={row.fn}
                          onChange={(e) =>
                            updateCellValue(row.id, 'fn', e.target.value)
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <span>{row.fn}</span>
                      )}
                    </div>

                    <div
                      className="item ph editable"
                      onClick={() => !isEditingPh && startEditing(row.id, 'ph')}
                    >
                      {isEditingPh ? (
                        <input
                          autoFocus
                          value={row.ph}
                          onChange={(e) =>
                            updateCellValue(row.id, 'ph', e.target.value)
                          }
                          onBlur={stopEditing}
                          onKeyDown={handleEditingKeyDown}
                        />
                      ) : (
                        <span>{formatPhoneNumber(row.ph)}</span>
                      )}
                    </div>

                    <div className="item device">
                      <select
                        value={row.device}
                        onChange={(e) =>
                          updateDevice(row.id, e.target.value as Device)
                        }
                      >
                        {DEVICE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    {type !== 'new' && (
                      <div
                        className="item price editable"
                        onClick={() =>
                          !isEditingPrice && startEditing(row.id, 'price')
                        }
                      >
                        {isEditingPrice ? (
                          <input
                            autoFocus
                            value={row.price}
                            onChange={(e) =>
                              updateCellValue(row.id, 'price', e.target.value)
                            }
                            onBlur={stopEditing}
                            onKeyDown={handleEditingKeyDown}
                          />
                        ) : (
                          <span>{row.price}</span>
                        )}
                      </div>
                    )}
                    {type === 'purchased' && (
                      <div
                        className="item purchased"
                        onClick={() =>
                          !isEditingPrice && startEditing(row.id, 'price')
                        }
                      >
                        <span>{formatTime(row.purchasedAt)}</span>
                      </div>
                    )}
                    {type !== 'purchased' && (
                      <>
                        <div className="item register">
                          <button
                            type="button"
                            className="register-btn"
                            onClick={() => registerRow(row.id)}
                          >
                            등록
                          </button>
                        </div>

                        <div className="item delete">
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => deleteRow(row.id)}
                          >
                            삭제
                          </button>
                        </div>
                      </>
                    )}

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
