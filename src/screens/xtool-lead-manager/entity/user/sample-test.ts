/************************************** *
 ********************* 샘플테스트 보드 *****
 ************************************** */

import type { Timestamp } from './common'

type State = 'pending' | 'processing' | 'completed'

export interface SampleTest {
  itemId: string
  createdAt: string
  // 담당자
  assignedManagers: string[]
  // 상태
  state: State
  // 요청일
  requiredDate: Timestamp
  // 샘플 받을 주소
  address: string
  // 샘플 소재
  source: string
  // 테스트 기기
  device: string
  // 테스트 결과 보고서
  reportUrl: string
  // 이메일 주소
  email: string
  // 완료일
  completedAt: string
}
