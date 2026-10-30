import {
  LayoutGrid,
  ListTodo,
  Rocket,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

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
      { to: '/', label: '개요', icon: LayoutGrid },
      { to: '/analytics', label: '분석', icon: TrendingUp, badge: 'Live' },
      { to: '/deploy', label: '배포 스테이션', icon: Rocket },
      { to: '/team', label: '팀원 & 권한', icon: Users },
      { to: '/tasks', label: '작업 보드', icon: ListTodo },
    ],
  },
  {
    label: '시스템',
    items: [{ to: '/security', label: '보안 & 키', icon: Settings }],
  },
]
