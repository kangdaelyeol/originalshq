/** 방문체험보드 Scheme */

import type { ConsultationStatus, ContactTimeline, Timestamp } from './common'

type Funnel = '지연유입' | '영업전환'

type ExperienceState =
  | '방문 대기'
  | '체험 일정 연기'
  | '체험 노쇼'
  | '체험 완료'
  | '체험 취소'

type purchasePosibility =
  | 'LOW' // 낮음
  | 'MEDIUM' // 중간
  | 'HIGH' // 높음
  | 'VERY_HIGH' // 매우높음
  | '기기 사용 교육'
  | '재방문 예정'

// 방문체험 보드 (평일?)
export interface VisitExperience {
  itemId: string
  // 방문체험 일자
  visitedAt: Timestamp
  // (예약) 체험 기기
  reservedDevice: string[]
  // (실제) 체험 기기
  experiencedDevice: string[]
  // 담당자
  assignedManagers: string[]
  // 유입 경로
  funnel?: Funnel
  // 체험 상태
  experienceState: ExperienceState
  // 구매 가능성
  purchaseProbability: purchasePosibility
  // 상담 진행 상태
  consultationStatus: ConsultationStatus
  // 상담 내역 (자유 텍스트)
  consultationNotes: string
  // 메모
  memo: string
  // 선샘플 진행 여부 (체크)
  isPreSampled: boolean
  // 녹음 진행 여부 (체크)
  isRecorded: boolean
  // 견적서 발행 여부
  quotationIssued: boolean
  // 소재
  source: string
  // 고객 요청사항
  requirement: string
  // 만족도 조사 발송 여부
  satisfiactionSurvey: boolean
  contactTimeline: ContactTimeline
}

export interface WeekendVisitExperience {
  itemId: string
  // 방문체험 일자
  visitedAt: Timestamp
  // (예약) 체험 기기
  reservedDevice: string[]
  // (실제) 체험 기기
  experiencedDevice: string[]
  // 담당자
  assignedManagers: string[]
  // 체험 상태
  experienceState: ExperienceState
  // 구매 가능성
  purchaseProbability: purchasePosibility
  // 상담 진행 상태
  consultationStatus: ConsultationStatus
  // 상담 내역 (자유 텍스트)
  consultationNotes: string
  // 견적서 발행 여부
  quotationIssued: boolean
  // 만족도 조사 발송 여부
  satisfiactionSurvey: boolean
  // 소재
  source: string
  // 메모
  memo: string
  // 고객 요청사항
  requirement: string
  contactTimeline: ContactTimeline
}
