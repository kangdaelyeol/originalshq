import { LEADS_API_BASE } from '../constants'
import type { Lead } from '../entity'

export const leadClient = {
  updateTimeStamp: async (body: Record<string, unknown>): Promise<Lead> => {
    const response = await fetch(`${LEADS_API_BASE}/updateLeadTimestamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error ?? '수정 실패')
    }

    const updatedLead = (await response.json()) as Lead
    return updatedLead
  },

  updateContact: async (body: Record<string, unknown>): Promise<Lead> => {
    const response = await fetch(`${LEADS_API_BASE}/updateLeadContact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error ?? '수정 실패')
    }

    const updatedLead = (await response.json()) as Lead
    return updatedLead
  },
}
