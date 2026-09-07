/************************************** *
 ********************* 택배 발송 보드 *****
 ************************************** */

import type { Timestamp } from './common'

// 택배 발송 이전 | 택배 발송 완료 | 결제 취소
type PackageSendState = 'pending' | 'compeleted' | 'canceled'

// 발송 이전 | 발송 완료 | 발송 대기
type MessageSendState = 'pending' | 'compleled' | 'waiting'

export interface PackageSend {
  itemId: string
  // 생성 시각
  createdAt: Timestamp
  // 우편번호
  postalCode: string
  // 주소
  address: string
  // 온라인
  online: boolean
  // 문자 발송하기
  messageSendState: MessageSendState
  // 발송 상태
  sendState: PackageSendState
  // 발송 날짜
  sendDate?: Timestamp
  // 비고
  memo: string
  // 송장
  invoice: string
}
