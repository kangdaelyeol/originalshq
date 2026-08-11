import { useMemo, useState } from 'react'
import { sampleLeads } from '../sample-data'
import type {
  ConfirmVariant,
  Device,
  Lead,
  SortDirection,
  SortField,
} from '../types'
import { useSearchContext } from '../context/search-context'

export type UserState = 'new' | 'contacted' | 'purchased'

type Field = 'fn' | 'ph' | 'price'

type EditingCell = {
  rowId: string
  field: Field
} | null

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>(sampleLeads)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [newReadFold, setNewReadFold] = useState(false)
  const [readCompleteFold, setReadCompleteFold] = useState(false)
  const [purchaseCompleteFold, setPurchaseCompleteFold] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1)
  const [variant, setVariant] = useState<ConfirmVariant>('delete')
  const [detail, setDetail] = useState<Lead | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { searchValue } = useSearchContext()

  const filteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => row.fn.toLowerCase().includes(keyword))
  }, [rows, searchValue])

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      let res: number
      if (sortField === 'createdAt') {
        res = a.createdAt - b.createdAt
      } else {
        res = a[sortField].localeCompare(b[sortField], 'ko')
      }
      return sortDirection === 'asc' ? res : -res
    })

    return sorted
  }, [filteredRows, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const registerCustomer = async (): Promise<void> => {
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        setRows((prev) => {
          const newRows = [...prev]
          const newRow = { ...newRows[selectedRowIndex] }
          if (newRows[selectedRowIndex].state === 'new')
            newRow.state = 'contacted'
          else newRow.state = 'purchased'
          newRow.purchasedAt = Date.now()
          newRows[selectedRowIndex] = newRow
          return newRows
        })
        setSelectedRowIndex(-1)
        resolve()
      }, 500),
    )
  }

  const deleteCustomer = async (): Promise<void> => {
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        setRows((prev) => prev.filter((_, idx) => idx !== selectedRowIndex))
        setSelectedRowIndex(-1)
        resolve()
      }, 500),
    )
  }

  const handleConfirmClick = async () => {
    if (variant === 'delete') await deleteCustomer()
    if (variant === 'register') await registerCustomer()
  }

  const handleCancelConfirmClick = () => {
    setSelectedRowIndex(-1)
  }

  const toggleNewReadFold = () => {
    setNewReadFold((prev) => !prev)
  }

  const toggleReadCompleteFold = () => {
    setReadCompleteFold((prev) => !prev)
  }

  const togglePurchaseCompleteFold = () => {
    setPurchaseCompleteFold((prev) => !prev)
  }

  const showDetail = (rowId: string) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    setDetail(row)
  }

  const hideDetail = () => {
    setDetail(null)
  }

  const handleEditingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') stopEditing()
  }

  const createNewReadRow = () => {
    setRows((prev) => {
      const newRows = [...prev]
      newRows.push({
        id: Date.now().toString(),
        createdAt: Date.now(),
        fn: '',
        ph: '',
        device: 'Metalfab',
        purchasedAt: 0,
        price: 0,
        state: 'new',
        utm_campaign: '',
        utm_medium: '',
        utm_source: '',
        ip: '',
        user_agent: '',
        fbc: '',
        fbp: '',
      })
      return newRows
    })
  }

  const toggleAllChecked = () => {
    setAllChecked((prev) => !prev)
  }

  const startEditing = (rowId: string, field: Field) => {
    setEditingCell({ rowId, field })
  }

  const updateCellValue = (rowId: string, field: Field, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    )
  }

  const stopEditing = () => {
    setEditingCell(null)
  }

  const updateDevice = (rowId: string, device: Device) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, device } : row)),
    )
  }

  const deleteRow = (rowId: string) => {
    const idx = rows.findIndex((row) => row.id === rowId)
    if (idx === -1) return
    setSelectedRowIndex(idx)
    setVariant('delete')
  }

  const registerRow = async (rowId: string) => {
    const idx = rows.findIndex((row) => row.id === rowId)
    if (idx === -1) return
    setSelectedRowIndex(idx)
    setVariant('register')
  }

  return {
    state: {
      allChecked,
      editingCell,
      rows: sortedRows,
      newReadFold,
      readCompleteFold,
      purchaseCompleteFold,
      selectedRowIndex,
      variant,
      detail,
      sortField,
      sortDirection,
    },
    actions: {
      toggleAllChecked,
      startEditing,
      updateCellValue,
      stopEditing,
      updateDevice,
      deleteRow,
      registerRow,
      handleEditingKeyDown,
      toggleNewReadFold,
      createNewReadRow,
      toggleReadCompleteFold,
      togglePurchaseCompleteFold,
      handleCancelConfirmClick,
      handleConfirmClick,
      showDetail,
      hideDetail,
      toggleSort,
    },
  }
}
