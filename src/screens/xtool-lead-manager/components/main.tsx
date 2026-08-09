import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'
import { CloseIcon } from './close-icon'
import { useMainViewModel } from '../view-model'

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

        <div className="table">
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
                    className="check-btn"
                    aria-checked={false}
                  />
                </div>

                <div className="item created">
                  {new Date(row.createdAt).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') stopEditing()
                        if (e.key === 'Escape') stopEditing()
                      }}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') stopEditing()
                        if (e.key === 'Escape') stopEditing()
                      }}
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
        </div>
      </div>
    </div>
  )
}
