import {
  Barcode,
  ClipboardList,
  ClipboardPen,
  FileText,
  LayoutGrid,
  MessageCircle,
  Package,
  PackageOpen,
  Palette,
  Settings,
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
  /** 관리자만 보이는 메뉴(주소로 들어와도 화면이 막는다) */
  adminOnly?: boolean
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
  asRequests: ClipboardPen,
  parts: Package,
  rentals: PackageOpen,
  serials: Barcode,
}

const boardItems = (section: 'work' | 'manage'): NavItem[] =>
  BOARD_TABS.filter((tab) => tab.section === section).map((tab) => ({
    to: xtPath(`/boards/${tab.slug}`),
    label: tab.label,
    icon: BOARD_ICONS[tab.key],
  }))

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: '메뉴',
    // 개요 + 기술지원팀 업무 보드(BOARD_TABS 순서)
    items: [{ to: xtPath(), label: '개요', icon: LayoutGrid }, ...boardItems('work')],
  },
  {
    label: '관리',
    // 대장·재고 보드 — AS 신청서·부품 마스터·대여품·SN
    items: boardItems('manage'),
  },
  {
    label: '시스템',
    // 디자인(부품 카탈로그)은 관리자만. 팀원 & 권한은 아직 목업 — 나중에 쓸 자리로 둔다.
    items: [
      { to: xtPath('/design'), label: '디자인', icon: Palette, adminOnly: true },
      { to: xtPath('/team'), label: '팀원 & 권한', icon: Users },
      { to: xtPath('/settings'), label: '설정', icon: Settings },
    ],
  },
]
