import { Device } from './types'

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
