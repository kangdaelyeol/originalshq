import { LEADS_API_BASE } from '../constants'
import type { Lead } from '../entity'

type ClientResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }

export const leadClient = {
  create: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<null>> => {
    try {
      const response = await fetch(`${LEADS_API_BASE}/createLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        return { ok: false, error: error.error ?? '등록 실패' }
      }

      return {
        ok: true,
        data: null,
      }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'leadClient - create: known error',
      }
    }
  },
  updateDevice: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${LEADS_API_BASE}/updateLeadDevice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        return { ok: false, error: error.error ?? '수정 실패' }
      }

      const updatedLead = (await response.json()) as Lead
      return { ok: true, data: updatedLead }
    } catch (error) {
      return {
        ok: false,
        error: `updateDevice 실패: ${error instanceof Error ? error.message : 'unknown Error'}`,
      }
    }
  },
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
