/*********************************************** *
 ********************* 방문체험 후 만족도 조사 보드 *****
 *********************************************** */

import type { Timestamp } from './common'

// 유튜브 / 인스타그램 / 지인추천 / 페이스북 / 기타
type Funnel = 'youtube' | 'instagram' | 'facebook' | 'recommend' | 'other'

/* 
  뛰어난 기능과 디자인  - 'features&design'
  사용 후기·리뷰 등 검증된 신뢰도 - 'reliability'
  믿을 수 있는 AS 및 사후지원 - 'AS'
  빠른 배송 및 설치 서비스 - 'quickDelivery'
  합리적인 가격 대비 성능 - 'performance'
*/
type Insight =
  | 'features&design'
  | 'reliability'
  | 'AS'
  | 'quickDelivery'
  | 'performance'
  | 'other'
  | string

type SatisfactionLevel = '0' | '1' | '2' | '3' | '4' | '5'

export interface VisitExperienceSurvey {
  itemId: string
  createdAt: Timestamp
  // 기프티콘 전송
  giftSent: boolean
  // 엑스툴을 처음 알게된 경로는 무엇인가요?
  funnel: Funnel[]
  // 구매 또는 구매 예정 시 가장 중요하게 생각하는 요소는 무엇인가요?
  insight: Insight[]
  // 어떠한 경로를 통해 엑스툴을 알게 되었는지 알려주세요
  funnelAction: string
  // 방문체험 서비스의 만족도를 평가해 주세요!
  satisfactionLevel: SatisfactionLevel
  // 방문체험 서비스의 어떤 부분이 좋으셨나요?
  satisfactionPoint: string
  // 어떤 점이 아쉬웠나요? 개선할 점을 알려주세요!
  disSatisfactionPoint: string
  // 담당자
  assignedManagers: string[]
}
