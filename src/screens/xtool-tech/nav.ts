import {
  ClipboardList,
  FileText,
  KeyRound,
  LayoutGrid,
  ListTodo,
  MessageCircle,
  Package,
  Rocket,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BOARD_TABS, type TechBoardKey } from './data/tech-boards'
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

const BOARD_ICONS: Record<TechBoardKey, LucideIcon> = {
  fieldService: Truck,
  repair: Wrench,
  records: FileText,
  techInquiry: MessageCircle,
  techTask: ClipboardList,
  // 부품 마스터 — 메뉴에는 아직 없음(AS 청구 부품 고르기에만 쓴다)
  parts: Package,
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: '메뉴',
    items: [
      { to: xtPath(), label: '개요', icon: LayoutGrid },
      // 기술지원팀 Monday 보드 — 개요 바로 아래, BOARD_TABS 순서대로.
      ...BOARD_TABS.map((tab) => ({ to: xtPath(`/boards/${tab.slug}`), label: tab.label, icon: BOARD_ICONS[tab.key] })),
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
