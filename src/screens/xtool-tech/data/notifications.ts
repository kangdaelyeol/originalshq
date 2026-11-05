// 상단바 알림 — 실제 알림이 붙으면 이 파일만 바꾸면 된다(지금은 비어 있다).

export type NotificationKind = 'incident' | 'review' | 'deploy' | 'mention' | 'system'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  time: string
  unread: boolean
}

// 테스트 알림은 지웠다 — 어디에 쓸지 정해지면 여기에 붙인다(상단바 종 아이콘·빈 패널은 그대로 둔다).
export const NOTIFICATIONS: readonly NotificationItem[] = []
