import { EditingField } from '@/screens/xtool-lead-manager/types'
import type { ToastType } from '@/screens/xtool-lead-manager/components'
import type { Device, Lead } from '@/screens/xtool-lead-manager/entity'
import {
  leadClient,
  type ClientResponse,
} from '@/screens/xtool-lead-manager/client'

/** 고친 리드를 돌려받는 서버 호출 하나를 실행한다 — 도는 동안 전체 화면
 * 로딩을 켜고, 실패하면 에러 토스트, 성공하면 목록·상세 모달을 새 리드로
 * 바꾸고 successToast를 띄운다. 성공 여부를 돌려준다. */
export type RunLeadMutation = (
  call: () => Promise<ClientResponse<Lead>>,
  successToast: ToastType,
) => Promise<boolean>

export const createRunLeadMutation =
  ({
    setLoading,
    showToast,
    applyLeadUpdate,
  }: {
    setLoading: (loading: boolean) => void
    showToast: (type: ToastType) => void
    applyLeadUpdate: (lead: Lead) => void
  }): RunLeadMutation =>
  async (call, successToast) => {
    setLoading(true)
    const res = await call()

    if (!res.ok) {
      console.error(res.error)
      showToast('error')
      setLoading(false)
      return false
    }

    applyLeadUpdate(res.data)
    showToast(successToast)
    setLoading(false)
    return true
  }

// Meta CAPI 재전송 — testEventCode를 주면 이번 재전송만 테스트 이벤트로
// 표시된다(상세 모달의 ↻ 버튼에서 선택적으로 입력).
const testEventCodeField = (testEventCode?: string) =>
  testEventCode ? { test_event_code: testEventCode } : {}

/**
 * 상세 모달에서 리드를 고치는 동작들 — 기본 정보·추적 정보 필드, 접수/상담/
 * 구매 이력의 수정·삭제, 상담/구매의 Meta CAPI 재전송. 전부 "고친 리드를
 * 돌려받는 서버 호출 하나"라 runLeadMutation으로 같은 흐름을 탄다.
 */
export const useLeadMutationsViewModel = (run: RunLeadMutation) => {
  // 고객 상세 모달에서 기본 정보(고객명/전화번호/접수 시각) · 비고를 고칠 때
  // 쓴다 — 필드별로 알맞은 client 호출을 골라서 보낸다. value는 항상
  // 입력창의 원본 문자열이고, 필드별 정제(전화번호 숫자만 남기기)는 여기서
  // 한다.
  const updateLeadField = async (
    leadId: string,
    field: EditingField,
    value: string,
  ): Promise<void> => {
    const call = () => {
      switch (field) {
        case EditingField.FIRST_NAME:
          return leadClient.updateFn({ id: leadId, fn: value })
        case EditingField.PHONE:
          return leadClient.updatePh({
            id: leadId,
            ph: value.replace(/\D/g, ''),
          })
        case EditingField.EMAIL:
          return leadClient.updateEm({ id: leadId, em: value })
        case EditingField.REMARKS:
          return leadClient.updateRemarks({ id: leadId, remarks: value })
        // 유입경로/추적정보 섹션의 나머지 필드(utm_source/utm_medium/
        // utm_campaign/ip/fbc/fbp/user_agent) — 전부 같은 모양이라 필드별
        // 분기 없이 하나의 범용 엔드포인트로 보낸다.
        default:
          return leadClient.updateTrackingField({ id: leadId, field, value })
      }
    }
    await run(call, 'updated')
  }

  const updateIntakeRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device },
  ) => {
    await run(
      () => leadClient.updateIntake({ id: leadId, recordId, ...updates }),
      'updated',
    )
  }

  const deleteIntakeRecord = async (leadId: string, recordId: string) => {
    await run(
      () => leadClient.deleteIntake({ id: leadId, recordId }),
      'deleted',
    )
  }

  const updateConsultationRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device; note?: string },
  ) => {
    await run(
      () => leadClient.updateConsultation({ id: leadId, recordId, ...updates }),
      'updated',
    )
  }

  const deleteConsultationRecord = async (leadId: string, recordId: string) => {
    await run(
      () => leadClient.deleteConsultation({ id: leadId, recordId }),
      'deleted',
    )
  }

  // 상담 이력 1건의 Meta CAPI 이벤트를 다시 보낸다(새 이력 추가 아님) —
  // 전송 실패 재시도, 또는 getActionSource 버그로 잘못 나간 과거 건을 고친
  // 코드로 다시 보내 바로잡는 용도.
  const resendConsultationRecord = async (
    leadId: string,
    recordId: string,
    testEventCode?: string,
  ) => {
    await run(
      () =>
        leadClient.resendConsultation({
          id: leadId,
          recordId,
          ...testEventCodeField(testEventCode),
        }),
      'updated',
    )
  }

  const updatePurchaseRecord = async (
    leadId: string,
    recordId: string,
    updates: { at?: number; device?: Device; price?: number },
  ) => {
    await run(
      () => leadClient.updatePurchase({ id: leadId, recordId, ...updates }),
      'updated',
    )
  }

  const deletePurchaseRecord = async (leadId: string, recordId: string) => {
    await run(
      () => leadClient.deletePurchase({ id: leadId, recordId }),
      'deleted',
    )
  }

  // resendConsultationRecord와 같은 이유(전송 실패 재시도, action_source
  // 버그로 잘못 나간 과거 건 바로잡기) — 대상만 구매 이력.
  const resendPurchaseRecord = async (
    leadId: string,
    recordId: string,
    testEventCode?: string,
  ) => {
    await run(
      () =>
        leadClient.resendPurchase({
          id: leadId,
          recordId,
          ...testEventCodeField(testEventCode),
        }),
      'updated',
    )
  }

  return {
    updateLeadField,
    updateIntakeRecord,
    deleteIntakeRecord,
    updateConsultationRecord,
    deleteConsultationRecord,
    resendConsultationRecord,
    updatePurchaseRecord,
    deletePurchaseRecord,
    resendPurchaseRecord,
  }
}
