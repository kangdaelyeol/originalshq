import type { Device } from '../types'

/** 웹사이트 상담 신청을 받는 기기 — 기기마다 Monday 상담 보드가 하나씩이다.
 * 코드 값은 리드 관리자의 Device와 같다. */
export const INQUIRY_BOARDS = {
  F2: { boardId: '5031196508', label: 'F2' },
  F2Ultra: { boardId: '5026295471', label: 'F2 울트라' },
  F2UltraUV: { boardId: '5026295498', label: 'F2 울트라 UV' },
  P3: { boardId: '5026295481', label: 'P3' },
  DTF: { boardId: '5026295425', label: 'DTF' },
  M2: { boardId: '5031196408', label: 'M2' },
  o1: { boardId: '5031196400', label: 'O1' },
  Metalfab: { boardId: '5026295489', label: '메탈팹' },
} as const satisfies Partial<Record<Device, { boardId: string; label: string }>>

export type InquiryDevice = keyof typeof INQUIRY_BOARDS

export const isInquiryDevice = (value: unknown): value is InquiryDevice =>
  typeof value === 'string' && value in INQUIRY_BOARDS

/** 웹사이트 폼이 보내는 값(검증을 거친 뒤). */
export interface InquiryInput {
  device: InquiryDevice
  name: string
  /** 입력한 그대로 — 저장·Monday에는 형식을 맞춘 값을 쓴다. */
  phone: string
  email: string
  installment: string
  utmCampaign: string
  utmMedium: string
  utmSource: string
  fbc: string
  fbp: string
  gaClientId: string
  /** 브라우저가 만든 제출 id — 같은 제출이 두 번 와도 한 건만 처리한다. */
  submissionId: string | null
}

export type StepStatus = 'pending' | 'success' | 'failed' | 'skipped'

export interface MondayStep {
  status: StepStatus
  itemId: string | null
  error: string | null
  at: number | null
}

export interface SmsStep {
  status: StepStatus
  /** 보낸 번호·내용 — 나중에 무엇을 보냈는지 확인용. */
  to: string | null
  from: string | null
  text: string | null
  messageId: string | null
  error: string | null
  at: number | null
}

/** inquiries/{id} — 문의 1건과 처리 단계별 결과. */
export interface Inquiry extends Omit<InquiryInput, 'submissionId'> {
  id: string
  receivedAt: number
  /** 한국 시간 접수일(YYYY-MM-DD) — Monday 접수일 컬럼에 넣는다. */
  receivedDate: string
  boardId: string
  boardName: string
  /** 숫자로 볼 수 있으면 010-0000-0000, 아니면 입력값 그대로. */
  phoneFormatted: string
  ip: string
  userAgent: string
  monday: MondayStep
  sms: SmsStep
}

/** settings/inquiry — 문자 발송 설정(접수 로그 화면에서 고친다). */
export interface InquirySettings {
  smsEnabled: boolean
  /** SOLAPI에 등록된 발신 번호(숫자만). */
  senderNumber: string
  /** 문자 내용 — {고객명}·{기기}·{전화번호}를 실제 값으로 바꿔 보낸다. */
  template: string
  updatedAt: number | null
}
