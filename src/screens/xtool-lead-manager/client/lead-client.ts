import type { Lead } from '../entity'
import { request, type ClientResponse } from './request'

// 고친 리드 전체를 돌려받는 POST — 수정·삭제·등록·재전송이 전부 이 모양이다.
const post = (endpoint: string, body: Record<string, unknown>) =>
  request<Lead>(endpoint, `${endpoint} 실패`, { body })

export const leadClient = {
  getAll: (): Promise<ClientResponse<{ leads: Lead[]; count: number }>> =>
    request('listLeads', '리드 목록을 불러오지 못했습니다'),
  // 백엔드(createLead)가 이미 생성된 리드 전체({id, ...})를 응답으로
  // 돌려준다 — "고객 등록 + 상담 등록"을 이어서 호출하려면 방금 만든 리드의
  // id가 필요해서 버리지 않고 그대로 반환한다.
  create: (body: Record<string, unknown>) =>
    request<Lead>('createLead', '등록 실패', { body }),
  updateFn: (body: Record<string, unknown>) => post('updateLeadFn', body),
  updatePh: (body: Record<string, unknown>) => post('updateLeadPhone', body),
  updateEm: (body: Record<string, unknown>) => post('updateLeadEm', body),
  updateRemarks: (body: Record<string, unknown>) =>
    post('updateLeadRemarks', body),
  updateTrackingField: (body: Record<string, unknown>) =>
    post('updateLeadTrackingField', body),
  updateIntake: (body: Record<string, unknown>) => post('updateIntake', body),
  deleteIntake: (body: Record<string, unknown>) => post('deleteIntake', body),
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
  // 성공 응답 내용은 쓰지 않는다(목록에서 빼기만 한다).
  delete: async (
    body: Record<string, unknown>,
  ): Promise<ClientResponse<null>> => {
    const res = await request<unknown>('deleteLead', '삭제 실패', { body })
    return res.ok ? { ok: true, data: null } : res
  },
}
