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
import type {
  Device,
  Lead,
  LeadState,
} from '@/screens/xtool-lead-manager/entity'
import {
  leadClient,
  type ClientResponse,
} from '@/screens/xtool-lead-manager/client'

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
  // 행마다 "테스트" 체크 여부 + test_event_code 입력값 — Lead 데이터가 아니라
  // "등록"(contactLead/purchaseLead 호출) 시 잠깐 얹어 보낼 값이라 rowId로만
  // 따로 관리한다. 이벤트마다 코드가 달라서 직접 입력하게 한다.
  const [testRows, setTestRows] = useState<
    Record<string, { checked: boolean; code: string }>
  >({})

  const { searchValue, deviceFilter } = useFilterContext()
  const { showToast, ToastContainer } = useToast()

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const res = await leadClient.getAll()

    if (!res.ok) {
      console.error('fetchLeads 실패:', res.error)
      showToast('error')
      setLoading(false)
      return
    }

    const { data } = res

    setRows(data.leads)
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    ;(async () => {
      await fetchLeads()
    })()
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

    // 체크됐고 값도 채워져 있을 때만 실어 보낸다 — 체크만 하고 코드를 안 채운
    // 경우엔 평소(실 이벤트)처럼 보낸다.
    const testInfo = testRows[targetLead.id]
    const testEventCodeField =
      testInfo?.checked && testInfo.code.trim()
        ? { test_event_code: testInfo.code.trim() }
        : {}

    setLoading(true)
    switch (targetLead.state) {
      case 'new':
        body = { id: targetLead.id, ...testEventCodeField }
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
        body = {
          id: targetLead.id,
          price: targetLead.price,
          purchasedAt: targetLead.purchasedAt,
          ...testEventCodeField,
        }
        res = await leadClient.updateStateToPurchased(body)
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
    // 이번 등록에 쓴 테스트 체크는 초기화 — 다음 단계(예: 상담완료→구매완료)로
    // 넘어가면 새로 정해야 한다.
    setTestRows((prev) => {
      const next = { ...prev }
      delete next[targetLead.id]
      return next
    })
    setSelectedRow(null)
    showToast('registered')
    setLoading(false)
  }

  const deleteCustomer = async (): Promise<void> => {
    const targetLead = selectedRow

    if (!targetLead) return

    setLoading(true)

    const body = { id: targetLead.id }
    const res = await leadClient.delete(body)

    if (!res.ok) {
      console.error('deleteCustomer 실패:', res.error)
      showToast('error')
    } else {
      setRows((prev) => prev.filter((row) => row.id !== targetLead.id))
      showToast('deleted')
    }
    setSelectedRow(null)
    setLoading(false)
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

  const toggleTestRow = (rowId: string) => {
    setTestRows((prev) => {
      const current = prev[rowId]
      return {
        ...prev,
        [rowId]: { checked: !current?.checked, code: current?.code ?? '' },
      }
    })
  }

  const updateTestEventCode = (rowId: string, code: string) => {
    setTestRows((prev) => ({
      ...prev,
      [rowId]: { checked: prev[rowId]?.checked ?? true, code },
    }))
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
    if (field === 'ph') {
      value = value.replace(/\D/g, '')
    }

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
      testRows,
    },
    actions: {
      toggleAllChecked,
      toggleTestRow,
      updateTestEventCode,
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
