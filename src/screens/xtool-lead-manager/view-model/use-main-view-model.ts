import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useToast } from '@/screens/xtool-lead-manager/hooks/use-toast'
import { fromDatetimeLocalValue } from '@/screens/xtool-lead-manager/utils'

const LEADS_API_BASE = 'https://us-central1-xtool-63b29.cloudfunctions.net'

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

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${LEADS_API_BASE}/listLeads`)

      if (!response.ok) {
        throw new Error('리드 목록을 불러오지 못했습니다')
      }

      const data = (await response.json()) as { leads: Lead[]; count: number }

      setRows(data.leads)
    } catch (error) {
      console.error('fetchLeads 실패:', error)
      // TODO: toaster - error message
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

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
    const targetLead = rows[selectedRowIndex]

    if (!targetLead) {
      setSelectedRowIndex(-1)
      return
    }

    const isContactStep = targetLead.state === 'new'

    if (!isContactStep && targetLead.price <= 0) {
      console.error('purchaseLead 호출에는 0보다 큰 price가 필요합니다')
      return
    }

    setLoading(true)
    try {
      const endpoint = isContactStep ? 'contactLead' : 'purchaseLead'
      const body = isContactStep
        ? { id: targetLead.id }
        : { id: targetLead.id, price: targetLead.price }

      console.log(`전송 데이터: `, body)
      const response = await fetch(`${LEADS_API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      console.log('응답: ', response)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? '처리 실패')
      }

      const updatedLead = (await response.json()) as Lead

      setRows((prev) =>
        prev.map((row) => (row.id === targetLead.id ? updatedLead : row)),
      )
      setSelectedRowIndex(-1)
      showToast('registered')
    } catch (error) {
      console.error('registerCustomer 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteCustomer = async (): Promise<void> => {
    const targetLead = rows[selectedRowIndex]

    if (!targetLead) {
      setSelectedRowIndex(-1)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${LEADS_API_BASE}/deleteLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetLead.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? '삭제 실패')
      }

      setRows((prev) => prev.filter((row) => row.id !== targetLead.id))
      setSelectedRowIndex(-1)
      showToast('deleted')
    } catch (error) {
      console.error('deleteCustomer 실패:', error)
    } finally {
      setLoading(false)
    }
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
    let cleanedValue: string | number = value

    if (field === 'ph') {
      cleanedValue = value.replace(/\D/g, '')
    } else if (field === 'createdAt' || field === 'purchasedAt') {
      cleanedValue = fromDatetimeLocalValue(value)
    }

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

    if (editedValue === undefined) {
      setEditingCell(null)
      return
    }

    let endpoint: string
    let body: Record<string, unknown>

    if (field === 'price') {
      const numericPrice = Number(editedValue)

      if (Number.isNaN(numericPrice)) {
        console.error('가격은 숫자여야 합니다')
        setEditingCell(null)
        return
      }

      endpoint = 'updateLeadPrice'
      body = { id: rowId, price: numericPrice }
    } else if (field === 'createdAt' || field === 'purchasedAt') {
      const numericTimestamp = Number(editedValue)

      if (Number.isNaN(numericTimestamp)) {
        console.error('시각 값이 올바르지 않습니다')
        setEditingCell(null)
        return
      }

      endpoint = 'updateLeadTimestamp'
      body = { id: rowId, field, value: numericTimestamp }
    } else if (field === 'fn' || field === 'ph') {
      endpoint = 'updateLeadContact'
      body = { id: rowId, [field]: editedValue }
    } else {
      console.error(`stopEditing: 지원하지 않는 필드입니다 (${field})`)
      setEditingCell(null)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${LEADS_API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? '수정 실패')
      }

      const updatedLead = (await response.json()) as Lead

      setRows((prev) =>
        prev.map((row) => (row.id === rowId ? updatedLead : row)),
      )

      showToast('updated')
    } catch (error) {
      console.error('stopEditing 실패:', error)
    } finally {
      setLoading(false)
      setEditingCell(null)
    }
  }

  const updateDevice = async (rowId: string, device: Device) => {
    setLoading(true)
    try {
      const response = await fetch(`${LEADS_API_BASE}/updateLeadDevice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rowId, device }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error ?? '수정 실패')
      }

      const updatedLead = (await response.json()) as Lead

      setRows((prev) =>
        prev.map((row) => (row.id === rowId ? updatedLead : row)),
      )

      showToast('updated')
    } catch (error) {
      console.error('updateDevice 실패:', error)
    } finally {
      setLoading(false)
      setEditingCell(null)
    }
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
      // TODO: listLeads 재호출
    } catch (error) {
      console.error(error)
      // TODO: toaster - error message
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
