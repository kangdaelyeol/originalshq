import { request, type ClientResponse } from './request'

/** 웹사이트 상담 신청 1건 — 실시간 인입 요약에 필요한 값만(전체 모양은
 * functions-xtool/src/inquiry/types.ts의 Inquiry). */
export interface LiveInquiry {
  id: string
  device: string
  boardName: string
  name: string
  company?: string
  receivedAt: number
  /** 접수일(한국 시간, YYYY-MM-DD). */
  receivedDate: string
  monday: { status: 'pending' | 'success' | 'failed' | 'skipped' }
}

export const inquiryClient = {
  /** 최근 days일 안의 웹 신청(최신순). /log 문의 접수와 같은 조회. */
  listRecent: (
    days: number,
  ): Promise<ClientResponse<{ inquiries: LiveInquiry[]; fetchedAt: number }>> =>
    request(`listInquiryLogs?days=${days}`, '웹 문의를 불러오지 못했습니다'),
}
