import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ConfirmVariant,
  EditingField,
  INITIAL_CREATE_LEAD_FORM,
  INITIAL_REGISTER_FORM,
  SortField,
  type CreateLeadFormValues,
  type PageSize,
  type RegisterFormValues,
  type SortDirection,
} from '@/screens/xtool-lead-manager/types'
import { useFilterContext } from '@/screens/xtool-lead-manager/context'
import { useToast } from '@/screens/xtool-lead-manager/hooks'
import {
  filterLeadsByDevice,
  filterLeadsByKeywords,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  sortLeads,
} from '@/screens/xtool-lead-manager/utils'
import { latestIntake, type Device, type Lead } from '@/screens/xtool-lead-manager/entity'
import {
  leadClient,
  type ClientResponse,
} from '@/screens/xtool-lead-manager/client'

export const useMainViewModel = () => {
  const [rows, setRows] = useState<Lead[]>([])
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
  const [pageSize, setPageSize] = useState<PageSize>(15)
  const [page, setPage] = useState(1)

  const { searchValue, selectedDevices } = useFilterContext()
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
    () => filterLeadsByDevice(sortedRows, selectedDevices),
    [sortedRows, selectedDevices],
  )

  const totalRows = deviceFilteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const pagedRows = useMemo(
    () => deviceFilteredRows.slice((page - 1) * pageSize, page * pageSize),
    [deviceFilteredRows, page, pageSize],
  )

  // 검색어·정렬·기기 필터·페이지당 개수 중 뭐든 바뀌면 지금 보던 페이지 번호가
  // 더 이상 유효하지 않을 수 있어(예: 3페이지를 보다가 검색으로 결과가 1페이지
  // 분량으로 줄어드는 경우) 항상 1페이지로 되돌린다. setState를 이펙트 안에서
  // 동기 호출하면 렌더가 한 번 더 연쇄되므로, 렌더 중에 이전 키와 비교해서
  // 바뀌었을 때만 즉시 되돌리는 패턴을 쓴다(React가 권장하는 "prop이 바뀌면
  // state를 초기화" 대체 방식).
  const selectedDevicesKey = [...selectedDevices].sort().join(',')
  const paginationResetKey = `${searchValue}|${selectedDevicesKey}|${sortField}|${sortDirection}|${pageSize}`
  const [prevPaginationResetKey, setPrevPaginationResetKey] = useState(
    paginationResetKey,
  )
  if (paginationResetKey !== prevPaginationResetKey) {
    setPrevPaginationResetKey(paginationResetKey)
    setPage(1)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const goToPrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1))
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

  const registerConsultation = async (): Promise<void> => {
    const targetLead = selectedRow
    if (!targetLead) return

    const testEventCodeField =
      registerForm.isTest && registerForm.testEventCode.trim()
        ? { test_event_code: registerForm.testEventCode.trim() }
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

    const testEventCodeField =
      registerForm.isTest && registerForm.testEventCode.trim()
        ? { test_event_code: registerForm.testEventCode.trim() }
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
      // 이력 모달이 지금 이 리드를 보여주는 중이었다면 더는 존재하지 않는
      // 데이터를 붙들고 있게 되므로 같이 닫는다.
      setDetail((prev) => (prev && prev.id === targetLead.id ? null : prev))
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

  // 표의 각 행(LeadRow)에 그대로 내려가는 콜백 prop — useCallback 없이 매번
  // 새 함수를 만들면 React.memo(LeadRow)가 "props가 바뀌었다"고 오판해
  // 검색어를 칠 때마다(row 자체는 그대로여도) 모든 행을 다시 렌더한다. rows가
  // 실제로 바뀔 때만(재조회 등) 새로 만든다.
  const showDetail = useCallback(
    (rowId: string) => {
      const row = rows.find((row) => row.id === rowId)
      if (!row) return
      setDetail(row)
    },
    [rows],
  )

  const hideDetail = () => {
    setDetail(null)
  }

  // 고객 상세 모달에서 기본 정보(고객명/전화번호/접수 시각) · 비고를 고칠 때
  // 쓴다 — 필드별로 알맞은 client 호출을 골라서 보내고, 성공하면 rows와
  // detail을 같이 최신화한다. value는 항상 입력창의 원본 문자열이고, 필드별
  // 정제(전화번호 숫자만 남기기, 시각 문자열 → ms 변환)는 여기서 한다.
  const updateLeadField = async (
    leadId: string,
    field: EditingField,
    value: string,
  ): Promise<void> => {
    setLoading(true)
    let res: ClientResponse<Lead>

    switch (field) {
      case EditingField.FIRST_NAME:
        res = await leadClient.updateFn({ id: leadId, fn: value })
        break
      case EditingField.PHONE:
        res = await leadClient.updatePh({
          id: leadId,
          ph: value.replace(/\D/g, ''),
        })
        break
      case EditingField.REMARKS:
        res = await leadClient.updateRemarks({ id: leadId, remarks: value })
        break
    }

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
    // 접수 이력이 있는 고객은 가장 최근 접수 건의 접수 일시·기기를 상담 등록
    // 폼 초기값으로 채워준다 — 보통 문의(접수) 당시 정한 기기 그대로 상담하고,
    // 시각도 그 근처라 매번 새로 입력하지 않아도 되게. 접수 기기가 비어있는
    // 레코드(신규 접수 흐름은 기기 입력이 없음 — entity/lead.ts 주석 참고)면
    // 기기는 기본값을 그대로 둔다.
    const intake = latestIntake(row)
    setRegisterForm(
      intake
        ? {
            ...INITIAL_REGISTER_FORM,
            device: intake.device ?? INITIAL_REGISTER_FORM.device,
            at: toDatetimeLocalValue(intake.at),
          }
        : INITIAL_REGISTER_FORM,
    )
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

  const toggleRegisterFormTest = () => {
    setRegisterForm((prev) => ({ ...prev, isTest: !prev.isTest }))
  }

  const updateRegisterFormTestCode = (code: string) => {
    setRegisterForm((prev) => ({ ...prev, testEventCode: code }))
  }

  const updateIntakeRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => {
    setLoading(true)
    const res = await leadClient.updateIntake({
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

  const deleteIntakeRecord = async (leadId: string, recordId: string) => {
    setLoading(true)
    const res = await leadClient.deleteIntake({ id: leadId, recordId })

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

  // 상담 이력 1건의 Meta CAPI 이벤트를 다시 보낸다(새 이력 추가 아님) —
  // 전송 실패 재시도, 또는 getActionSource 버그로 잘못 나간 과거 건을 고친
  // 코드로 다시 보내 바로잡는 용도. testEventCode를 주면 이번 재전송만 테스트
  // 이벤트로 표시된다(상세 모달의 ↻ 버튼에서 선택적으로 입력).
  const resendConsultationRecord = async (
    leadId: string,
    recordId: string,
    testEventCode?: string,
  ) => {
    setLoading(true)
    const res = await leadClient.resendConsultation({
      id: leadId,
      recordId,
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
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

  // resendConsultationRecord와 같은 이유(전송 실패 재시도, action_source
  // 버그로 잘못 나간 과거 건 바로잡기) — 대상만 구매 이력.
  const resendPurchaseRecord = async (
    leadId: string,
    recordId: string,
    testEventCode?: string,
  ) => {
    setLoading(true)
    const res = await leadClient.resendPurchase({
      id: leadId,
      recordId,
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
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

  const toggleCreateFormTest = () => {
    setCreateForm((prev) => ({ ...prev, isTest: !prev.isTest }))
  }

  const updateCreateFormTestCode = (code: string) => {
    setCreateForm((prev) => ({ ...prev, testEventCode: code }))
  }

  // 비워두면 다른 시각 입력들과 같은 관례로 "지금"을 쓴다 — 예전엔 0(1970년)을
  // 그대로 보내던 버그가 있었다.
  const buildCreateLeadBody = () => {
    const createdAtMs = createForm.createdAt
      ? new Date(createForm.createdAt).getTime()
      : Date.now()

    return { ...createForm, createdAt: createdAtMs }
  }

  const handleCreateLeadClick = async () => {
    setIsSubmitting(true)
    const res = await leadClient.create(buildCreateLeadBody())

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

  // 패널에서 고객 정보를 등록함과 동시에 상담까지 한 번에 등록한다 — 방금
  // 만든 리드의 id로 곧바로 contactLead(상담 등록 + Meta "Contact" CAPI 전송)를
  // 이어서 호출한다. 상담 시각은 폼의 접수 일시와 같은 값을 그대로 쓴다(수기
  // 등록은 보통 "지금 막 상담한 고객을 입력"하는 흐름이라 접수와 상담이 사실상
  // 같은 시점). 리드 생성엔 성공했는데 상담 등록만 실패하면(네트워크 등) 리드가
  // 이미 만들어져 있으니 'error'가 아니라 'partial'로 구분해서 알린다 — 그래야
  // 같은 고객을 중복 등록하지 않고, 표에 뜬 그 리드의 "상담 등록" 버튼으로
  // 재시도할 수 있다.
  const handleCreateLeadAndConsultClick = async () => {
    setIsSubmitting(true)
    const body = buildCreateLeadBody()
    const createRes = await leadClient.create(body)

    if (!createRes.ok) {
      console.error(createRes.error)
      showToast('error')
      setIsSubmitting(false)
      return
    }

    const testEventCodeField =
      createForm.isTest && createForm.testEventCode.trim()
        ? { test_event_code: createForm.testEventCode.trim() }
        : {}
    const consultRes = await leadClient.registerConsultation({
      id: createRes.data.id,
      device: createForm.device,
      at: body.createdAt,
      ...testEventCodeField,
    })

    await fetchLeads()
    closeCreateModal()

    if (!consultRes.ok) {
      console.error(consultRes.error)
      showToast('partial')
      setIsSubmitting(false)
      return
    }

    showToast('registered')
    setIsSubmitting(false)
  }

  // "구매 등록"도 같은 방식이지만, 이 흐름은 상담/접수 과정 없이 바로 구매만
  // 확정된 경우를 위한 것이라(예: 기존 채널로 이미 구매 의사를 확인한 고객을
  // CS가 사후에 시스템에 입력하는 경우) 상담(contactLead)은 등록하지 않고
  // 구매(purchaseLead)만 이어서 호출한다 — 고객 정보 생성은 어차피 최초 접수
  // 1건을 같이 만들지만(리드 생성 자체의 고정 동작), 상담 이력은 안 남긴다.
  const handleCreateLeadAndPurchaseClick = async () => {
    const price = Number(createForm.price)
    if (!createForm.price || Number.isNaN(price) || price <= 0) {
      console.error('구매 등록에는 0보다 큰 price가 필요합니다')
      showToast('error')
      return
    }

    setIsSubmitting(true)
    const body = buildCreateLeadBody()
    const createRes = await leadClient.create(body)

    if (!createRes.ok) {
      console.error(createRes.error)
      showToast('error')
      setIsSubmitting(false)
      return
    }

    const testEventCodeField =
      createForm.isTest && createForm.testEventCode.trim()
        ? { test_event_code: createForm.testEventCode.trim() }
        : {}
    const purchaseRes = await leadClient.registerPurchase({
      id: createRes.data.id,
      device: createForm.device,
      price,
      at: body.createdAt,
      ...testEventCodeField,
    })

    await fetchLeads()
    closeCreateModal()

    if (!purchaseRes.ok) {
      console.error(purchaseRes.error)
      showToast('partial')
      setIsSubmitting(false)
      return
    }

    showToast('registered')
    setIsSubmitting(false)
  }

  return {
    state: {
      // 표에는 검색어·정렬·기기 필터에 더해 페이지당 개수·현재 페이지까지
      // 적용된 한 페이지 분량만 넘긴다.
      rows: pagedRows,
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
      pageSize,
      page,
      totalPages,
      totalRows,
    },
    actions: {
      updateLeadField,
      deleteRow,
      registerConsultationRow,
      registerPurchaseRow,
      updateRegisterForm,
      toggleRegisterFormTest,
      updateRegisterFormTestCode,
      handleCancelConfirmClick,
      handleConfirmClick,
      showDetail,
      hideDetail,
      updateIntakeRecord,
      deleteIntakeRecord,
      updateConsultationRecord,
      deleteConsultationRecord,
      resendConsultationRecord,
      updatePurchaseRecord,
      deletePurchaseRecord,
      setPageSize,
      goToPrevPage,
      goToNextPage,
      resendPurchaseRecord,
      toggleSort,
      openCreateModal,
      closeCreateModal,
      handleCreateLeadClick,
      handleCreateLeadAndConsultClick,
      handleCreateLeadAndPurchaseClick,
      updateField,
      toggleCreateFormTest,
      updateCreateFormTestCode,
    },
    component: {
      ToastContainer,
    },
  }
}
