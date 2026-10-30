// 상단바 알림 목업 — 실제 알림(배포·장애·리뷰 요청 등)이 붙으면 이 파일만 바꾸면 된다.

export type NotificationKind = 'incident' | 'review' | 'deploy' | 'mention' | 'system'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  body: string
  time: string
  unread: boolean
}

export const NOTIFICATIONS: readonly NotificationItem[] = [
  {
    id: 'n1',
    kind: 'incident',
    title: 'cafe24-sync 빌드 실패',
    body: 'hotfix@c0941aa — 테스트 3건이 실패했어요. 다시 실행이 필요해요.',
    time: '3분 전',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'review',
    title: 'PR #486 리뷰 요청',
    body: '박지호 님이 "로그인 입자 인트로" 리뷰를 요청했어요.',
    time: '12분 전',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'deploy',
    title: 'lead-manager-web 배포 완료',
    body: '프로덕션 v2.14.0 — 오류 없이 끝났어요.',
    time: '34분 전',
    unread: true,
  },
  {
    id: 'n4',
    kind: 'mention',
    title: '#tech-board에서 멘션',
    body: '이서연: "CMIP OpenAI 채널 올렸어요, 확인 부탁해요"',
    time: '1시간 전',
    unread: false,
  },
  {
    id: 'n5',
    kind: 'system',
    title: '응답 지연 경고 해제',
    body: 'cmip-functions p95 41ms — 정상 범위로 돌아왔어요.',
    time: '2시간 전',
    unread: false,
  },
  {
    id: 'n6',
    kind: 'deploy',
    title: '야간 백업 완료',
    body: 'Firestore 백업 4.2GB · 6분 걸렸어요.',
    time: '어제',
    unread: false,
  },
]
