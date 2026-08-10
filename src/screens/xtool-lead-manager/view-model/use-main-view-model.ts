import { useRef, useState } from 'react'
import { useOutsideClick } from '../hooks/use-outside-click'

const DayMill = 1000 * 60 * 60 * 24

type UserState = 'new' | 'contacted' | 'purchased'

type Row = {
  id: number
  fn: string
  ph: string
  device: string
  createdAt: number
  purchasedAt: number
  registered: boolean
  registering: boolean
  price: number
  state: UserState
}

const initialNewReadData: Row[] = [
  {
    id: 1,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() - DayMill * 3,
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'new',
  },
  {
    id: 2,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() - DayMill * 2,
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'new',
  },
  {
    id: 3,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now() - DayMill * 1,
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'contacted',
  },
  {
    id: 4,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'contacted',
  },
  {
    id: 5,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'purchased',
  },
  {
    id: 6,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'purchased',
  },
  {
    id: 7,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'purchased',
  },
  {
    id: 8,
    fn: 'rkdeofuf',
    ph: '01024130510',
    device: 'metalfab',
    createdAt: Date.now(),
    registered: false,
    registering: false,
    purchasedAt: 0,
    price: 0,
    state: 'purchased',
  },
]

type EditingCell = {
  rowId: number
  field: 'fn' | 'ph' | 'price'
} | null

async function registerCustomerCAPI(row: Row): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return { success: true }
}

export const useMainViewModel = () => {
  const [searchActive, setSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Row[]>(initialNewReadData)

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [newReadFold, setNewReadFold] = useState(false)
  const [readCompleteFold, setReadCompleteFold] = useState(false)
  const [purchaseCompleteFold, setPurchaseCompleteFold] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)

  useOutsideClick(searchRef, () => {
    if (searchValue) return
    setSearchActive(false)
    setSearchValue('')
  })

  const typed = !!searchValue

  const toggleNewReadFold = () => {
    setNewReadFold((prev) => !prev)
  }

  const toggleReadCompleteFold = () => {
    setReadCompleteFold((prev) => !prev)
  }

  const togglePurchasCompleteFold = () => {
    setPurchaseCompleteFold((prev) => !prev)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
  }

  const handleEditingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') stopEditing()
  }

  const createNewReadRow = () => {
    setRows((prev) => {
      const newRows = [...prev]
      newRows.push({
        id: Date.now(),
        fn: '',
        ph: '',
        device: 'metalfab',
        createdAt: Date.now(),
        registered: false,
        registering: false,
        price: 0,
        state: 'new',
      })
      return newRows
    })
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

  const startEditing = (rowId: number, field: 'fn' | 'ph' | 'price') => {
    setEditingCell({ rowId, field })
  }

  const updateCellValue = (
    rowId: number,
    field: 'fn' | 'ph' | 'price',
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
      newReadFold,
      readCompleteFold,
      purchaseCompleteFold,
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
      handleEditingKeyDown,
      resetSearchValue,
      toggleNewReadFold,
      createNewReadRow,
      toggleReadCompleteFold,
      togglePurchasCompleteFold,
    },
  }
}
