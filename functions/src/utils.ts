import { createHash } from 'crypto'

export const generateExternalId = (ph: string): string =>
  createHash('sha256').update(ph).digest('hex')
