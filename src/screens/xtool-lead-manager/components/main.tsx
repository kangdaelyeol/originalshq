import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'
import { CloseIcon } from './close-icon'
import { useMainViewModel } from '../view-model'
import { formatCreatedAt } from '../utils/format-created-at'

const DEVICE_OPTIONS = ['F2Ultra', 'F2UltraUV', 'P3', 'DTF', 'Metalfab']

export const Main = () => {
  const {
    state: {
      searchActive,
      allChecked,
      editingCell,
      typed,
      searchRef,
      searchValue,
      newReadFold,
      rows,
    },
    actions: {
      activeSearch,
      toggleAllChecked,
      startEditing,
      updateCellValue,
      stopEditing,
      updateDevice,
      deleteRow,
      registerRow,
      handleSearchChange,
      resetSearchValue,
      handleEditingKeyDown,
      toggleNewReadFold,
      createNewReadRow,
    },
  } = useMainViewModel()

  return (
    <div className="xtool-main">
      <div className="wrapper">
        <div className="nav">
          <SearchIcon />
          {searchActive ? (
            <div className="search-container" ref={searchRef}>
              <input
                className={['search-input', typed ? 'typed' : ''].join(' ')}
                type="text"
                name="search"
                id="search"
                autoFocus
                value={searchValue}
                onChange={handleSearchChange}
              />
              {typed && (
                <div className="reset-btn">
                  <CloseIcon onClick={resetSearchValue} />
                </div>
              )}
            </div>
          ) : (
            <button className="search-btn" onClick={activeSearch}>
              검색
            </button>
          )}
        </div>

        <div className="table_container">
          <div className="table_label" onClick={toggleNewReadFold}>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              width="16"
              height="16"
              aria-hidden="true"
              className={['arrow', newReadFold ? 'fold' : ''].join(' ')}
            >
              <path
                fill="currentColor"
                d="M12.76 10.56a.77.77 0 0 0 0-1.116L8.397 5.233a.84.84 0 0 0-1.157 0 .77.77 0 0 0 0 1.116l3.785 3.653-3.785 3.652a.77.77 0 0 0 0 1.117.84.84 0 0 0 1.157 0l4.363-4.211Z"
              ></path>
            </svg>
            신규 유입
          </div>
          {!newReadFold && (
            <div className="table">
              <div className="table_header">
                <div className="item cb">
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
                </div>
                <div className="item created">상담 시각</div>
                <div className="item fn">고객명</div>
                <div className="item ph">휴대폰 번호</div>
                <div className="item device">상담 기기</div>
              </div>

              {rows.map((row) => {
                const isEditingFn =
                  editingCell?.rowId === row.id && editingCell.field === 'fn'
                const isEditingPh =
                  editingCell?.rowId === row.id && editingCell.field === 'ph'

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
                      {formatCreatedAt(row.createdAt)}
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
                        <span>{row.ph}</span>
                      )}
                    </div>

                    <div className="item device">
                      <select
                        value={row.device}
                        onChange={(e) => updateDevice(row.id, e.target.value)}
                      >
                        {DEVICE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="item register">
                      {row.registered ? (
                        <span className="badge done">등록완료</span>
                      ) : (
                        <button
                          type="button"
                          className="register-btn"
                          disabled={row.registering}
                          onClick={() => registerRow(row.id)}
                        >
                          {row.registering ? '등록 중...' : '등록'}
                        </button>
                      )}
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
                  </div>
                )
              })}
              <div className="new-btn" onClick={createNewReadRow}>
                + 데이터 추가
              </div>
            </div>
          )}
          <div className="table_divider" />
        </div>
      </div>
    </div>
  )
}
