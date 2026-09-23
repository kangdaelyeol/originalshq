import { CreateLeadInput, Device, ValidationResponse } from './types'
import { normalizeDomesticPhone } from './utils'

const CREATE_LEAD_REQUIRED_FIELDS = ['ph'] as const

export const hasExternalId = (body: Record<string, unknown>): boolean =>
  body.externalId ? true : false

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

export const validateCreateLead = (
  body: Record<string, unknown>,
): ValidationResponse<CreateLeadInput> => {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid request body' }
  }

  for (const field of CREATE_LEAD_REQUIRED_FIELDS) {
    if (!isNonEmptyString(body[field])) {
      return { ok: false, error: `${field} is required` }
    }
  }

  if (typeof body.createdAt !== 'number') {
    return { ok: false, error: 'createdAt must be number' }
  }

  if (body.remarks !== undefined && typeof body.remarks !== 'string') {
    return { ok: false, error: 'remarks must be a string' }
  }

  if (body.device !== undefined && !Device.includes(body.device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }

  const digitsOnlyPhone = (body.ph as string).replace(/\D/g, '')

  if (!digitsOnlyPhone) {
    return { ok: false, error: 'ph must contain digits' }
  }

  return { ok: true, data: body as CreateLeadInput }
}

/** test_event_code는 선택값 — 있으면 문자열이어야 하고, 빈 문자열은 "안 보낸
 * 것"과 같게 취급해 undefined로 정리한다(체크박스는 켰는데 값을 안 채운 경우
 * 대비). */
const parseTestEventCode = (
  body: Record<string, unknown>,
): ValidationResponse<string | undefined> => {
  const { test_event_code: testEventCode } = body as {
    test_event_code?: unknown
  }

  if (testEventCode === undefined || testEventCode === null) {
    return { ok: true, data: undefined }
  }

  if (typeof testEventCode !== 'string') {
    return { ok: false, error: 'test_event_code must be a string' }
  }

  const trimmed = testEventCode.trim()
  return { ok: true, data: trimmed === '' ? undefined : trimmed }
}

/** 상담/구매 등록 공통 — device 필수, at은 선택(안 주면 호출부에서 Date.now()). */
const parseDeviceAndAt = (
  body: Record<string, unknown>,
): ValidationResponse<{ device: Device; at?: number }> => {
  const { device, at } = body as { device?: string; at?: number }

  if (!device || !Device.includes(device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }

  if (at !== undefined && (typeof at !== 'number' || at <= 0)) {
    return { ok: false, error: 'at must be a positive number if provided' }
  }

  return { ok: true, data: { device: device as Device, at } }
}

export const validateContactLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  device: Device
  at?: number
  testEventCode?: string
}> => {
  const { id } = body as { id?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  const deviceRes = parseDeviceAndAt(body)
  if (!deviceRes.ok) return deviceRes

  const testEventCodeRes = parseTestEventCode(body)
  if (!testEventCodeRes.ok) return testEventCodeRes

  return {
    ok: true,
    data: {
      id,
      device: deviceRes.data.device,
      at: deviceRes.data.at,
      testEventCode: testEventCodeRes.data,
    },
  }
}

export const validatePurchaseLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  device: Device
  price: number
  at?: number
  testEventCode?: string
}> => {
  const { id, price } = body as { id?: string; price?: number }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  if (typeof price !== 'number' || price <= 0) {
    return { ok: false, error: 'price must be a positive number' }
  }

  const deviceRes = parseDeviceAndAt(body)
  if (!deviceRes.ok) return deviceRes

  const testEventCodeRes = parseTestEventCode(body)
  if (!testEventCodeRes.ok) return testEventCodeRes

  return {
    ok: true,
    data: {
      id,
      device: deviceRes.data.device,
      price,
      at: deviceRes.data.at,
      testEventCode: testEventCodeRes.data,
    },
  }
}

/** 상담/구매 이력 1건의 Meta CAPI 이벤트 재전송 — device/at(/price)는 요청에서
 * 새로 받지 않고 저장된 그 레코드 값을 그대로 쓴다(호출부에서 조회 후 사용).
 * id/recordId만 있으면 되고 test_event_code는 선택 — validateDeleteRecord와
 * 같은 이유로 상담/구매 둘 다 이 하나를 공유한다. */
export const validateResendRecord = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  recordId: string
  testEventCode?: string
}> => {
  const { id, recordId } = body as { id?: string; recordId?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!recordId || typeof recordId !== 'string') {
    return { ok: false, error: 'recordId is required' }
  }

  const testEventCodeRes = parseTestEventCode(body)
  if (!testEventCodeRes.ok) return testEventCodeRes

  return {
    ok: true,
    data: { id, recordId, testEventCode: testEventCodeRes.data },
  }
}

/** 접수/consultation/purchase 개별 항목 수정 — 전부 선택값이지만(부분 수정
 * 허용), 뭘 고칠지 하나도 없으면 의미가 없으니 최소 하나는 와야 한다. */
export const validateUpdateIntake = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  recordId: string
  at?: number
  device?: Device
}> => {
  const { id, recordId, at, device } = body as {
    id?: string
    recordId?: string
    at?: number
    device?: string
  }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!recordId || typeof recordId !== 'string') {
    return { ok: false, error: 'recordId is required' }
  }
  if (at !== undefined && (typeof at !== 'number' || at <= 0)) {
    return { ok: false, error: 'at must be a positive number if provided' }
  }
  if (device !== undefined && !Device.includes(device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }
  if (at === undefined && device === undefined) {
    return { ok: false, error: 'at or device must be provided' }
  }

  return {
    ok: true,
    data: { id, recordId, at, device: device as Device | undefined },
  }
}

export const validateUpdateConsultation = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  recordId: string
  at?: number
  device?: Device
}> => {
  const { id, recordId, at, device } = body as {
    id?: string
    recordId?: string
    at?: number
    device?: string
  }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!recordId || typeof recordId !== 'string') {
    return { ok: false, error: 'recordId is required' }
  }
  if (at !== undefined && (typeof at !== 'number' || at <= 0)) {
    return { ok: false, error: 'at must be a positive number if provided' }
  }
  if (device !== undefined && !Device.includes(device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }
  if (at === undefined && device === undefined) {
    return { ok: false, error: 'at or device must be provided' }
  }

  return {
    ok: true,
    data: { id, recordId, at, device: device as Device | undefined },
  }
}

export const validateUpdatePurchase = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  recordId: string
  at?: number
  device?: Device
  price?: number
}> => {
  const { id, recordId, at, device, price } = body as {
    id?: string
    recordId?: string
    at?: number
    device?: string
    price?: number
  }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!recordId || typeof recordId !== 'string') {
    return { ok: false, error: 'recordId is required' }
  }
  if (at !== undefined && (typeof at !== 'number' || at <= 0)) {
    return { ok: false, error: 'at must be a positive number if provided' }
  }
  if (device !== undefined && !Device.includes(device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }
  if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
    return { ok: false, error: 'price must be a positive number if provided' }
  }
  if (at === undefined && device === undefined && price === undefined) {
    return { ok: false, error: 'at, device or price must be provided' }
  }

  return {
    ok: true,
    data: { id, recordId, at, device: device as Device | undefined, price },
  }
}

/** 접수/상담/구매 개별 항목 삭제 — 셋 다 같은 모양({id, recordId})이라 공유한다. */
export const validateDeleteRecord = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  recordId: string
}> => {
  const { id, recordId } = body as { id?: string; recordId?: string }
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!recordId || typeof recordId !== 'string') {
    return { ok: false, error: 'recordId is required' }
  }
  return { ok: true, data: { id, recordId } }
}

export const valiedateUpdateLeadPhone = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  ph: string
}> => {
  const { id, ph } = body as { id?: string; ph?: string }
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (!ph || typeof ph !== 'string') {
    return { ok: false, error: 'ph is required' }
  }

  const digitsOnlyPhone = normalizeDomesticPhone(ph.replace(/\D/g, ''))
  if (!digitsOnlyPhone) {
    return { ok: false, error: 'ph must contain digits' }
  }

  return { ok: true, data: { id, ph: digitsOnlyPhone } }
}

export const validateUpdateLeadFn = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  fn: string
}> => {
  const { id, fn } = body as { id?: string; fn?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (typeof fn !== 'string' || fn === '') {
    return { ok: false, error: 'fn is required' }
  }

  return { ok: true, data: { id, fn } }
}

/** 비고는 내부 참고용 자유 텍스트라 fn과 달리 빈 문자열(지우기)도 허용한다. */
export const validateUpdateLeadRemarks = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  remarks: string
}> => {
  const { id, remarks } = body as { id?: string; remarks?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }
  if (typeof remarks !== 'string') {
    return { ok: false, error: 'remarks must be a string' }
  }

  return { ok: true, data: { id, remarks } }
}

export const validateDeleteLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
}> => {
  const { id } = body as { id?: string }
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  return { ok: true, data: { id } }
}
