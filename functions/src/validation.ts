import {
  CreateLeadInput,
  Device,
  LeadState,
  TimestampField,
  ValidationResponse,
} from './types'

const CREATE_LEAD_REQUIRED_FIELDS = ['ph', 'device'] as const

export const hasExternalId = (body: Record<string, unknown>): boolean =>
  body.externalId ? true : false

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

export const validateCreateLead = (
  body: Record<string, unknown>,
): ValidationResponse<CreateLeadInput> => {
  if (typeof body !== 'object' || body === null)
    return { ok: false, error: 'invalid request body' }

  for (const field of CREATE_LEAD_REQUIRED_FIELDS) {
    if (!isNonEmptyString(body[field]))
      return { ok: false, error: `${field} is required` }
  }

  if (!LeadState.includes(body.state as string))
    return {
      ok: false,
      error: `lead state must be one of: ${LeadState.join(', ')}`,
    }

  if (!Device.includes(body.device as Device))
    return { ok: false, error: `device must be one of: ${Device.join(', ')}` }

  const digitsOnlyPhone = (body.ph as string).replace(/\D/g, '')

  if (!digitsOnlyPhone) {
    return { ok: false, error: 'ph must contain digits' }
  }

  return { ok: true, data: body as CreateLeadInput }
}

export const validateContactLead = (
  body: Record<string, unknown>,
): ValidationResponse<{
  id: string
}> => {
  const { id } = body as { id?: string }

  if (!id || typeof id !== 'string')
    return { ok: false, error: 'id is required' }

  return { ok: true, data: { id } }
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

  const digitsOnlyPhone = ph.replace(/\D/g, '')
  if (!digitsOnlyPhone) {
    return { ok: false, error: 'ph must contain digits' }
  }

  return { ok: true, data: { id, ph: digitsOnlyPhone } }
}

export const validateUpdateLeanFn = (
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

export const validateUpdateTimestampParams = (
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
): ValidationResponse<{ id: string; price: number; purchasedAt: number }> => {
  const { id, price, purchasedAt } = body as {
    id?: string
    price?: number
    purchasedAt?: number
  }

  if (!id || typeof id !== 'string')
    return { ok: false, error: 'id is required' }

  if (typeof price !== 'number' || price <= 0)
    return { ok: false, error: 'price must be a positive number' }

  if (typeof purchasedAt !== 'number' || purchasedAt <= 0)
    return { ok: false, error: 'purchasedAt must be required' }

  return { ok: true, data: { id, price, purchasedAt } }
}
