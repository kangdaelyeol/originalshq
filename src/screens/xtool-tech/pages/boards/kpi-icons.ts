import {
  Barcode,
  Boxes,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardPen,
  Hourglass,
  Inbox,
  Link2,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  OctagonAlert,
  Package,
  PackageOpen,
  PackagePlus,
  PackageX,
  Paperclip,
  Receipt,
  Send,
  SquareCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { StatCardData } from '@/ohq-ui/types'
import type { KpiCard, KpiIcon } from '@xtool-core/board-kpis'

// 숫자 카드 아이콘 — 세는 법(@xtool-core/board-kpis)은 앱과 같이 쓰고, 웹은 아이콘 이름에 lucide-react 아이콘을 붙인다.

const KPI_ICONS: Record<KpiIcon, LucideIcon> = {
  Barcode,
  Boxes,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ClipboardPen,
  Hourglass,
  Inbox,
  Link2,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  OctagonAlert,
  Package,
  PackageOpen,
  PackagePlus,
  PackageX,
  Paperclip,
  Receipt,
  Send,
  SquareCheck,
  Truck,
  Wrench,
}

/** 공용 숫자 카드 함수에 아이콘을 붙인 것 — 부르는 법(인자)은 그대로다. */
export const withIcons =
  <A extends unknown[]>(count: (...args: A) => KpiCard[]) =>
  (...args: A): StatCardData[] =>
    count(...args).map((card) => ({ ...card, icon: KPI_ICONS[card.icon] }))
