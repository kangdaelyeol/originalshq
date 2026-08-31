import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ConfirmVariant,
  EditingField,
  INITIAL_CREATE_LEAD_FORM,
  SortField,
  type CreateLeadFormValues,
  type EditingCell,
  type SortDirection,
  type TableFold,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { useToast } from '@/screens/xtool-lead-manager/hooks'
import {
  filterLeadsByDevice,
  filterLeadsByKeywords,
  fromDatetimeLocalValue,
  sortLeads,
} from '@/screens/xtool-lead-manager/utils'
import { LEADS_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type {
  Device,
  Lead,
  LeadState,
} from '@/screens/xtool-lead-manager/entity'
import { leadClient, type ClientResponse } from '../client'

export const useMainViewModel = () => {
  const [allChecked, setAllChecked] = useState(false)
  const [rows, setRows] = useState<Lead[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [selectedRow, setSelectedRow] = useState<Lead | null>(null)
  const [variant, setVariant] = useState<ConfirmVariant>(ConfirmVariant.DELETE)
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
      showToast('error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const [fold, setFold] = useState<TableFold>({
    new: false,
    contacted: false,
    purchased: false,
  })

  const keywordFilteredRows = useMemo(
    () => filterLeadsByKeywords(rows, searchValue),
    [rows, searchValue],
  )

  const sortedRows = useMemo(
    () => sortLeads(keywordFilteredRows, sortField, sortDirection),
    [keywordFilteredRows, sortField, sortDirection],
  )

  const deviceFilteredRows = useMemo(
    () => filterLeadsByDevice(sortedRows, deviceFilter),
    [sortedRows, deviceFilter],
  )

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
    const targetLead = selectedRow
    if (!targetLead) return

    const isContactStep = targetLead.state === 'new'
    if (!isContactStep && targetLead.price <= 0) {
      console.error('purchaseLead 호출에는 0보다 큰 price가 필요합니다')
      return
    }

    let body: Record<string, unknown>
    let res: ClientResponse<Lead>

    setLoading(true)
    switch (targetLead.state) {
      case 'new':
        body = { id: targetLead.id }
        res = await leadClient.updateStateToContact(body)
        if (!res.ok) {
          console.error(res.error)
          setSelectedRow(null)
          showToast('error')
          setLoading(false)
          return
        }
        break
      case 'contacted':
        body = { id: targetLead.id, price: targetLead.price }
        res = await leadClient.updateStateToContact(body)
        if (!res.ok) {
          console.error(res.error)
          setSelectedRow(null)
          showToast('error')
          setLoading(false)
          return
        }
        break
      default:
        console.error(`unexpected state: ${targetLead.state}`)
        setSelectedRow(null)
        showToast('error')
        setLoading(false)
        return
    }

    const updatedLead = res.data

    setRows((prev) =>
      prev.map((row) => (row.id === targetLead.id ? updatedLead : row)),
    )
    setSelectedRow(null)
    showToast('registered')
    setLoading(false)
  }

  const deleteCustomer = async (): Promise<void> => {
    const targetLead = selectedRow

    if (!targetLead) return

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
      setSelectedRow(null)
      showToast('deleted')
    } catch (error) {
      console.error('deleteCustomer 실패:', error)
      showToast('error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmClick = async () => {
    if (variant === ConfirmVariant.DELETE) await deleteCustomer()
    if (variant === ConfirmVariant.REGISTER) await registerCustomer()
  }

  const handleCancelConfirmClick = () => {
    setSelectedRow(null)
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

  const handleFieldChange = (
    rowId: string,
    field: EditingField,
    value: string,
  ) => {
    let cleanedValue: string | number = value

    if (field === EditingField.PHONE) {
      cleanedValue = value.replace(/\D/g, '')
    } else if (
      field === EditingField.CREATED_AT ||
      field === EditingField.PURCHASED_AT
    ) {
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

    setLoading(true)
    let numericPrice: number
    let numericTimestamp: number
    let body: Record<string, unknown>
    let res: ClientResponse<Lead>

    switch (field) {
      case EditingField.PRICE:
        numericPrice = Number(editedValue)
        if (Number.isNaN(numericPrice)) {
          console.error('가격은 숫자여야 합니다')
          showToast('error')
          setLoading(false)
          setEditingCell(null)
          return
        }
        body = { id: rowId, price: numericPrice }
        res = await leadClient.updatePrice(body)
        break
      case EditingField.CREATED_AT:
      case EditingField.PURCHASED_AT:
        numericTimestamp = Number(editedValue)
        if (Number.isNaN(numericTimestamp)) {
          console.error('시각 값이 올바르지 않습니다')
          showToast('error')
          setLoading(false)
          setEditingCell(null)
          return
        }
        body = { id: rowId, field, value: numericTimestamp }
        res = await leadClient.updateTimeStamp(body)
        break
      case EditingField.FIRST_NAME:
        body = { id: rowId, [field]: editedValue }
        res = await leadClient.updateFn(body)
        break
      case EditingField.PHONE:
        body = { id: rowId, [field]: editedValue }
        res = await leadClient.updatePh(body)
        break
    }

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      setEditingCell(null)
      return
    }

    const updatedLead = res.data

    setRows((prev) => prev.map((row) => (row.id === rowId ? updatedLead : row)))
    showToast('updated')
    setLoading(false)
    setEditingCell(null)
  }

  const handleDeviceUpdate = async (rowId: string, device: Device) => {
    setLoading(true)
    const body = { id: rowId, device }
    const response = await leadClient.updateDevice(body)

    if (!response.ok) {
      console.log(response.error)
      setLoading(false)
      setEditingCell(null)
      return
    }

    const updatedLead = response.data

    setRows((prev) => prev.map((row) => (row.id === rowId ? updatedLead : row)))
    showToast('updated')
    setLoading(false)
    setEditingCell(null)
  }

  const deleteRow = (rowId: string) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    setSelectedRow(row)
    setVariant(ConfirmVariant.DELETE)
  }

  const registerRow = async (rowId: string) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    setSelectedRow(row)
    setVariant(ConfirmVariant.REGISTER)
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
    setIsSubmitting(true)
    const createdAtMs = createForm.createdAt
      ? new Date(createForm.createdAt).getTime()
      : 0

    const body = { ...createForm, createdAt: createdAtMs }

    const res = await leadClient.create(body)

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setIsSubmitting(false)
      return
    }

    await fetchLeads()
    closeCreateModal()

    setIsSubmitting(false)
  }

  return {
    state: {
      allChecked,
      editingCell,
      rows: deviceFilteredRows,
      selectedRow,
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
      handleFieldChange,
      stopEditing,
      handleDeviceUpdate,
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
