import type { Timestamp } from '../../types'

/** 상담 진행 상태 */
export type ConsultationStatus =
  | 'NEW_INQUIRY' // 신규 상담 유입
  | 'CALLBACK_1' // 콜백 1단계
  | 'CALLBACK_2' // 콜백 2단계
  | 'CALLBACK_3' // 콜백 3단계
  | 'CALLBACK_4' // 콜백 4단계
  | 'ON_HOLD' // 보류
  | 'NOT_CONVERTED' // 미전환
  | 'MISENTERED' // 오기입
  | 'PAID' // 결제

/** 유입 경로 (제품/서비스 라인) */
export type AcquisitionChannel =
  | 'F2_ULTRA' // F2Ultra
  | 'F2_ULTRA_UV' // F2UltraUV
  | 'P3' // P3
  | 'DTF' // DTF
  | 'METALFAB' // Metalfab
  | 'B2B_SOLUTION' // B2BSolution
  | 'OFF_LINE' // 기타 오프라인 보드

/** 구매 확률 */
export type PurchaseProbability =
  | 'LOW' // 낮음
  | 'MEDIUM' // 중간
  | 'HIGH' // 높음
  | 'VERY_HIGH' // 매우높음

/**
 * 상담/영업 프로세스 단계별 발생 시각 (Firebase Timestamp)
 * 발생하지 않은 이벤트는 필드 자체를 생략하거나 null로 둡니다.
 */
export interface ContactTimeline {
  /** 접수일 */
  createdAt: Timestamp
  /** 상담 마감일 */
  consultationDeadline: Timestamp
  // 콜백 1-4 단계 진행일
  callback1At?: Timestamp | null
  callback2At?: Timestamp | null
  callback3At?: Timestamp | null
  callback4At?: Timestamp | null
  /** 미전환일 */
  notConvertedAt?: Timestamp | null
  /** 결제일 */
  paidAt?: Timestamp | null
  /** 보류일 */
  onHoldAt?: Timestamp | null
  /** 보류 종료일 */
  onHoldEndedAt?: Timestamp | null
  /** 샘플 테스트 링크 전달일 */
  sampleTestLinkSentAt?: Timestamp | null
  /** 방문체험 확정일 */
  visitExperienceConfirmedAt?: Timestamp | null
  /** 방문체험 예약링크 전달일 */
  visitExperienceLinkSentAt?: Timestamp | null
  /** 견적서 발행일 */
  quotationIssuedAt?: Timestamp | null
  /**
   * 첫콜까지 걸린 시간
   * 주의: 이 항목은 성격상 "시각(Timestamp)"이 아니라 "소요 시간(duration)"에
   * 더 가깝습니다. 접수일(receivedAt) 대비 첫 콜백까지 걸린 시간(ms 등)을
   * 별도 number 필드로 저장하는 것을 권장하며, 그럴 경우
   * `firstCallResponseTimeMs: number` 형태로 분리하는 게 계산/조회에 유리합니다.
   * 우선 요청하신 대로 Timestamp 타입을 유지해둡니다.
   */
  firstCallRespondedAt?: Timestamp | null
}

/** Contact (고객 상담 카드) 스키마 */
export interface OnlineContact {
  itemId: string
  /** 담당자 (복수 배정 가능) */
  assignedManagers: string[]
  /** 상담 진행 상태 */
  consultationStatus: ConsultationStatus
  /** 유입 경로 */
  acquisitionChannel: AcquisitionChannel
  /** 구매 확률 */
  purchaseProbability: PurchaseProbability
  /** 상담 내역 (자유 텍스트) */
  consultationNotes: string
  /** 방문체험 확정 여부 */
  visitExperienceConfirmed: boolean
  /** 방문체험 예약링크 전달 여부 */
  visitExperienceLinkSent: boolean
  /** 샘플 테스트 신청 여부 */
  sampleTestRequested: boolean
  /** 견적서 발행 여부 */
  quotationIssued: boolean
  /** 단계별 이벤트 발생 시각 모음 */
  timeline: ContactTimeline
}
