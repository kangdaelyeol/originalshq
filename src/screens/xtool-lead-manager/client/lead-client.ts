import { API_BASE } from '../constants'
import type { Lead } from '../entity'

export type ClientResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }

export const leadClient = {
  getAll: async (): Promise<
    ClientResponse<{ leads: Lead[]; count: number }>
  > => {
    try {
      const response = await fetch(`${API_BASE}/listLeads`)

      if (!response.ok) {
        return { ok: false, error: '리드 목록을 불러오지 못했습니다' }
      }

      const data = (await response.json()) as { leads: Lead[]; count: number }
      return { ok: true, data }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'unknown error: userclient - get all',
      }
    }
  },
  create: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<null>> => {
    try {
      const response = await fetch(`${API_BASE}/createLead`, {
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
      const response = await fetch(`${API_BASE}/updateLeadDevice`, {
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
  updateTimeStamp: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    const response = await fetch(`${API_BASE}/updateLeadTimestamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error ?? '수정 실패')
    }

    const updatedLead = (await response.json()) as Lead
    return { ok: true, data: updatedLead }
  },
  updatePrice: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${API_BASE}/updateLeadPrice`, {
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
        error: `leadClient-UpdatePrice error: ${error instanceof Error ? error.message : 'known error'}`,
      }
    }
  },
  updateFn: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${API_BASE}/updateLeadFn`, {
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
        error: `leadClient-UpdateFn error: ${error instanceof Error ? error.message : 'known error'}`,
      }
    }
  },
  updatePh: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${API_BASE}/updateLeadPhone`, {
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
        error: `leadClient-UpdatePh error: ${error instanceof Error ? error.message : 'known error'}`,
      }
    }
  },
  updateStateToContact: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${API_BASE}/contactLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        return { ok: false, error }
      }

      const updatedLead = (await response.json()) as Lead
      return { ok: true, data: updatedLead }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'unknown error: leadclient-updateStateToContact',
      }
    }
  },
  updateStateToPurchased: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<Lead>> => {
    try {
      const response = await fetch(`${API_BASE}/purchaseLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        return { ok: false, error }
      }

      const updatedLead = (await response.json()) as Lead
      return { ok: true, data: updatedLead }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'unknown error: leadclient-updateStateToPurchase',
      }
    }
  },
  delete: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<null>> => {
    try {
      const response = await fetch(`${API_BASE}/deleteLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        return { ok: false, error }
      }

      return { ok: true, data: null }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'unknown error: leadclient-delete',
      }
    }
  },
}
