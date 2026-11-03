import type { LucideIcon } from 'lucide-react'

/** 상태 색 — 의미(정상/주의/위험/안내)가 있을 때만 쓴다. 차트 계열 색과 섞지 않는다. */
export type Tone = 'good' | 'warn' | 'crit' | 'info' | 'neutral'

/** KPI 카드 아이콘 칸의 색조 — 장식용. */
export type IconTint = 'blue' | 'violet' | 'green' | 'amber'

export interface Delta {
  value: string
  direction: 'up' | 'down'
  /** 방향과 별개로 "좋아졌는지" — 응답 시간처럼 내려가야 좋은 지표가 있다. */
  good: boolean
}

export interface StatCardData {
  key: string
  title: string
  value: string
  icon?: LucideIcon
  tint?: IconTint
  delta?: Delta
  tag?: { label: string; tone: Tone }
  caption?: string
}

export interface Option<T extends string> {
  value: T
  label: string
}
