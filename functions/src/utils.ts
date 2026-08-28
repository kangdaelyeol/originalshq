import { createHash } from 'crypto'

export const generateExternalId = (id: string): string =>
  `eid_${createHash('sha256').update(id).digest('hex').slice(0, 32)}`
