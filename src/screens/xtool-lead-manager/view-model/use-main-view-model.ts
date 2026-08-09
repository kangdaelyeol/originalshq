import { useRef, useState } from 'react'
import { useOutsideClick } from '../hooks/use-outside-click'

const DayMill = 1000 * 60 * 60 * 24

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

export const useMainViewModel = () => {
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  const resetSearchValue = () => {
    setSearchValue('')
  }

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
      console.log(e)
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, registering: false } : row,
        ),
      )
    }
  }

  return {
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
  }
}
