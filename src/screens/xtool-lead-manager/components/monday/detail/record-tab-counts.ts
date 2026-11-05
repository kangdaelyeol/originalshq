/** 기록 종류 토글의 종류·이름·개수(컴포넌트가 아니라 따로 둔다). */
import type { MondayCustomer } from '@/screens/xtool-lead-manager/entity'

/** 기록 종류 토글 — 고른 종류의 섹션만 보인다. 납부 내역은 구매와 같이 본다. */
export type RecordTab =
  | 'all'
  | 'consultation'
  | 'visit'
  | 'purchase'
  | 'survey'
  | 'sampleTest'
  | 'fieldService'
  | 'repair'
  | 'techInquiry'
  | 'techTask'

export const RECORD_TAB_LABEL: Record<RecordTab, string> = {
  all: '전체',
  consultation: '상담',
  visit: '방문체험',
  purchase: '구매',
  survey: '만족도',
  sampleTest: '샘플테스트',
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '기술 문의',
  techTask: '기타업무',
}

export const recordCounts = (
  customer: MondayCustomer,
): Record<Exclude<RecordTab, 'all'>, number> => ({
  consultation: customer.consultations.length,
  visit: customer.visits.length,
  purchase: customer.purchases.length + customer.payments.length,
  survey: customer.surveys.length,
  sampleTest: customer.sampleTests.length,
  fieldService: customer.fieldServices.length,
  repair: customer.repairs.length,
  techInquiry: customer.techInquiries.length,
  techTask: customer.techTasks.length,
})
