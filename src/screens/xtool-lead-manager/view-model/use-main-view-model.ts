import { useMemo, useState } from 'react'
import type {
  ConfirmVariant,
  Device,
  EditingCell,
  EditingField,
  Lead,
  LeadState,
  SortDirection,
  SortField,
  TableFold,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { sampleLeads } from '@/screens/xtool-lead-manager/sample-data'

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>(sampleLeads)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1)
  const [variant, setVariant] = useState<ConfirmVariant>('delete')
  const [detail, setDetail] = useState<Lead | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [loading, setLoading] = useState(false)

  const { searchValue, deviceFilter } = useFilterContext()

  const [fold, setFold] = useState<TableFold>({
    new: false,
    contacted: false,
    purchased: false,
  })

  const keywordFilteredRows = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => row.fn.toLowerCase().includes(keyword))
  }, [rows, searchValue])

  const sortedRows = useMemo(() => {
    const sorted = [...keywordFilteredRows]
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
  }, [keywordFilteredRows, sortField, sortDirection])

  const deviceFilteredRows = useMemo(() => {
    if (deviceFilter === 'all') return sortedRows
    return sortedRows.filter((row) => row.device === deviceFilter)
  }, [sortedRows, deviceFilter])

  const toggleFold = (field: LeadState) => {
    setFold((prev) => {
      const newFold = { ...prev }
      newFold[field] = !newFold[field]

      return newFold
    })
  }

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

  const startEditing = (rowId: string, field: EditingField) => {
    setEditingCell({ rowId, field })
  }

  const updateCellValue = (
    rowId: string,
    field: EditingField,
    value: string,
  ) => {
    const cleanedValue = field === 'ph' ? value.replace(/\D/g, '') : value

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: cleanedValue } : row,
      ),
    )
  }

  const stopEditing = async () => {
    if (!editingCell) return
    const { rowId, field } = editingCell
    const editedValue = rows.find((row) => row.id === rowId)?.[field]
    
    if (!rowId) setEditingCell(null)
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
      rows: deviceFilteredRows,
      selectedRowIndex,
      variant,
      detail,
      sortField,
      sortDirection,
      fold,
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
      createNewReadRow,
      handleCancelConfirmClick,
      handleConfirmClick,
      showDetail,
      hideDetail,
      toggleSort,
      toggleFold,
    },
  }
}
