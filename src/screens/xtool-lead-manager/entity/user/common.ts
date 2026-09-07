export interface Timestamp {
  toDate(): Date
  toMillis(): number
  seconds: number
  nanoseconds: number
}

// 상담 진행 상태
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

export interface ContactTimeline {
  // 접수일
  createdAt: Timestamp
  // 상담 마감일
  consultationDeadline: Timestamp
  // 콜백 1-4 단계 진행일
  callback1At?: Timestamp | null
  callback2At?: Timestamp | null
  callback3At?: Timestamp | null
  callback4At?: Timestamp | null
  // 미전환일
  notConvertedAt?: Timestamp | null
  // 결제일
  paidAt?: Timestamp | null
  // 보류일
  onHoldAt?: Timestamp | null
  // 보류 종료일
  onHoldEndedAt?: Timestamp | null
  // 샘플 테스트 링크 전달일
  sampleTestLinkSentAt?: Timestamp | null
  // 방문체험 확정일
  visitExperienceConfirmedAt?: Timestamp | null
  // 방문체험 예약링크 전달일
  visitExperienceLinkSentAt?: Timestamp | null
  // 견적서 발행일
  quotationIssuedAt?: Timestamp | null
  // 첫콜까지 걸린 시간
  firstCallRespondedAt?: Timestamp | null
}
