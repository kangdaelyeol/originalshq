import type { ConsultationRecord, Device } from '../entity'

export const generateExternalId = (): string => `eid_${Date.now().toString(36)}`

/** 상담의 기기들 — devices가 생기기 전 기록은 대표 기기 하나. */
export const consultationDevices = (
  record: Pick<ConsultationRecord, 'device' | 'devices'>,
): Device[] => (record.devices?.length ? record.devices : [record.device])
