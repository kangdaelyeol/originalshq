import type { ConsultationRecord, Device } from '../entity'

export const generateExternalId = (): string => `eid_${Date.now().toString(36)}`

/** Meta CAPI 호출에 붙일 test_event_code — 코드가 있을 때만(앞뒤 공백은 뺀다).
 * 붙이면 이벤트 관리자의 테스트 이벤트로 잡힌다. */
export const testCode = (code?: string): { test_event_code?: string } => {
  const trimmed = code?.trim()
  return trimmed ? { test_event_code: trimmed } : {}
}

/** 폼의 "테스트 이벤트로 전송"을 켰을 때만 그 코드를 붙인다. */
export const testCodeOf = (form: { isTest: boolean; testEventCode: string }) =>
  testCode(form.isTest ? form.testEventCode : undefined)

/** 상담의 기기들 — devices가 생기기 전 기록은 대표 기기 하나. */
export const consultationDevices = (
  record: Pick<ConsultationRecord, 'device' | 'devices'>,
): Device[] => (record.devices?.length ? record.devices : [record.device])
