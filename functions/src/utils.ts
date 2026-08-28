import { createHash } from 'crypto'

export const generateExternalId = (id: string): string =>
  createHash('sha256').update(id).digest('hex')
