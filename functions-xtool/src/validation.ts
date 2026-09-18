import {
  CreateLeadInput,
  Device,
  LeadState,
  TimestampField,
  ValidationResponse,
} from './types'
import { normalizeDomesticPhone } from './utils'

const CREATE_LEAD_REQUIRED_FIELDS = ['ph', 'device'] as const

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

  if (!LeadState.includes(body.state as string)) {
    return {
      ok: false,
      error: `lead state must be one of: ${LeadState.join(', ')}`,
    }
  }

  if (!Device.includes(body.device as Device)) {
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

export const validateContactLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  testEventCode?: string
}> => {
  const { id } = body as { id?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  const testEventCodeRes = parseTestEventCode(body)
  if (!testEventCodeRes.ok) return testEventCodeRes

  return { ok: true, data: { id, testEventCode: testEventCodeRes.data } }
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

export const validateUpdateLeadDevice = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  device: string
}> => {
  const { id, device } = body as { id?: string; device?: string }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  if (!device || typeof device !== 'string') {
    return { ok: false, error: 'device is required' }
  }

  if (!Device.includes(device as Device)) {
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }
  }
  return { ok: true, data: { id, device } }
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

export const validateUpdateLeadPrice = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  price: number
}> => {
  const { id, price } = body as { id?: string; price?: number }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  if (typeof price !== 'number') {
    return { ok: false, error: 'price must be a non-negative number' }
  }

  return { ok: true, data: { id, price } }
}

export const validateUpdateTimestamp = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  field: string
  value: number
}> => {
  const { id, field, value } = body as {
    id?: string
    field?: string
    value?: number
  }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  if (!field || !TimestampField.includes(field as TimestampField)) {
    return {
      ok: false,
      error: `field must be one of: ${TimestampField.join(', ')}`,
    }
  }

  if (typeof value !== 'number' || value < 0 || Number.isNaN(value)) {
    return { ok: false, error: 'value must be a valid timestamp (ms)' }
  }

  return { ok: true, data: { id, field, value } }
}

export const validatePurchaseLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
  price: number
  purchasedAt: number
  testEventCode?: string
}> => {
  const { id, price, purchasedAt } = body as {
    id?: string
    price?: number
    purchasedAt?: number
  }

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'id is required' }
  }

  if (typeof price !== 'number' || price <= 0) {
    return { ok: false, error: 'price must be a positive number' }
  }

  if (typeof purchasedAt !== 'number' || purchasedAt <= 0) {
    return { ok: false, error: 'purchasedAt must be required' }
  }

  const testEventCodeRes = parseTestEventCode(body)
  if (!testEventCodeRes.ok) return testEventCodeRes

  return {
    ok: true,
    data: { id, price, purchasedAt, testEventCode: testEventCodeRes.data },
  }
}
