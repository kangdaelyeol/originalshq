import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ClientResponse } from './batch-run-client'

/** 처리 단계 상태 — functions-xtool/src/inquiry/types.ts의 StepStatus. */
export type InquiryStepStatus = 'pending' | 'success' | 'failed' | 'skipped'

/** 상담 신청 1건 — functions-xtool/src/inquiry/types.ts의 Inquiry. */
export interface Inquiry {
  id: string
  device: string
  boardId: string
  boardName: string
  name: string
  phone: string
  phoneFormatted: string
  email: string
  installment: string
  /** 고객이 적은 문의 내용(기타 온라인 문의). 예전 기록에는 없다. */
  message?: string
  /** 도입 시기(메탈팹). 예전 기록에는 없다. */
  introPeriod?: string
  utmCampaign: string
  utmMedium: string
  utmSource: string
  fbc: string
  fbp: string
  gaClientId: string
  ip: string
  userAgent: string
  receivedAt: number
  receivedDate: string
  monday: {
    status: InquiryStepStatus
    itemId: string | null
    error: string | null
    at: number | null
  }
  sms: {
    status: InquiryStepStatus
    to: string | null
    from: string | null
    text: string | null
    messageId: string | null
    error: string | null
    at: number | null
  }
}

export interface InquirySettings {
  smsEnabled: boolean
  senderNumber: string
  template: string
  updatedAt: number | null
}

const request = async <T>(
  path: string,
  init: RequestInit | undefined,
  fallback: string,
): Promise<ClientResponse<T>> => {
  try {
    const response = await fetch(`${API_BASE}/${path}`, init)
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: string
    }
    if (!response.ok) {
      return {
        ok: false,
        error: body.error ?? `${fallback} (HTTP ${response.status})`,
      }
    }
    return { ok: true, data: body }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    }
  }
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** 최근 days일에 들어온 상담 신청 — 최근 것부터. */
export const getInquiries = (days: number) =>
  request<{ inquiries: Inquiry[]; fetchedAt: number }>(
    `listInquiryLogs?days=${days}`,
    undefined,
    '상담 신청 기록을 불러오지 못했습니다',
  )

/** 실패한 단계(Monday 등록 / 문자 발송)를 다시 실행한다. */
export const retryInquiry = (id: string, step: 'monday' | 'sms') =>
  request<{ inquiry: Inquiry }>(
    'retryInquiry',
    post({ id, step }),
    '다시 실행하지 못했습니다',
  )

export const getInquirySettings = () =>
  request<{ settings: InquirySettings }>(
    'inquirySettings',
    undefined,
    '문자 설정을 불러오지 못했습니다',
  )

export const saveInquirySettings = (
  settings: Omit<InquirySettings, 'updatedAt'>,
) =>
  request<{ settings: InquirySettings }>(
    'inquirySettings',
    post(settings),
    '문자 설정을 저장하지 못했습니다',
  )
