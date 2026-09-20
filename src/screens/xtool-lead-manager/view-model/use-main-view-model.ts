import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ConfirmVariant,
  EditingField,
  INITIAL_CREATE_LEAD_FORM,
  INITIAL_REGISTER_FORM,
  SortField,
  type CreateLeadFormValues,
  type EditingCell,
  type RegisterFormValues,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { useToast } from '@/screens/xtool-lead-manager/hooks'
import {
  filterLeadsByDevice,
  filterLeadsByKeywords,
  fromDatetimeLocalValue,
  sortLeads,
} from '@/screens/xtool-lead-manager/utils'
import type { Device, Lead } from '@/screens/xtool-lead-manager/entity'
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
  const [registerForm, setRegisterForm] = useState<RegisterFormValues>(
    INITIAL_REGISTER_FORM,
  )
  // 이력 모달(고객명 클릭) 대상 — 상담/구매 이력을 보여주고, 개별 항목을
  // 수정·삭제하는 곳.
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // rows(목록)와, 열려 있다면 detail(이력 모달)까지 같은 리드를 함께 최신화한다.
  const applyLeadUpdate = (updatedLead: Lead) => {
    setRows((prev) =>
      prev.map((row) => (row.id === updatedLead.id ? updatedLead : row)),
    )
    setDetail((prev) =>
      prev && prev.id === updatedLead.id ? updatedLead : prev,
    )
  }

  const clearTestRow = (rowId: string) => {
    setTestRows((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const registerConsultation = async (): Promise<void> => {
    const targetLead = selectedRow
    if (!targetLead) return

    const testInfo = testRows[targetLead.id]
    const testEventCodeField =
      testInfo?.checked && testInfo.code.trim()
        ? { test_event_code: testInfo.code.trim() }
        : {}
    const at = registerForm.at
      ? fromDatetimeLocalValue(registerForm.at)
      : undefined

    setLoading(true)
    const body = {
      id: targetLead.id,
      device: registerForm.device,
      ...(at ? { at } : {}),
      ...testEventCodeField,
    }
    const res = await leadClient.registerConsultation(body)

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setSelectedRow(null)
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    clearTestRow(targetLead.id)
    setSelectedRow(null)
    showToast('registered')
    setLoading(false)
  }

  const registerPurchase = async (): Promise<void> => {
    const targetLead = selectedRow
    if (!targetLead) return

    const price = Number(registerForm.price)
    if (!registerForm.price || Number.isNaN(price) || price <= 0) {
      console.error('구매 등록에는 0보다 큰 price가 필요합니다')
      showToast('error')
      return
    }

    const testInfo = testRows[targetLead.id]
    const testEventCodeField =
      testInfo?.checked && testInfo.code.trim()
        ? { test_event_code: testInfo.code.trim() }
        : {}
    const at = registerForm.at
      ? fromDatetimeLocalValue(registerForm.at)
      : undefined

    setLoading(true)
    const body = {
      id: targetLead.id,
      device: registerForm.device,
      price,
      ...(at ? { at } : {}),
      ...testEventCodeField,
    }
    const res = await leadClient.registerPurchase(body)

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setSelectedRow(null)
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    clearTestRow(targetLead.id)
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
    if (variant === ConfirmVariant.REGISTER_CONSULTATION)
      await registerConsultation()
    if (variant === ConfirmVariant.REGISTER_PURCHASE) await registerPurchase()
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
    } else if (field === EditingField.CREATED_AT) {
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
    let numericTimestamp: number
    let body: Record<string, unknown>
    let res: ClientResponse<Lead>

    switch (field) {
      case EditingField.CREATED_AT:
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
        body = { id: rowId, fn: editedValue }
        res = await leadClient.updateFn(body)
        break
      case EditingField.PHONE:
        body = { id: rowId, ph: editedValue }
        res = await leadClient.updatePh(body)
        break
      case EditingField.REMARKS:
        body = { id: rowId, remarks: editedValue }
        res = await leadClient.updateRemarks(body)
        break
    }

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      setEditingCell(null)
      return
    }

    applyLeadUpdate(res.data)
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

  const registerConsultationRow = (rowId: string) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    setSelectedRow(row)
    setVariant(ConfirmVariant.REGISTER_CONSULTATION)
    setRegisterForm(INITIAL_REGISTER_FORM)
  }

  const registerPurchaseRow = (rowId: string) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    setSelectedRow(row)
    setVariant(ConfirmVariant.REGISTER_PURCHASE)
    setRegisterForm(INITIAL_REGISTER_FORM)
  }

  const updateRegisterForm = (
    field: keyof RegisterFormValues,
    value: string,
  ) => {
    setRegisterForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateConsultationRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => {
    setLoading(true)
    const res = await leadClient.updateConsultation({
      id: leadId,
      recordId,
      ...updates,
    })

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    showToast('updated')
    setLoading(false)
  }

  const deleteConsultationRecord = async (leadId: string, recordId: string) => {
    setLoading(true)
    const res = await leadClient.deleteConsultation({ id: leadId, recordId })

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    showToast('deleted')
    setLoading(false)
  }

  const updatePurchaseRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device; price?: number },
  ) => {
    setLoading(true)
    const res = await leadClient.updatePurchase({
      id: leadId,
      recordId,
      ...updates,
    })

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    showToast('updated')
    setLoading(false)
  }

  const deletePurchaseRecord = async (leadId: string, recordId: string) => {
    setLoading(true)
    const res = await leadClient.deletePurchase({ id: leadId, recordId })

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      return
    }

    applyLeadUpdate(res.data)
    showToast('deleted')
    setLoading(false)
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
      registerForm,
      detail,
      sortField,
      sortDirection,
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
      deleteRow,
      registerConsultationRow,
      registerPurchaseRow,
      updateRegisterForm,
      handleEditingKeyDown,
      handleCancelConfirmClick,
      handleConfirmClick,
      showDetail,
      hideDetail,
      updateConsultationRecord,
      deleteConsultationRecord,
      updatePurchaseRecord,
      deletePurchaseRecord,
      toggleSort,
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
