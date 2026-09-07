/************************************************ *
 ********************* B2B영업 / 기타 오프라인 보드 *****
 ************************************************ */

import type { ConsultationStatus, ContactTimeline } from './common'

// 유입 경로 (제품/서비스 라인)
export type ConsultationDevice =
  | 'F2_ULTRA' // F2Ultra
  | 'F2_ULTRA_UV' // F2UltraUV
  | 'P3' // P3
  | 'DTF' // DTF
  | 'METALFAB' // Metalfab
  | 'B2B_SOLUTION' // B2BSolution
  | 'OFF_LINE' // 기타 오프라인 보드

// 구매 확률
type PurchaseProbability =
  | 'LOW' // 낮음
  | 'MEDIUM' // 중간
  | 'HIGH' // 높음
  | 'VERY_HIGH' // 매우높음

// B2B 영업보드 Scheme
interface OnlineContact {
  itemId: string
  // 담당자
  assignedManagers: string[]
  // 상담 진행 상태
  consultationStatus: ConsultationStatus
  // 상담 기기(유입 경로)
  consultationDevice: ConsultationDevice
  // 구매 확률
  purchaseProbability: PurchaseProbability
  // 상담 내역 (자유 텍스트)
  consultationNotes: string
  // 방문체험 확정 여부
  visitExperienceConfirmed: boolean
  // 방문체험 예약링크 전달 여부
  visitExperienceLinkSent: boolean
  // 샘플 테스트 신청 여부
  sampleTestRequested: boolean
  // 견적서 발행 여부
  quotationIssued: boolean
  // 단계별 이벤트 발생 시각 모음
  timeline: ContactTimeline
}

// 기타 오프라인 보드 Scheme
interface OfflineContact {
  itemId: string
  // 구매 확률
  purchaseProbability: PurchaseProbability
  // 상담 기기(유입 경로 - OFFLINE)
  consultationDevice: ConsultationDevice
  // 관심 기기
  interestedDevice: string[]
  // 담당자
  assignedManagers: string[]
  // 상담 내역 (자유 텍스트)
  consultationNotes: string
  // 방문체험 확정 여부
  visitExperienceConfirmed: boolean
  // 방문체험 예약링크 전달 여부
  visitExperienceLinkSent: boolean
  // 샘플 테스트 신청 여부
  sampleTestRequested: boolean
  // 견적서 발행 여부
  quotationIssued: boolean
  // 단계별 이벤트 발생 시각 모음
  timeline: ContactTimeline
}

export type Contact = OnlineContact | OfflineContact
