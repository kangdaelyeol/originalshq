import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '../components/ui/glass-card'
import { StatusPill } from '../components/ui/status-pill'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: LucideIcon
}

/** 샘플 영상에 없던 메뉴(작업 보드·보안 & 키) 자리 — 레이아웃이 정해지면 바꾼다. */
export function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  return (
    <GlassCard className="empty">
      <span className="empty__icon" aria-hidden>
        <Icon size={22} strokeWidth={2} />
      </span>
      <h2 className="empty__title">{title}</h2>
      <p className="empty__text">{description}</p>
      <StatusPill tone="neutral">준비 중</StatusPill>
    </GlassCard>
  )
}
