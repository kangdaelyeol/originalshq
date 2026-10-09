import type { Device } from '@/screens/xtool-lead-manager/entity'
import type { EditingField } from '@/screens/xtool-lead-manager/types'

/*
 * 고객 상세 모달이 부모(Main)로부터 받는 동작들의 타입.
 *
 * 예전엔 Detail과 각 이력 줄(IntakeRow 등)이 같은 함수 시그니처를 각자 다시
 * 적고 있어서, 하나를 고치면 여러 곳을 같이 고쳐야 했다. 한곳에 모아 두고
 * 양쪽이 가져다 쓴다.
 */

export type IntakeUpdates = { at?: number; device?: Device }
export type ConsultationUpdates = IntakeUpdates & { note?: string }
export type PurchaseUpdates = IntakeUpdates & { price?: number }

export type UpdateRecord<Updates> = (
  leadId: string,
  recordId: string,
  updates: Updates,
) => Promise<void>

export type DeleteRecord = (leadId: string, recordId: string) => Promise<void>

/** 상담/구매 이력의 Meta CAPI 이벤트 재전송 — testEventCode가 있으면 테스트
 * 이벤트로 나간다. */
export type ResendRecord = (
  leadId: string,
  recordId: string,
  testEventCode?: string,
) => Promise<void>

export type UpdateLeadField = (
  leadId: string,
  field: EditingField,
  value: string,
) => Promise<void>
