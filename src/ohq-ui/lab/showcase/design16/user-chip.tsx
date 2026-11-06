import { ChevronsUpDown } from 'lucide-react'
import { Avatar } from './avatar'

interface UserChipProps {
  name: string
  email: string
  initials: string
}

/** 사이드바 아래 사용자 — 둥근 막(21px) 안에 흰 동그라미 "NH"·이름·메일·위아래 화살표 */
export function UserChip({ name, email, initials }: UserChipProps) {
  return (
    <button type="button" className="d16-user d16-hov">
      <Avatar initials={initials} size={18} className="d16-user__avatar" />
      <span className="d16-user__text">
        <span className="d16-user__name">{name}</span>
        <span className="d16-user__email">{email}</span>
      </span>
      <ChevronsUpDown className="d16-user__icon" strokeWidth={1.8} aria-hidden />
    </button>
  )
}
