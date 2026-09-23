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

const post = async (
  endpoint: string,
  body: Record<string, unknown>,
): Promise<ClientResponse<Lead>> => {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      return { ok: false, error: error.error ?? '요청 실패' }
    }

    const updatedLead = (await response.json()) as Lead
    return { ok: true, data: updatedLead }
  } catch (error) {
    return {
      ok: false,
      error: `${endpoint} 실패: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
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
  create: async (body: Record<string, unknown>): Promise<ClientResponse<Lead>> => {
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

      // 백엔드(createLead)가 이미 생성된 리드 전체({id, ...})를 응답으로
      // 돌려준다 — "고객 등록 + 상담 등록"을 이어서 호출하려면 방금 만든
      // 리드의 id가 필요해서 더 이상 버리지 않고 그대로 반환한다.
      const createdLead = (await response.json()) as Lead
      return { ok: true, data: createdLead }
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
  updateFn: (body: Record<string, unknown>) => post('updateLeadFn', body),
  updatePh: (body: Record<string, unknown>) => post('updateLeadPhone', body),
  updateRemarks: (body: Record<string, unknown>) =>
    post('updateLeadRemarks', body),
  updateIntake: (body: Record<string, unknown>) =>
    post('updateIntake', body),
  deleteIntake: (body: Record<string, unknown>) =>
    post('deleteIntake', body),
  registerConsultation: (body: Record<string, unknown>) =>
    post('contactLead', body),
  resendConsultation: (body: Record<string, unknown>) =>
    post('resendConsultation', body),
  registerPurchase: (body: Record<string, unknown>) =>
    post('purchaseLead', body),
  resendPurchase: (body: Record<string, unknown>) =>
    post('resendPurchase', body),
  updateConsultation: (body: Record<string, unknown>) =>
    post('updateConsultation', body),
  deleteConsultation: (body: Record<string, unknown>) =>
    post('deleteConsultation', body),
  updatePurchase: (body: Record<string, unknown>) =>
    post('updatePurchase', body),
  deletePurchase: (body: Record<string, unknown>) =>
    post('deletePurchase', body),
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
