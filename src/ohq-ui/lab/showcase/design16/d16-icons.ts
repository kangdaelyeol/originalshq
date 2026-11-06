import {
  Blocks,
  Box,
  ChartNoAxesColumn,
  Coffee,
  FileText,
  LayoutGrid,
  Leaf,
  Mail,
  MessageSquare,
  Settings,
  ShoppingBag,
  Soup,
  Sprout,
  Tag,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { ItemKind, NavIcon } from './design16-data'

// D16 아이콘 — 영상 사이드바·상품 칸의 선 아이콘과 가장 닮은 lucide 아이콘(새 패키지 없이)

export const D16_NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutGrid,
  orders: ShoppingBag,
  products: Box,
  analytics: ChartNoAxesColumn,
  customers: Users,
  finances: Wallet,
  invoices: FileText,
  discounts: Tag,
  chats: MessageSquare,
  email: Mail,
  apps: Blocks,
  settings: Settings,
}

/** 상품 칸 — 녹차(잎)·허브(새싹)·우롱(밀)·홍차(잔)·다기(그릇) */
export const D16_ITEM_ICONS: Record<ItemKind, LucideIcon> = {
  green: Leaf,
  herbal: Sprout,
  oolong: Wheat,
  black: Coffee,
  ware: Soup,
}
