import {
  KeyRound,
  LayoutGrid,
  ListTodo,
  Rocket,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { xtPath } from './paths'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: '메뉴',
    items: [
      { to: xtPath(), label: '개요', icon: LayoutGrid },
      { to: xtPath('/analytics'), label: '분석', icon: TrendingUp, badge: 'Live' },
      { to: xtPath('/deploy'), label: '배포 스테이션', icon: Rocket },
      { to: xtPath('/team'), label: '팀원 & 권한', icon: Users },
      { to: xtPath('/tasks'), label: '작업 보드', icon: ListTodo },
    ],
  },
  {
    label: '시스템',
    items: [
      { to: xtPath('/settings'), label: '설정', icon: Settings },
      { to: xtPath('/security'), label: '보안 & 키', icon: KeyRound },
    ],
  },
]
