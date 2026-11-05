import {
  Barcode,
  ClipboardList,
  ClipboardPen,
  LayoutGrid,
  MessageCircle,
  Package,
  PackageOpen,
  Palette,
  Settings,
  Truck,
  UserRoundCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BOARD_TABS, type TechBoardKey } from './data/tech-boards'
import { MY_WORK_PATH, xtPath } from './paths'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
  /** 관리자만 보이는 메뉴(주소로 들어와도 화면이 막는다) */
  adminOnly?: boolean
  /** 아래로 직원 목록(하위 메뉴)이 펼쳐지는 메뉴 — 내 업무 */
  people?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

/** 보드 아이콘 — 사이드바 메뉴와 내 업무(Monday 표)의 보드 박스 머리말 */
export const BOARD_ICONS: Record<TechBoardKey, LucideIcon> = {
  fieldService: Truck,
  repair: Wrench,
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
    // 개요 · 내 업무(직원별 담당 업무) + 기술지원팀 업무 보드(BOARD_TABS 순서)
    items: [
      { to: xtPath(), label: '개요', icon: LayoutGrid },
      { to: MY_WORK_PATH, label: '내 업무', icon: UserRoundCheck, people: true },
      ...boardItems('work'),
    ],
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
