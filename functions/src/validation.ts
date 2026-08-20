import { Device } from './types'

export const DEVICE_VALUES: Device[] = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
  'M2',
  'F2',
]

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

  if (!DEVICE_VALUES.includes(record.device as Device)) {
    return `device must be one of: ${DEVICE_VALUES.join(', ')}`
  }

  return null
}
