import {
  CalendarDays,
  Layers,
  MessageCircle,
  Settings,
  WalletMinimal,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { DashboardDotsIcon, ReportsBarsIcon } from './sidebar-icons'
import type { D8Spring, D8Tween } from './sidebar-motion'

// Design 8(sample/design8.mp4 "Glassy SideBar V5")의 메뉴·잰 값.
// 길이는 전부 em — 1em = 영상 10px(영상 720px 폭 기준). F는 영상 프레임 번호(30fps).

export type D8Icon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

/** 줄 끝 표시 — count: 회색 알약(12), alert: 빨간 원(3), dot: 빨간 점 */
export type D8Badge = { kind: 'count'; value: string } | { kind: 'alert'; value: string } | { kind: 'dot' }

export interface D8SubItem {
  key: string
  label: string
  /** 점 색(F169 가운데 픽셀) */
  color: string
}

export interface D8NavItem {
  key: string
  label: string
  icon: D8Icon
  badge?: D8Badge
  /** 접혔을 때 툴팁 오른쪽 칩(⌘K·12·3) */
  chip?: string
  /** 하위 메뉴 — 프로젝트만 */
  children?: readonly D8SubItem[]
}

export interface D8Section {
  key: string
  label: string
  items: readonly D8NavItem[]
}

export const D8_SECTIONS: readonly D8Section[] = [
  {
    key: 'main',
    label: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: DashboardDotsIcon },
      { key: 'activity', label: 'Activity', icon: Zap, badge: { kind: 'count', value: '12' }, chip: '12' },
      { key: 'wallet', label: 'Wallet', icon: WalletMinimal },
      { key: 'schedule', label: 'Schedule', icon: CalendarDays, badge: { kind: 'dot' } },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    items: [
      { key: 'messages', label: 'Messages', icon: MessageCircle, badge: { kind: 'alert', value: '3' }, chip: '3' },
      {
        key: 'projects',
        label: 'Projects',
        icon: Layers,
        children: [
          { key: 'website', label: 'Website redesign', color: '#3fd08f' },
          { key: 'mobile', label: 'Mobile app', color: '#ec6a4c' },
          { key: 'brand', label: 'Brand kit', color: '#a77cf2' },
        ],
      },
      { key: 'reports', label: 'Reports', icon: ReportsBarsIcon },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const D8_ALL_ITEMS: readonly D8NavItem[] = D8_SECTIONS.flatMap((s) => s.items)

export const D8_WORKSPACE = { name: 'Vertix', caption: 'Finance workspace' }
export const D8_USER = { name: 'Alex Morgan', email: 'alex@vertix.io' }

/** 펼침/접힘 단축키 — 툴팁 칩 "[" (F69) */
export const D8_TOGGLE_KEY = '['

// ── 잰 값 ─────────────────────────────────────────────────────────────────────

/** 패널 폭(em): 접힘 78px(x 319..396) · 펼침 326px(x 195..520). 둘 다 가운데 x 357.5 */
export const D8_WIDTH = { collapsed: 7.8, expanded: 32.6 }

/**
 * 펼침·접힘 시간. 폭은 F74.9에 시작해 cubic-bezier(.05,.8,.3,1) 0.45초(F75 12% · F76 52% ·
 * F78 77% · F81 92% · F86 99%, 오차 0.6px). 높이(프로젝트 하위 3줄 13.1em)는 같은 순간
 * cubic-bezier(.05,.7,.1,1) 0.41초(F76 61% · F79 89%). 글자는 0.08초 뒤 0.25초에 걸쳐
 * 나타난다(F78 0.2 · F79 0.53 · F81 0.87 · F84 0.96) — 줄마다 차이(stagger)는 없었다.
 */
export const D8_EXPAND: Record<'width' | 'height' | 'labelsIn' | 'labelsOut' | 'railOut' | 'railIn', D8Tween> = {
  width: { duration: 0.45, ease: [0.05, 0.8, 0.3, 1] },
  height: { duration: 0.41, ease: [0.05, 0.7, 0.1, 1] },
  labelsIn: { duration: 0.25, delay: 0.08, ease: [0.33, 1, 0.68, 1] },
  labelsOut: { duration: 0.12, ease: [0.4, 0, 1, 1] },
  /** 접힘 전용 장식(구분선·아이콘 위 빨간 점)은 펼침 첫 1~2프레임에 사라진다(F75→F76) */
  railOut: { duration: 0.07, ease: 'linear' },
  railIn: { duration: 0.2, delay: 0.18, ease: 'easeOut' },
}

/**
 * 접혔을 때 독(dock) 확대 — 커서와 항목 가운데 거리 d(em)가 0이면 최대, 15em에서 0(삼각형).
 * 높이 증가 최대: 메뉴 2.6em, 검색 2.0em. 아이콘은 1+0.78·(증가/최대)배(최대 1.78 — 대시보드
 * 글리프 17→30px, F21·F50). 스프링 stiffness 300 · damping 30 · mass 1.
 * (F1~F74 로고 위치 −D/2, 첫 구분선, 선택 원 위치를 같은 모형으로 시뮬레이션해 맞춘 값 — 오차 1.4px)
 */
export const D8_DOCK = {
  range: 15,
  grow: { item: 2.6, search: 2.0 },
  iconScale: 0.78,
  spring: { stiffness: 300, damping: 30 } satisfies D8Spring,
}

/**
 * 선택 알약 — 앞쪽 가장자리가 먼저 가고 뒤쪽은 0.147초(4.4프레임) 뒤 따라온다(늘어났다 줄어듦).
 * 앞 stiffness 700 · damping 65, 뒤 550 · 47 (F96~F167 전환 4번, 오차 1.4px · 1.1px).
 */
export const D8_PILL = {
  lead: { stiffness: 700, damping: 65 } satisfies D8Spring,
  trail: { stiffness: 550, damping: 47, delay: 0.147 } satisfies D8Spring,
  /** 알약 높이 4.8em(F169 y 475..522) — 접혀도 원 크기 그대로(독으로 안 커짐, F25·F49) */
  height: 4.8,
}

/**
 * 툴팁 — 세로 위치는 가리킨 항목 가운데를 스프링(700·52)으로 따라간다(F20→F23, F55→F60).
 * 나타남 0.18초(F17 0.21 · F18 0.54 · F19 0.79 · F21 1), 사라짐 0.1초(F59 0.75 · F60 0.55 · F62 0).
 */
export const D8_TOOLTIP = {
  ySpring: { stiffness: 700, damping: 52 } satisfies D8Spring,
  enter: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] } satisfies D8Tween,
  exit: { duration: 0.1, ease: 'linear' } satisfies D8Tween,
  /** 항목 사이(구분선)를 지나는 동안은 숨기지 않고 기다린다 */
  hideDelay: 0.12,
  /** 기준(패널·토글) 오른쪽 끝에서 1.4em(패널 396→툴팁 410, 토글 412.5→426.5) */
  gap: 1.4,
}
