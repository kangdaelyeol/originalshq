// 웍스 봇이 글을 보낼 채팅방(channelId) — 봇이 그 방에 초대돼 있어야 한다. 채널 ID는 비밀 값이 아니다(옛
// Lightsail 코드에 적혀 있던 값).

export const WORKS_CHANNELS = {
  /** 기술팀 채팅방 — 아톡문의 새 문의 알림(옛 notify_inquiry.py) */
  tech: '6f91739b-f057-7fe6-0b21-9bb126b09ad2',
} as const

export type WorksChannel = keyof typeof WORKS_CHANNELS

/** 채팅방 이름(관리 화면에 보일 것) */
export const WORKS_CHANNEL_LABELS: Record<WorksChannel, string> = {
  tech: '기술팀 채팅방',
}
