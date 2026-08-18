import { useMemo, useState } from 'react'
import {
  INITIAL_CREATE_LEAD_FORM,
  type ConfirmVariant,
  type CreateLeadFormValues,
  type Device,
  type EditingCell,
  type EditingField,
  type Lead,
  type LeadState,
  type SortDirection,
  type SortField,
  type TableFold,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
// import { sampleLeads } from '@/screens/xtool-lead-manager/sample-data'
import { useToast } from '../hooks/use-toast'

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1)
  const [variant, setVariant] = useState<ConfirmVariant>('delete')
  const [detail, setDetail] = useState<Lead | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateLeadFormValues>(
    INITIAL_CREATE_LEAD_FORM,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { searchValue, deviceFilter } = useFilterContext()
  const { showToast, ToastContainer } = useToast()

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
        showToast('registered')
      }, 500),
    )
  }

  const deleteCustomer = async (): Promise<void> => {
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        setRows((prev) => prev.filter((_, idx) => idx !== selectedRowIndex))
        setSelectedRowIndex(-1)
        resolve()
        showToast('deleted')
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

    // TODO - update row in firebase(rowId / editedValue)
    await new Promise((resolve) => {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        resolve(null)
        setEditingCell(null)
        showToast('updated')
      }, 500)
    })
  }

  const updateDevice = async (rowId: string, device: Device) => {
    // TODO - update row in firebase(rowId / device)
    await new Promise((resolve) => {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        resolve(null)
        setEditingCell(null)
        showToast('updated')
        setRows((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, device } : row)),
        )
      }, 500)
    })
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

  const openCreateModal = () => {
    setCreateForm(INITIAL_CREATE_LEAD_FORM)
    setCreateOpen(true)
  }

  const closeCreateModal = () => {
    setCreateOpen(false)
  }

  const updateField = (field: keyof CreateLeadFormValues, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateLeadClick = async () => {
    if (!createForm.fn || !createForm.ph) {
      // 토스트 등으로 안내
      return
    }

    setIsSubmitting(true)
    try {
      const createdAtMs = createForm.createdAt
        ? new Date(createForm.createdAt).getTime()
        : undefined

      const body = { ...createForm, createdAt: createdAtMs }

      const response = await fetch(
        'https://us-central1-xtool-63b29.cloudfunctions.net/createLead',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? '등록 실패')
      }

      closeCreateModal()
      // 여기서 목록 다시 불러오기 (listLeads 재호출)
    } catch (error) {
      console.error(error)
      // 에러 토스트
    } finally {
      setIsSubmitting(false)
    }
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
      loading,
      createOpen,
      isSubmitting,
      form: createForm,
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
      openCreateModal,
      closeCreateModal,
      handleCreateLeadClick,
      updateField,
    },
    component: {
      ToastContainer,
    },
  }
}
