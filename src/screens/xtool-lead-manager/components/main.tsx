import '@/screens/xtool-lead-manager/styles/main.scss'
import { SearchIcon } from '../illustration'
import { useRef, useState } from 'react'
import { CloseIcon } from './close-icon'
import { useOutsideClick } from '../hooks/use-outside-click'

const DayMill = 1000 * 60 * 60 * 24

const DEVICE_OPTIONS = ['metalfab', 'f2ultra', 'f2ultrauv', 'p3', 'dtf']

type Row = {
  id: number
  fn: string
  ph: string
  device: string
  createdAt: number
  registered: boolean
  registering: boolean
}

const initialData: Row[] = [
  {
    id: 1,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
  },
  {
    id: 2,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill,
    registered: false,
    registering: false,
  },
  {
    id: 3,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill * 2,
    registered: false,
    registering: false,
  },
  {
    id: 4,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() + DayMill * 3,
    registered: false,
    registering: false,
  },
]

type EditingCell = {
  rowId: number
  field: 'fn' | 'ph'
} | null

async function registerCustomerCAPI(row: Row): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return { success: true }
}

export const Main = () => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Row[]>(initialData)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useOutsideClick(searchRef, () => {
    if (searchValue) return
    setSearchActive(false)
    setSearchValue('')
  })

  const typed = !!searchValue

  const activeSearch = () => {
    setSearchActive(true)
  }

  const toggleAllChecked = () => {
    setAllChecked((prev) => !prev)
  }

  const startEditing = (rowId: number, field: 'fn' | 'ph') => {
    setEditingCell({ rowId, field })
  }

  const updateCellValue = (
    rowId: number,
    field: 'fn' | 'ph',
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    )
  }

  const stopEditing = () => {
    setEditingCell(null)
  }

  const updateDevice = (rowId: number, device: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, device } : row)),
    )
  }

  const deleteRow = (rowId: number) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  const registerRow = async (rowId: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, registering: true } : row,
      ),
    )

    const target = rows.find((row) => row.id === rowId)
    if (!target) return

    try {
      const result = await registerCustomerCAPI(target)
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? { ...row, registering: false, registered: result.success }
            : row,
        ),
      )
    } catch (e) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, registering: false } : row,
        ),
      )
    }
  }

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
                onChange={(e) => setSearchValue(e.target.value)}
              />
              {typed && (
                <div className="reset-btn">
                  <CloseIcon
                    onClick={() => {
                      setSearchValue('')
                    }}
                  />
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
