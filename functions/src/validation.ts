import { Device, TimestampField } from './types'

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== ''

export const validateLeadCreationBody = (
  body: unknown,
  requiredFields: string[],
): string | null => {
  if (typeof body !== 'object' || body === null) {
    return 'invalid request body'
  }

  const record = body as Record<string, unknown>

  for (const field of requiredFields) {
    if (!isNonEmptyString(record[field])) {
      return `${field} is required`
    }
  }

  if (!Device.includes(record.device as Device)) {
    return `device must be one of: ${Device.join(', ')}`
  }

  return null
}

export const hasExternalId = (body: Record<string, unknown>): boolean =>
  body.externalId ? true : false

export type ValidateUpdateTimestampResponse =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

export const validateUpdateTimestampParams = (
  id?: string,
  field?: string,
  value?: number,
): ValidateUpdateTimestampResponse => {
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

  return { ok: true }
}
