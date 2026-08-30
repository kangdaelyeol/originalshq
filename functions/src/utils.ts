import { createHash } from 'crypto'

export type ActionSource = 'physical_store' | 'phone_call'

export const generateExternalId = (ph: string): string =>
  createHash('sha256').update(ph).digest('hex')

export const getActionSource = (eventTimeSec: number): ActionSource => {
  const SEVEN_DAYS_SEC = 3600 * 24 * 7

  const nowSec = Math.floor(Date.now() / 1000)

  return nowSec - eventTimeSec < SEVEN_DAYS_SEC
    ? 'phone_call'
    : 'physical_store'
}
