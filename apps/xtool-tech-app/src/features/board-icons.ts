import {
  Barcode,
  ClipboardList,
  ClipboardPen,
  MessageCircle,
  Package,
  PackageOpen,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import type { TechBoardKey } from '@xtool-core/tech-boards';

/** 보드 아이콘 — 웹 nav.ts BOARD_ICONS와 같다(사이드바·내 업무 상자 머리) */
export const BOARD_ICONS: Record<TechBoardKey, LucideIcon> = {
  fieldService: Truck,
  repair: Wrench,
  techInquiry: MessageCircle,
  techTask: ClipboardList,
  asRequests: ClipboardPen,
  parts: Package,
  rentals: PackageOpen,
  serials: Barcode,
};
