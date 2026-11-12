import { getIncremental, postJson, requestJson } from './http'

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
  /** 회사·기관명과 문의 유형(B2B). 예전 기록에는 없다. */
  company?: string
  inquiryType?: string
  /** 앙케이트 — 추천 기기와 설문 답(여러 개면 ", "로 이은 값). 예전 기록에는
   * 없다. */
  recommendedProduct?: string
  purpose?: string
  materials?: string
  tasks?: string
  scale?: string
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
    /** 마지막 실행에서 시도한 횟수(일시적인 오류는 최대 3번). */
    attempts?: number
  }
  sms: {
    status: InquiryStepStatus
    to: string | null
    from: string | null
    subject?: string | null
    text: string | null
    messageId: string | null
    error: string | null
    at: number | null
    attempts?: number
  }
}

export interface InquirySettings {
  smsEnabled: boolean
  senderNumber: string
  template: string
  /** 장문(LMS) 제목 — 내용이 90byte를 넘을 때만 붙는다. 최대 40byte. */
  subject: string
  updatedAt: number | null
}

/** 최근 days일에 들어온 상담 신청 — 최근 것부터. since(지난 응답의 fetchedAt)를
 * 주면 그 뒤에 고친 것만 온다(가진 목록에 합친다). */
export const getInquiries = (days: number, since?: number) =>
  getIncremental<Inquiry>(
    'listInquiryLogs',
    'inquiries',
    days,
    since,
    '상담 신청 기록을 불러오지 못했습니다',
  )

/** 실패한 단계(Monday 등록 / 문자 발송)를 다시 실행한다. */
export const retryInquiry = (id: string, step: 'monday' | 'sms') =>
  requestJson<{ inquiry: Inquiry }>(
    'retryInquiry',
    '다시 실행하지 못했습니다',
    postJson({ id, step }),
  )

export const getInquirySettings = () =>
  requestJson<{ settings: InquirySettings }>(
    'inquirySettings',
    '문자 설정을 불러오지 못했습니다',
  )

export const saveInquirySettings = (
  settings: Omit<InquirySettings, 'updatedAt'>,
) =>
  requestJson<{ settings: InquirySettings }>(
    'inquirySettings',
    '문자 설정을 저장하지 못했습니다',
    postJson(settings),
  )

/** 접수 기록을 지운다(최대 500건). Monday 아이템·보낸 문자는 그대로다. */
export const deleteInquiries = (ids: string[]) =>
  requestJson<{ deleted: number }>(
    'deleteInquiryLogs',
    '접수 기록을 지우지 못했습니다',
    postJson({ ids }),
  )

/** 기기 코드 → 보드 이름(functions-xtool/src/inquiry/types.ts의
 * INQUIRY_BOARDS와 같은 순서·이름). 기기 필터 목록에 쓴다. */
export const INQUIRY_DEVICES = [
  { device: 'F1Ultra', label: 'F1 울트라' },
  { device: 'F2', label: 'F2' },
  { device: 'F2Ultra', label: 'F2 울트라' },
  { device: 'F2UltraUV', label: 'F2 울트라 UV' },
  { device: 'P3', label: 'P3' },
  { device: 'DTF', label: 'DTF' },
  { device: 'M2', label: 'M2' },
  { device: 'o1', label: 'O1' },
  { device: 'Metalfab', label: '메탈팹' },
  { device: 'X1', label: 'X1' },
  { device: 'other', label: '기타 온라인 문의' },
  { device: 'B2B', label: 'B2B 솔루션' },
  { device: 'survey', label: '앙케이트 문의' },
] as const
