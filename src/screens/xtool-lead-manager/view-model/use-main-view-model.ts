import { useCallback, useRef, useState } from 'react'
import {
  ConfirmVariant,
  INITIAL_REGISTER_FORM,
  type RegisterFormValues,
} from '@/screens/xtool-lead-manager/types'
import { useToast } from '@/screens/xtool-lead-manager/hooks'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/screens/xtool-lead-manager/utils'
import { latestIntake, type Lead } from '@/screens/xtool-lead-manager/entity'
import { leadClient } from '@/screens/xtool-lead-manager/client'
import { useLeadListViewModel } from './use-lead-list-view-model'
import {
  createRunLeadMutation,
  useLeadMutationsViewModel,
} from './use-lead-mutations-view-model'

/** 상담/구매 등록 폼의 공통 값 — 등록 시각(비우면 서버가 지금 시각)과,
 * 테스트로 체크했을 때만 Meta 테스트 이벤트 코드. */
const registerExtras = (form: RegisterFormValues) => {
  const at = form.at ? fromDatetimeLocalValue(form.at) : undefined
  const testEventCode = form.isTest ? form.testEventCode.trim() : ''
  return {
    ...(at ? { at } : {}),
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }
}

/**
 * 리드 탭 화면의 view-model. 목록(조회·필터·정렬·페이지)은
 * useLeadListViewModel이, 상세 모달의 수정 동작은 useLeadMutationsViewModel이
 * 맡고, 여기서는 둘을 묶고 확인창(고객 삭제·상담/구매 등록)과 상세 모달을
 * 다룬다.
 */
export const useMainViewModel = () => {
  const [loading, setLoading] = useState(false)
  const { showToast, ToastContainer } = useToast()
  const list = useLeadListViewModel({ setLoading, showToast })
  const { rows, setRows } = list

  // 확인창 대상과 종류 — 고객 삭제, 상담 등록, 구매 등록이 같은 확인창을 쓴다.
  const [selectedRow, setSelectedRow] = useState<Lead | null>(null)
  const [variant, setVariant] = useState<ConfirmVariant>(ConfirmVariant.DELETE)
  const [registerForm, setRegisterForm] = useState<RegisterFormValues>(
    INITIAL_REGISTER_FORM,
  )
  // 이력 모달(고객명 클릭) 대상 — 상담/구매 이력을 보여주고, 개별 항목을
  // 수정·삭제하는 곳.
  const [detail, setDetail] = useState<Lead | null>(null)
  // 상세 모달에서 고객을 지울 때, 지운 뒤 모달에 보여줄 고객 id — 삭제 확인을
  // 누를 때까지 들고 있는다(null이면 모달을 닫는다).
  const nextDetailIdRef = useRef<string | null>(null)

  // rows(목록)와, 열려 있다면 detail(이력 모달)까지 같은 리드를 함께 최신화한다.
  const applyLeadUpdate = (updatedLead: Lead) => {
    setRows((prev) =>
      prev.map((row) => (row.id === updatedLead.id ? updatedLead : row)),
    )
    setDetail((prev) =>
      prev && prev.id === updatedLead.id ? updatedLead : prev,
    )
  }

  const runLeadMutation = createRunLeadMutation({
    setLoading,
    showToast,
    applyLeadUpdate,
  })
  const mutations = useLeadMutationsViewModel(runLeadMutation)

  const registerConsultation = async (): Promise<void> => {
    const targetLead = selectedRow
    if (!targetLead) return

    await runLeadMutation(
      () =>
        leadClient.registerConsultation({
          id: targetLead.id,
          device: registerForm.device,
          ...registerExtras(registerForm),
        }),
      'registered',
    )
    setSelectedRow(null)
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

    await runLeadMutation(
      () =>
        leadClient.registerPurchase({
          id: targetLead.id,
          device: registerForm.device,
          price,
          ...registerExtras(registerForm),
        }),
      'registered',
    )
    setSelectedRow(null)
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
      // 상세 모달이 지금 이 리드를 보여주는 중이었다면, 닫지 않고 목록에서
      // 바로 위(맨 위였다면 바로 아래) 고객으로 넘어간다 — 이어서 정리하기
      // 편하도록. 남은 고객이 없으면 닫는다.
      const next = rows.find((row) => row.id === nextDetailIdRef.current)
      setDetail((prev) =>
        prev && prev.id === targetLead.id ? (next ?? null) : prev,
      )
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

  /** 고객 삭제 확인창을 띄운다. 상세 모달에서 지울 때는 지운 뒤 보여줄
   * 고객(nextLeadId)도 같이 받는다. */
  const deleteRow = (rowId: string, nextLeadId: string | null = null) => {
    const row = rows.find((row) => row.id === rowId)
    if (!row) return
    nextDetailIdRef.current = nextLeadId
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

  return {
    state: {
      rows: list.pagedRows,
      filteredRows: list.filteredRows,
      selectedRow,
      variant,
      registerForm,
      detail,
      sortField: list.sortField,
      sortDirection: list.sortDirection,
      loading,
      initialLoading: !list.hasLoaded,
      pageSize: list.pageSize,
      page: list.page,
      totalPages: list.totalPages,
      totalRows: list.totalRows,
    },
    actions: {
      ...mutations,
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
      setPageSize: list.setPageSize,
      goToPrevPage: list.goToPrevPage,
      goToNextPage: list.goToNextPage,
      toggleSort: list.toggleSort,
      // 다른 view-model(수기 등록 등)이 목록 갱신·토스트를 써야 할 때 화면
      // (index.tsx)이 꺼내서 넘겨준다 — 훅이 훅을 직접 부르지 않게 하기 위함.
      fetchLeads: list.fetchLeads,
      showToast,
    },
    component: {
      ToastContainer,
    },
  }
}
