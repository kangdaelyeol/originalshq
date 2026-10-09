import { useState } from 'react'
import {
  INITIAL_CREATE_LEAD_FORM,
  type CreateLeadFormValues,
} from '@/screens/xtool-lead-manager/types'
import type { ToastType } from '@/screens/xtool-lead-manager/components'
import type { Lead } from '@/screens/xtool-lead-manager/entity'
import {
  leadClient,
  type ClientResponse,
} from '@/screens/xtool-lead-manager/client'

interface CreateLeadDeps {
  /** 등록 후 표를 최신으로 다시 불러온다 — 목록은 useMainViewModel이 갖고 있다. */
  fetchLeads: () => Promise<void>
  /** 토스트도 화면에 하나뿐이라 useMainViewModel의 것을 받아 쓴다. */
  showToast: (type: ToastType) => void
}

/** 리드 생성 직후 이어서 부를 호출(상담/구매 등록) — 방금 만든 리드의 id와
 * 접수 시각을 받는다. */
type FollowUp = (
  leadId: string,
  createdAt: number,
) => Promise<ClientResponse<Lead>>

/*
 * 리드 수기 등록 모달 컨트롤러.
 *
 * 폼 값, 열기/닫기, 그리고 세 가지 등록 버튼을 다룬다:
 *   - 등록: 고객 정보만 만든다.
 *   - 상담 등록: 만든 뒤 곧바로 상담을 등록한다(Meta "Contact" CAPI 전송 포함).
 *   - 구매 등록: 만든 뒤 곧바로 구매를 등록한다(Meta "Purchase" CAPI 전송 포함).
 *
 * 세 버튼은 "리드 생성 → (있으면) 후속 호출 → 목록 갱신 → 모달 닫기"라는 같은
 * 흐름이라 createLeadThen 하나로 처리하고, 버튼마다 다른 건 후속 호출뿐이다.
 */
export const useCreateLeadViewModel = ({
  fetchLeads,
  showToast,
}: CreateLeadDeps) => {
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateLeadFormValues>(
    INITIAL_CREATE_LEAD_FORM,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  /** 후속 호출(상담/구매 등록)에 같이 실어 보낼 test_event_code — 테스트를
   * 켰고 코드가 비어 있지 않을 때만 붙는다. */
  const testEventCodeField = () =>
    createForm.isTest && createForm.testEventCode.trim()
      ? { test_event_code: createForm.testEventCode.trim() }
      : {}

  /** 리드를 만들고, followUp이 있으면 그 리드로 이어서 호출한다.
   *
   * 리드 생성엔 성공했는데 후속 호출만 실패하면(네트워크 등) 리드가 이미
   * 만들어져 있으니 'error'가 아니라 'partial'로 구분해서 알린다 — 그래야 같은
   * 고객을 중복 등록하지 않고, 표에 뜬 그 리드에서 상담/구매 등록을 다시
   * 시도할 수 있다. 그래서 후속 호출이 실패해도 목록은 갱신하고 모달은
   * 닫는다. */
  const createLeadThen = async (followUp?: FollowUp) => {
    setIsSubmitting(true)
    const body = buildCreateLeadBody()
    const createRes = await leadClient.create(body)

    if (!createRes.ok) {
      console.error(createRes.error)
      showToast('error')
      setIsSubmitting(false)
      return
    }

    const followRes = followUp
      ? await followUp(createRes.data.id, body.createdAt)
      : null

    await fetchLeads()
    closeCreateModal()

    if (followRes && !followRes.ok) {
      console.error(followRes.error)
      showToast('partial')
    } else if (followRes) {
      showToast('registered')
    }
    setIsSubmitting(false)
  }

  const handleCreateLeadClick = () => createLeadThen()

  // 상담 시각은 폼의 접수 일시와 같은 값을 그대로 쓴다 — 수기 등록은 보통
  // "지금 막 상담한 고객을 입력"하는 흐름이라 접수와 상담이 사실상 같은 시점.
  const handleCreateLeadAndConsultClick = () =>
    createLeadThen((leadId, createdAt) =>
      leadClient.registerConsultation({
        id: leadId,
        device: createForm.device,
        at: createdAt,
        ...testEventCodeField(),
      }),
    )

  // 상담/접수 과정 없이 바로 구매만 확정된 경우를 위한 흐름이라(예: 기존
  // 채널로 이미 구매 의사를 확인한 고객을 CS가 사후에 입력) 상담은 등록하지
  // 않고 구매만 이어서 호출한다 — 리드 생성이 최초 접수 1건을 같이 만들지만
  // (리드 생성 자체의 고정 동작), 상담 이력은 안 남긴다.
  const handleCreateLeadAndPurchaseClick = async () => {
    const price = Number(createForm.price)
    if (!createForm.price || Number.isNaN(price) || price <= 0) {
      console.error('구매 등록에는 0보다 큰 price가 필요합니다')
      showToast('error')
      return
    }

    await createLeadThen((leadId, createdAt) =>
      leadClient.registerPurchase({
        id: leadId,
        device: createForm.device,
        price,
        at: createdAt,
        ...testEventCodeField(),
      }),
    )
  }

  return {
    state: { createOpen, isSubmitting, form: createForm },
    actions: {
      openCreateModal,
      closeCreateModal,
      updateField,
      toggleCreateFormTest,
      updateCreateFormTestCode,
      handleCreateLeadClick,
      handleCreateLeadAndConsultClick,
      handleCreateLeadAndPurchaseClick,
    },
  }
}
